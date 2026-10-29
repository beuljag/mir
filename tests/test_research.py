from io import BytesIO
import json
import time

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from app.main import create_app
from app.models import JobRecord
from app.research import analyze_document, now, official_domain
from app.web_fetch import FetchError, public_target

KEY = "research-owner-test-key-123456789"
OTHER = "research-other-test-key-123456789"
URL = "https://www.ti.com/lit/ds/symlink/testmodel.pdf"


def html_fetch(url, **kwargs):
    return {"url": url, "content_type": "text/html", "body": b"<html><h1>TESTMODEL Datasheet</h1><p>Pin information</p><p>1 IN input</p><p>Recommended operating conditions supply voltage refer to table.</p><p>Absolute maximum ratings are stress limits only.</p></html>"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("CIRCUIT_REVIEW_KEY", "human-review-test-key-123456789")
    monkeypatch.delenv("BRAVE_SEARCH_API_KEY", raising=False)
    app = create_app(str(tmp_path / "research.db"), {KEY: "a", OTHER: "b"})
    app.state.research.fetcher = html_fetch
    with TestClient(app, headers={"X-API-Key": KEY}) as client:
        yield client
    app.state.research.pool.shutdown(wait=True)


def completed(client, job_id):
    for _ in range(100):
        job = client.get("/jobs/" + job_id).json()
        if job["status"] not in ("queued", "running"):
            return job
        time.sleep(.01)
    raise AssertionError("Job did not finish")


def candidate(client):
    response = client.post("/components/research", json={"model": "TESTMODEL", "manufacturer": "Texas Instruments", "source_urls": [URL]})
    assert response.status_code == 202
    job = completed(client, response.json()["id"])
    assert job["status"] == "completed", job
    return client.get("/component-candidates/" + job["result"]["candidate_id"]).json(), job


def approval(c):
    source = {**c["analyses"][0]["source"], "page": "fixture page 1"}
    # Synthetic metadata is exercised only in this isolated test database.
    return {"expected_version": 1, "decision": "approve", "reviewer_notes": "Synthetic fixture manually reviewed for API test only",
            "confirmed_model_revision": True, "confirmed_pinout": True, "confirmed_electrical_limits": True,
            "component": {"id": "testmodel-r1", "manufacturer": "Texas Instruments", "model": "TESTMODEL", "revision": "fixture-1", "category": "test",
                          "is_virtual": False, "verification_status": "verified", "source_references": [source],
                          "pins": [{"id": "1", "label": "IN", "direction": "input", "signal_type": "analog"}]}}


def test_research_candidate_not_published_before_human_review(client):
    c, job = candidate(client)
    assert c["status"] == "pending_review" and c["analyses"][0]["verification_status"] == "unverified"
    assert c["analyses"][0]["model_match"] and c["analyses"][0]["official_domain_match"]
    assert client.get("/components/search?q=TESTMODEL").json() == []
    assert len(client.get("/component-candidates").json()) == 1
    assert client.get("/jobs/" + job["id"], headers={"X-API-Key": OTHER}).status_code == 404
    assert client.get("/component-candidates/" + c["id"], headers={"X-API-Key": OTHER}).status_code == 404


def test_review_requires_separate_key_and_real_evidence(client):
    c, _ = candidate(client)
    body = approval(c)
    path = "/component-candidates/" + c["id"] + "/review"
    assert client.post(path, json=body).status_code == 403
    headers = {"X-Review-Key": "human-review-test-key-123456789"}
    body["component"]["source_references"][0]["sha256"] = "invented"
    assert client.post(path, json=body, headers=headers).status_code == 422
    body = approval(c)
    result = client.post(path, json=body, headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "approved"
    assert client.get("/components/testmodel-r1").status_code == 200
    assert client.post(path, json=body, headers=headers).status_code == 409


def test_review_authentication_contract_is_separate_and_requires_both(client):
    spec = client.get("/openapi.json").json()
    schemes = spec["components"]["securitySchemes"]
    assert schemes["APIKeyHeader"]["name"] == "X-API-Key"
    assert schemes["HumanReviewKey"]["name"] == "X-Review-Key"
    assert spec["paths"]["/component-candidates/{candidate_id}/review"]["post"]["security"] == [{"APIKeyHeader": [], "HumanReviewKey": []}]


def test_approval_cannot_overwrite_existing_definition(client):
    c, _ = candidate(client)
    body = approval(c)
    body["component"]["id"] = "virtual-supply"
    response = client.post("/component-candidates/" + c["id"] + "/review", json=body, headers={"X-Review-Key": "human-review-test-key-123456789"})
    assert response.status_code == 409
    assert client.get("/component-candidates/" + c["id"]).json()["status"] == "pending_review"
    assert client.get("/components/virtual-supply").json()["is_virtual"]


def test_review_reject_and_confirmation_requirements(client):
    c, _ = candidate(client)
    body = approval(c)
    path = "/component-candidates/" + c["id"] + "/review"
    headers = {"X-Review-Key": "human-review-test-key-123456789"}
    body["confirmed_pinout"] = False
    assert client.post(path, json=body, headers=headers).status_code == 422
    assert client.post(path, json={"expected_version": 1, "decision": "reject", "reviewer_notes": "Pinout could not be verified in source"}, headers=headers).json()["status"] == "rejected"


def test_analysis_and_exact_model_matching(client):
    response = client.post("/datasheets/analyze", json={"url": URL, "model": "TESTMODEL", "manufacturer": "Texas Instruments"})
    result = completed(client, response.json()["id"])["result"]
    assert result["evidence"] and result["source"]["sha256"]
    assert {e["category"] for e in result["evidence"]} >= {"pin_information", "recommended_operation", "absolute_maximum"}
    mismatch = analyze_document(URL, "TESTMODEL2", "Texas Instruments", fetcher=html_fetch)
    assert not mismatch["model_match"]
    assert official_domain("https://www.ti.com/x", "TI")
    assert not official_domain("https://ti.com.evil.example/x", "TI")


def test_unsupported_discovery_fails_explicitly(client):
    job = client.post("/components/research", json={"model": "unregistered-model", "manufacturer": "unknown"}).json()
    finished = completed(client, job["id"])
    assert finished["status"] == "failed"
    assert finished["error"]["code"] == "SEARCH_CONFIGURATION_OR_SOURCE_URL_REQUIRED"


@pytest.mark.parametrize("url", ["http://example.com/file.pdf", "https://localhost/x", "https://127.0.0.1/x", "https://169.254.169.254/x", "https://user:pass@example.com/x", "https://example.com:8000/x", "file:///etc/passwd"])
def test_reject_private_and_nonhttps_sources(url):
    with pytest.raises(FetchError):
        public_target(url)


def test_pdf_parser_blank_scan_and_page_limit():
    from app.extract_pdf import extract
    writer = PdfWriter()
    for _ in range(41):
        writer.add_blank_page(100, 100)
    buffer = BytesIO()
    writer.write(buffer)
    document = extract(buffer.getvalue())
    assert document["total_pages"] == 41 and len(document["pages"]) == 40 and document["truncated"]


def test_server_restart_marks_unfinished_jobs_failed(tmp_path):
    from app.storage import Store
    from app.research import ResearchService
    store = Store(str(tmp_path / "restart.db"))
    store.save_job(JobRecord(id="interrupted", kind="research", status="running", created_at=now(), updated_at=now()), "a", create=True)
    service = ResearchService(store)
    assert store.get_job("interrupted", "a").error["code"] == "SERVER_RESTARTED"
    service.pool.shutdown(wait=True)


def test_fetch_redirect_rechecks_private_destination(monkeypatch):
    import app.web_fetch as web
    monkeypatch.setattr(web.socket, "getaddrinfo", lambda host, *args, **kwargs: [(2, 1, 6, "", ("127.0.0.1" if host == "private.example" else "8.8.8.8", 443))])
    class Response:
        status = 302
        def getheader(self, name, default=None):
            return "https://private.example/secret" if name == "Location" else default
    class Connection:
        sock = None
        def __init__(self, *args):
            pass
        def request(self, *args, **kwargs):
            pass
        def getresponse(self):
            return Response()
        def close(self):
            pass
    monkeypatch.setattr(web, "PinnedHTTPSConnection", Connection)
    with pytest.raises(FetchError, match="PRIVATE_TARGET_BLOCKED"):
        web.fetch_public("https://public.example/file")


def test_worker_parser_can_handle_a_real_pdf_process():
    from app.research import parse_pdf_bounded
    writer = PdfWriter()
    writer.add_blank_page(100, 100)
    buffer = BytesIO()
    writer.write(buffer)
    assert parse_pdf_bounded(buffer.getvalue())["total_pages"] == 1
