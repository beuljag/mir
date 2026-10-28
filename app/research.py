"""Evidence collection, asynchronous jobs and review candidates; no invented specifications."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys
import threading
from urllib.parse import urlencode, urlsplit
from uuid import uuid4

from .models import CandidateRecord, JobRecord
from .web_fetch import FetchError, fetch_public

ROOT = Path(__file__).resolve().parents[1]
DOMAINS = {"ti": ["ti.com"], "texas instruments": ["ti.com"], "st": ["st.com"],
           "stmicroelectronics": ["st.com"], "analog devices": ["analog.com"],
           "microchip": ["microchip.com"], "nxp": ["nxp.com"], "infineon": ["infineon.com"],
           "espressif": ["espressif.com"], "arduino": ["arduino.cc"],
           "raspberry pi": ["raspberrypi.com"], "onsemi": ["onsemi.com"], "vishay": ["vishay.com"]}


def now():
    return datetime.now(timezone.utc).isoformat()


class ResearchError(ValueError):
    pass


def official_domain(url, manufacturer):
    host = (urlsplit(url).hostname or "").lower()
    domains = DOMAINS.get((manufacturer or "").strip().lower(), [])
    return any(host == domain or host.endswith("." + domain) for domain in domains)


class TextHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.hidden += 1
        if tag in ("p", "div", "tr", "br", "h1", "h2", "li"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def parse_pdf_bounded(body):
    child = subprocess.Popen([sys.executable, "-m", "app.extract_pdf"], cwd=ROOT,
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    job_handle = None
    try:
        if sys.platform == "win32":
            # Parsing is blocked on stdin until the parent applies the memory limit.
            import win32api
            import win32job
            job_handle = win32job.CreateJobObject(None, "CircuitPDF-" + uuid4().hex)
            limits = win32job.QueryInformationJobObject(job_handle, win32job.JobObjectExtendedLimitInformation)
            limits["BasicLimitInformation"]["LimitFlags"] = win32job.JOB_OBJECT_LIMIT_PROCESS_MEMORY | win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            limits["ProcessMemoryLimit"] = 512 * 1024 * 1024
            win32job.SetInformationJobObject(job_handle, win32job.JobObjectExtendedLimitInformation, limits)
            process_handle = win32api.OpenProcess(0x0100 | 0x0001, False, child.pid)
            try:
                win32job.AssignProcessToJobObject(job_handle, process_handle)
            finally:
                process_handle.Close()
        output, _ = child.communicate(body, timeout=25)
        if child.returncode or len(output) > 8_000_000:
            raise ResearchError("PDF_EXTRACTION_FAILED")
        return json.loads(output)
    except subprocess.TimeoutExpired:
        child.kill()
        child.communicate()
        raise ResearchError("PDF_EXTRACTION_TIMEOUT") from None
    finally:
        if child.poll() is None:
            child.kill()
            child.communicate()
        if job_handle:
            job_handle.Close()


def analyze_document(url, model, manufacturer=None, fetcher=fetch_public):
    fetched = fetcher(url)
    body = fetched["body"]
    if body.startswith(b"%PDF-"):
        document = parse_pdf_bounded(body)
    elif "html" in fetched["content_type"] or fetched["content_type"].startswith("text/plain"):
        parser = TextHTML()
        parser.feed(body.decode("utf-8", errors="replace"))
        document = {"pages": [{"page": None, "text": "".join(parser.parts)[:200000]}], "total_pages": None, "truncated": len(body) > 200000, "title": "", "document_date": ""}
    else:
        raise ResearchError("UNSUPPORTED_DOCUMENT_TYPE")
    text = "\n".join(page["text"] for page in document["pages"])
    matched = bool(re.search(r"(?<![A-Za-z0-9])" + re.escape(model) + r"(?![A-Za-z0-9])", text, re.I))
    warnings = ["자동 추출한 근거 발췌이며 핀 배치·전압 수치를 확정한 부품 정의가 아닙니다."]
    if not matched:
        warnings.append("MODEL_NOT_FOUND: 요청한 정확한 모델명을 문서 텍스트에서 확인하지 못했습니다.")
    if len(text.strip()) < 80:
        warnings.append("OCR_REQUIRED: 스캔/이미지 문서의 텍스트를 읽지 못했습니다. OCR 또는 원문 검토가 필요합니다.")
    if document["truncated"]:
        warnings.append("DOCUMENT_TRUNCATED: 페이지/텍스트 제한으로 일부만 분석했습니다.")
    is_official = official_domain(fetched["url"], manufacturer)
    if not is_official:
        warnings.append("OFFICIAL_SOURCE_UNCONFIRMED: 제조사와 공식 도메인의 대응을 확인하지 못했습니다.")
    patterns = {"pin_information": r"\bpin\b|pinout|terminal|핀",
                "recommended_operation": r"recommended operating|operating voltage|supply voltage|권장|동작 전압",
                "absolute_maximum": r"absolute maximum|절대 최대",
                "current_or_interface": r"\bcurrent\b|\bI2C\b|\bSPI\b|UART|전류"}
    evidence = []
    for category, pattern in patterns.items():
        selected = 0
        for page in document["pages"]:
            lines = page["text"].splitlines()
            for index, line in enumerate(lines):
                if re.search(pattern, line, re.I):
                    excerpt = "\n".join(lines[max(0, index - 1):index + 3]).strip()[:600]
                    if excerpt:
                        evidence.append({"category": category, "page": page["page"], "excerpt": excerpt})
                        selected += 1
                    if selected >= 3:
                        break
            if selected >= 3:
                break
    return {"source": {"title": document["title"] or model + " source document", "reference": fetched["url"],
                       "revision": None, "page": None, "sha256": hashlib.sha256(body).hexdigest(), "retrieved_at": now()},
            "requested_model": model, "model_match": matched, "official_domain_match": is_official,
            "document_date_raw": document["document_date"], "total_pages": document["total_pages"],
            "analyzed_pages": len(document["pages"]), "evidence": evidence,
            "verification_status": "unverified", "warnings": warnings,
            "unresolved_fields": ["exact_model_and_revision", "package_and_pin_numbers", "pin_directions", "recommended_voltage_and_current", "logic_levels", "required_auxiliary_parts"]}


class ResearchService:
    def __init__(self, store, fetcher=fetch_public, analyzer=None):
        self.store = store
        self.fetcher = fetcher
        self.analyzer = analyzer or (lambda url, model, maker: analyze_document(url, model, maker, fetcher=self.fetcher))
        self.pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="component-research")
        self.slots = threading.BoundedSemaphore(6)
        # A single server worker is supported. Interrupted work is explicitly failed on restart.
        for owner, job in self.store.unfinished_jobs():
            job.status, job.updated_at = "failed", now()
            job.error = {"code": "SERVER_RESTARTED", "message": "서버 재시작으로 작업이 중단됐습니다. 새 작업으로 요청하세요."}
            self.store.save_job(job, owner)

    def discover(self, request):
        urls = list(request.source_urls)
        methods = ["user_url"] if urls else []
        # Known official document URL conventions are probed; successful responses are still checked for the exact model.
        model = request.model.strip().lower()
        maker = (request.manufacturer or "").strip().lower()
        if re.fullmatch(r"[a-z0-9-]+", model):
            if maker in ("ti", "texas instruments"):
                urls.append(f"https://www.ti.com/lit/ds/symlink/{model}.pdf")
                methods.append("official_ti_document_probe")
            elif maker in ("st", "stmicroelectronics"):
                urls.append(f"https://www.st.com/resource/en/datasheet/{model}.pdf")
                methods.append("official_st_document_probe")
        from .local_connection import env_settings
        key = env_settings(ROOT).get("BRAVE_SEARCH_API_KEY")
        secrets_file = ROOT / "config" / "research-secrets.json"
        if not key and secrets_file.exists():
            key = json.loads(secrets_file.read_text(encoding="utf-8")).get("brave_search_api_key")
        if key:
            query = f'"{request.model}" {request.manufacturer or ""} official datasheet'
            fetched = self.fetcher("https://api.search.brave.com/res/v1/web/search?" + urlencode({"q": query, "count": 8}),
                                   max_bytes=1_000_000, headers={"X-Subscription-Token": key})
            results = json.loads(fetched["body"]).get("web", {}).get("results", [])
            result_urls = [item["url"] for item in results if isinstance(item.get("url"), str)
                           and item["url"].startswith("https://") and len(item["url"]) <= 2000]
            confirmed = [url for url in result_urls if official_domain(url, request.manufacturer)]
            urls.extend(confirmed)
            # 새 펌프·센서 제조사는 도메인 사전에 없을 수 있다. 출처 미확인 후보로 수집한다.
            if maker not in DOMAINS and not confirmed:
                urls.extend(result_urls)
                methods.append("brave_unconfirmed_sources")
            methods.append("brave_official_domain_search")
        if not urls:
            raise ResearchError("SEARCH_CONFIGURATION_OR_SOURCE_URL_REQUIRED")
        return list(dict.fromkeys(urls))[:3], methods

    def submit(self, kind, request, owner):
        if not self.slots.acquire(blocking=False):
            raise ResearchError("RESEARCH_QUEUE_FULL")
        job = JobRecord(id=str(uuid4()), kind=kind, status="queued", created_at=now(), updated_at=now())
        try:
            self.store.save_job(job, owner, create=True)
            self.pool.submit(self.execute, job, request, owner)
        except Exception:
            self.slots.release()
            raise
        return job

    def execute(self, job, request, owner):
        try:
            job.status, job.updated_at = "running", now()
            self.store.save_job(job, owner)
            if job.kind == "datasheet":
                result = self.analyzer(request.url, request.model, request.manufacturer)
                job.result = result
            else:
                urls, methods = self.discover(request)
                analyses, failures = [], []
                for url in urls:
                    try:
                        analyses.append(self.analyzer(url, request.model, request.manufacturer))
                    except Exception as exc:
                        failures.append({"url": url, "code": str(exc) if isinstance(exc, (ResearchError, FetchError)) else "DOCUMENT_ANALYSIS_FAILED"})
                if not analyses:
                    job.result = {"methods": methods, "failures": failures}
                    raise ResearchError("NO_READABLE_SOURCE")
                candidate = CandidateRecord(id=str(uuid4()), job_id=job.id, requested_model=request.model,
                                            manufacturer=request.manufacturer, analyses=analyses,
                                            warnings=["검토 전 후보입니다. 부품 DB에 아직 등록되지 않았습니다."])
                self.store.add_candidate(candidate, owner)
                job.result = {"candidate_id": candidate.id, "candidate_status": candidate.status, "methods": methods,
                              "sources_analyzed": len(analyses), "failures": failures}
            job.status = "completed"
        except Exception as exc:
            job.status = "failed"
            job.error = {"code": str(exc) if isinstance(exc, (ResearchError, FetchError)) else "RESEARCH_FAILED",
                         "message": "조사를 완료하지 못했습니다. 공식 문서 URL, 검색 설정, 문서 형식과 네트워크를 확인하세요."}
        finally:
            job.updated_at = now()
            self.store.save_job(job, owner)
            self.slots.release()
