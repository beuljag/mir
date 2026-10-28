import hmac
import json
import os
import sqlite3
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Security
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from .local_connection import attach_local_connection, env_settings, load_api_keys, ORIGINS

from .models import (ApplyRequest, ApplyResult, CircuitDraft, CircuitRecord, CircuitUpdate,
                     ComponentDefinition, ResearchRequest, ResearchResult, SimulationResult,
                     ValidationResult, VersionRequest, CandidateRecord, DatasheetRequest, JobRecord, ReviewRequest)
from .research import ResearchError, ResearchService, now
from .storage import Store, VersionConflict
from .validation import validate

ROOT = Path(__file__).resolve().parent.parent
key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def create_app(db_path=None, api_keys=None):
    # A key-to-owner mapping permits isolation without trusting a user-supplied owner header.
    if api_keys is not None:
        keys = api_keys
        auto_key = next(iter(keys), '')
    else:
        keys, auto_key = load_api_keys(ROOT)
    if not isinstance(keys, dict) or not keys or any(not isinstance(k, str) or len(k) < 24 or not isinstance(v, str) or not v for k, v in keys.items()):
        raise RuntimeError("Configure CIRCUIT_API_KEYS or config/local-api-keys.json with 24+ character API keys mapped to owner IDs.")
    store = Store(db_path or os.getenv("CIRCUIT_DB_PATH", str(ROOT / "data" / "circuits.db")))
    research_service = ResearchService(store)
    app = FastAPI(title="Circuit Agent API", version="0.2.0", description="회로 API와 공식 자료 조사·문서 분석·사람 검토. 기본 샘플은 가상 테스트 전용입니다.")
    app.state.research = research_service
    app.add_middleware(CORSMiddleware, allow_origins=list(ORIGINS), allow_methods=['GET', 'POST'],
                       allow_headers=['Content-Type'])

    def owner(api_key: Annotated[str | None, Security(key_header)]):
        if api_key:
            for candidate, owner_id in keys.items():
                if hmac.compare_digest(api_key.encode(), candidate.encode()):
                    return owner_id
        raise HTTPException(401, detail={"code": "INVALID_API_KEY", "message": "유효한 X-API-Key가 필요합니다."})

    User = Annotated[str, Depends(owner)]

    def load(circuit_id, user, version=None):
        circuit = store.get(circuit_id, user)
        if circuit is None:
            raise HTTPException(404, detail={"code": "CIRCUIT_NOT_FOUND"})
        if version is not None and circuit.version != version:
            raise HTTPException(409, detail={"code": "VERSION_CONFLICT", "current_version": circuit.version})
        return circuit

    @app.exception_handler(VersionConflict)
    async def conflict_handler(request: Request, exc: VersionConflict):
        return JSONResponse(status_code=409, content={"detail": {"code": "VERSION_CONFLICT", "message": "최신 회로를 다시 조회하세요."}})

    @app.get("/health", operation_id="Health", tags=["system"])
    def health():
        return {"status": "ok", "version": "0.2.0"}

    @app.get("/", include_in_schema=False)
    def console():
        return FileResponse(ROOT / "static" / "index.html")

    @app.get("/review", include_in_schema=False)
    def review_console():
        return FileResponse(ROOT / "static" / "review.html")

    @app.get("/components/search", response_model=list[ComponentDefinition], operation_id="SearchComponents", tags=["components"],
             description="DB에서 모델/제조사/ID를 검색합니다. 빈 검색어는 전체 샘플 목록을 반환합니다.")
    def search(user: User, q: str = Query(default="", max_length=200), limit: int = Query(default=20, ge=1, le=100),
               offset: int = Query(default=0, ge=0, le=10000)):
        return [c for c in store.components(user).values() if q.casefold() in f"{c.id} {c.model} {c.manufacturer}".casefold()][offset:offset + limit]

    @app.get("/components/{component_id}", response_model=ComponentDefinition, operation_id="GetComponentDetails", tags=["components"])
    def details(component_id: str, user: User):
        component = store.components(user).get(component_id)
        if component is None:
            raise HTTPException(404, detail={"code": "COMPONENT_NOT_FOUND"})
        return component

    @app.post("/components/research", response_model=JobRecord, operation_id="ResearchComponent", tags=["research"], status_code=202)
    def research(body: ResearchRequest, user: User):
        try:
            return app.state.research.submit("research", body, user)
        except ResearchError as exc:
            raise HTTPException(429, detail={"code": str(exc)}) from None

    @app.post("/datasheets/analyze", response_model=JobRecord, operation_id="AnalyzeDatasheet", tags=["research"], status_code=202)
    def analyze(body: DatasheetRequest, user: User):
        try:
            return app.state.research.submit("datasheet", body, user)
        except ResearchError as exc:
            raise HTTPException(429, detail={"code": str(exc)}) from None

    @app.get("/jobs/{job_id}", response_model=JobRecord, operation_id="GetJobStatus", tags=["research"])
    def job_status(job_id: str, user: User):
        job = store.get_job(job_id, user)
        if job is None:
            raise HTTPException(404, detail={"code": "JOB_NOT_FOUND"})
        return job

    @app.get("/component-candidates", response_model=list[CandidateRecord], operation_id="ListComponentCandidates", tags=["research"])
    def candidates(user: User, limit: int = Query(default=50, ge=1, le=100)):
        return store.list_candidates(user, limit)

    @app.get("/component-candidates/{candidate_id}", response_model=CandidateRecord, operation_id="GetComponentCandidate", tags=["research"])
    def candidate_detail(candidate_id: str, user: User):
        candidate = store.get_candidate(candidate_id, user)
        if candidate is None:
            raise HTTPException(404, detail={"code": "CANDIDATE_NOT_FOUND"})
        return candidate

    @app.post("/component-candidates/{candidate_id}/review", response_model=CandidateRecord,
              operation_id="ReviewComponentCandidate", tags=["human-review"])
    def review_candidate(candidate_id: str, body: ReviewRequest, user: User,
                         review_key: Annotated[str | None, Security(APIKeyHeader(name="X-Review-Key", scheme_name="HumanReviewKey", auto_error=False))]):
        review_path = ROOT / "config" / "local-review-key.json"
        configured = env_settings(ROOT).get("CIRCUIT_REVIEW_KEY")
        if not configured and review_path.exists():
            configured = json.loads(review_path.read_text(encoding="utf-8")).get("review_key")
        if not configured or not review_key or not hmac.compare_digest(configured.encode(), review_key.encode()):
            raise HTTPException(403, detail={"code": "HUMAN_REVIEW_KEY_REQUIRED"})
        candidate = candidate_detail(candidate_id, user)
        if candidate.status != "pending_review" or candidate.version != body.expected_version:
            raise HTTPException(409, detail={"code": "CANDIDATE_VERSION_OR_STATE_CONFLICT"})
        component = body.component if body.decision == "approve" else None
        if component:
            if component.id.startswith("draft-"):
                raise HTTPException(422, detail={"code": "DRAFT_ID_RESERVED", "message": "승인 부품에는 draft-로 시작하지 않는 새 ID를 사용하세요."})
            if component.model.casefold() != candidate.requested_model.casefold():
                raise HTTPException(422, detail={"code": "MODEL_MISMATCH"})
            evidence = {(analysis["source"]["reference"], analysis["source"]["sha256"])
                        for analysis in candidate.analyses if analysis.get("model_match")}
            if not evidence or any((source.reference, source.sha256) not in evidence or not source.page
                                   for source in component.source_references):
                raise HTTPException(422, detail={"code": "REVIEW_SOURCE_EVIDENCE_REQUIRED", "message": "모델이 확인된 원문 URL·SHA256 및 검토 페이지를 지정하세요."})
        candidate.status = "approved" if component else "rejected"
        candidate.version += 1
        candidate.review = {"reviewed_at": now(), "reviewer_owner": user, "notes": body.reviewer_notes,
                            "component_id": component.id if component else None,
                            "confirmed_model_revision": body.confirmed_model_revision,
                            "confirmed_pinout": body.confirmed_pinout,
                            "confirmed_electrical_limits": body.confirmed_electrical_limits}
        try:
            store.review_candidate(candidate, user, body.expected_version, component)
        except sqlite3.IntegrityError:
            raise HTTPException(409, detail={"code": "COMPONENT_ID_ALREADY_EXISTS", "message": "새 부품/리비전 ID를 사용하세요. 기존 정의는 덮어쓰지 않습니다."}) from None
        return candidate

    @app.post("/circuits", response_model=CircuitRecord, status_code=201, operation_id="CreateCircuitDraft", tags=["circuits"])
    def create(body: CircuitDraft, user: User):
        circuit = CircuitRecord(**body.model_dump(), id=str(uuid4()), version=1)
        store.create(circuit, user)
        return circuit

    @app.get("/circuits/{circuit_id}", response_model=CircuitRecord, operation_id="GetCircuitStatus", tags=["circuits"])
    def get(circuit_id: str, user: User):
        return load(circuit_id, user)

    @app.put("/circuits/{circuit_id}", response_model=CircuitRecord, operation_id="UpdateCircuit", tags=["circuits"],
             description="전체 회로 교체. expected_version 필수. 변경 시 검증 결과와 반영 상태를 초기화합니다.")
    def update(circuit_id: str, body: CircuitUpdate, user: User):
        current = load(circuit_id, user, body.expected_version)
        circuit = CircuitRecord(**body.model_dump(exclude={"expected_version"}), id=circuit_id, version=current.version + 1)
        store.save(circuit, user, current.version)
        return circuit

    @app.post("/circuits/{circuit_id}/validate", response_model=ValidationResult, operation_id="ValidateCircuit", tags=["circuits"])
    def check(circuit_id: str, body: VersionRequest, user: User):
        circuit = load(circuit_id, user, body.expected_version)
        result = validate(circuit, store.components(user))
        circuit.validation_result = result
        circuit.status = result.status
        store.save(circuit, user, circuit.version)
        return result

    @app.post("/circuits/{circuit_id}/apply", response_model=ApplyResult, operation_id="ApplyCircuitLayout", tags=["circuits"],
              description="현재 회로를 내장 편집기에 반영합니다. passed 이외에는 명시적 초안 반영 옵션이 필요합니다.")
    def apply(circuit_id: str, body: ApplyRequest, user: User):
        circuit = load(circuit_id, user, body.expected_version)
        if circuit.status != "passed" and not body.allow_unvalidated_draft:
            raise HTTPException(409, detail={"code": "DRAFT_CONFIRMATION_REQUIRED", "status": circuit.status})
        circuit.applied_version = circuit.version
        store.save(circuit, user, circuit.version)
        return ApplyResult(circuit_id=circuit.id, version=circuit.version, status=circuit.status, editor_url=f"/mir/?circuit={circuit.id}")

    @app.post("/circuits/{circuit_id}/simulate", response_model=SimulationResult, operation_id="SimulateCircuit", tags=["future"], status_code=501)
    def simulate(circuit_id: str, body: VersionRequest, user: User):
        circuit = load(circuit_id, user, body.expected_version)
        return SimulationResult(circuit_id=circuit.id, version=circuit.version, reason="SPICE 모델과 실행 어댑터가 연결되지 않아 시뮬레이션을 실행하지 않았습니다.")

    from .component_catalog import attach_component_catalog
    attach_component_catalog(app, store, owner)
    from .component_images import attach_component_images
    attach_component_images(app, store, owner, ROOT)
    attach_local_connection(app, auto_key)
    from .directline_chat import attach_chat
    attach_chat(app, owner)
    from .mir_web import attach_mir
    attach_mir(app)
    from .mcp_server import attach_mcp
    attach_mcp(app, owner)
    original_openapi = app.openapi

    def openapi_contract():
        schema = original_openapi()
        # The review endpoint requires BOTH credentials, not OpenAPI's default OR list.
        schema["paths"]["/component-candidates/{candidate_id}/review"]["post"]["security"] = [{"APIKeyHeader": [], "HumanReviewKey": []}]
        return schema

    app.openapi = openapi_contract
    return app
