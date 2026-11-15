"""Authenticated Streamable HTTP MCP tools backed by the existing REST contract."""
from contextlib import asynccontextmanager
import json
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import time
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.fastmcp.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import Field, ValidationError
from typing import Annotated
from starlette.datastructures import Headers
from starlette.responses import JSONResponse

from .models import (CircuitDraft, CircuitUpdate, DatasheetRequest, ResearchRequest, ImageRequest, SvgSaveRequest,
                     ImagePresentation, ImageSpecRequest, ComponentCreateRequest, KiCadImport, KiCadChecks)

PositiveVersion = Annotated[int, Field(ge=1)]


class KeyAuthMiddleware:
    def __init__(self, app, authenticate):
        self.app = app
        self.authenticate = authenticate
        self.logger = logging.getLogger("circuit.mcp.requests")
        self.logger.setLevel(logging.INFO)
        self.logger.propagate = False
        if not self.logger.handlers:
            logs = Path(__file__).resolve().parents[1] / "logs"
            logs.mkdir(exist_ok=True)
            handler = RotatingFileHandler(logs / "mcp-requests.log", maxBytes=1_000_000, backupCount=2, encoding="utf-8")
            handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
            self.logger.addHandler(handler)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = Headers(scope=scope)
            start = time.monotonic()
            status = 500
            rpc_method = "unread"
            body = bytearray()

            async def inspect_receive():
                nonlocal rpc_method
                message = await receive()
                if message["type"] == "http.request":
                    if len(body) < 100_000:
                        body.extend(message.get("body", b"")[:100_000 - len(body)])
                    if not message.get("more_body", False):
                        try:
                            parsed = json.loads(body)
                            method = parsed.get("method") if isinstance(parsed, dict) else None
                            rpc_method = method if method in ("initialize", "notifications/initialized", "tools/list", "tools/call", "ping") else "other"
                        except (ValueError, UnicodeError):
                            rpc_method = "invalid-json"
                return message

            async def inspect_send(message):
                nonlocal status
                if message["type"] == "http.response.start":
                    status = message["status"]
                await send(message)

            try:
                try:
                    self.authenticate(headers.get("x-api-key"))
                except HTTPException as exc:
                    await JSONResponse({"detail": exc.detail}, status_code=exc.status_code)(scope, receive, inspect_send)
                    return
                await self.app(scope, inspect_receive, inspect_send)
            finally:
                # No credentials, query strings, tool arguments or circuit data are logged.
                record = {"http_method": scope["method"], "path": scope.get("path"), "rpc_method": rpc_method,
                          "status": status, "key_present": bool(headers.get("x-api-key")),
                          "user_agent": headers.get("user-agent", "")[:200],
                          "accept": headers.get("accept", "")[:150], "duration_ms": round((time.monotonic() - start) * 1000)}
                self.logger.info(json.dumps(record, ensure_ascii=False))
        else:
            await self.app(scope, receive, send)


def attach_mcp(app, authenticate):
    # Dev Tunnels rewrites Host and Origin to localhost; keep DNS-rebinding checks enabled.
    mcp = FastMCP(
        "Circuit Agent", stateless_http=True, json_response=True,
        instructions="가상 테스트 부품을 사용하는 회로 도구입니다. 실제 배선용이 아닙니다. unknown을 passed로 해석하지 마세요.",
        transport_security=TransportSecuritySettings(
            allowed_hosts=["127.0.0.1", "127.0.0.1:*", "localhost", "localhost:*", "testserver"],
            allowed_origins=["http://127.0.0.1:*", "http://localhost", "http://localhost:*", "https://localhost", "https://localhost:*"],
        ),
    )
    read = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
    write = ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)

    async def call(ctx: Context, method: str, path: str, body=None, params=None):
        request = ctx.request_context.request
        if request is None:
            raise ToolError("Authenticated HTTP request required")
        key = request.headers.get("x-api-key")
        # Each tool call forwards its own request key. No shared user/owner state.
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as client:
            response = await client.request(method, path, headers={"X-API-Key": key or ""}, json=body, params=params)
        if response.status_code >= 400:
            raise ToolError(json.dumps({"http_status": response.status_code, "error": response.json()}, ensure_ascii=False))
        # JSON text avoids reference/dynamic object output schemas in Copilot Studio.
        return json.dumps(response.json(), ensure_ascii=False)

    @mcp.tool(name="SearchComponents", annotations=read)
    async def search_components(ctx: Context, q: str = "", limit: Annotated[int, Field(ge=1, le=100)] = 20,
                                offset: Annotated[int, Field(ge=0, le=10000)] = 0) -> str:
        """DB의 부품을 모델명·제조사·ID로 검색합니다. 인터넷 검색은 하지 않습니다."""
        return await call(ctx, "GET", "/components/search", params={"q": q, "limit": limit, "offset": offset})

    @mcp.tool(name="CreateComponent", annotations=write)
    async def create_component(ctx: Context, component_json: str) -> str:
        """DB에 없는 부품을 미검증 설계 부품으로 저장하고 재사용 가능한 id를 반환합니다. component_json은 request_id(8~80자 영문/숫자/-/_), model, category, manufacturer, revision, pins, source_references, notes, unresolved_fields 및 선택 candidate_id를 담은 JSON 문자열입니다. 핀을 모르면 pins=[]로 외형 초안부터 저장하며 사양을 추측하지 않습니다. 같은 요청 재확인은 같은 request_id를 사용합니다. 반환 id로 이미지 제작·저장·적용과 회로 설계를 계속하세요. 후보 승인 도구가 아닙니다."""
        try:
            request = ComponentCreateRequest.model_validate_json(component_json)
        except ValidationError as exc:
            raise ToolError("INVALID_COMPONENT_JSON: " + exc.json(include_input=False, include_url=False)) from None
        return await call(ctx, "POST", "/components", request.model_dump(mode="json"))

    @mcp.tool(name="GetComponentDetails", annotations=read)
    async def get_component_details(ctx: Context, component_id: str) -> str:
        """부품 ID의 핀·전압 제한·출처·가상 부품 여부를 조회합니다."""
        return await call(ctx, "GET", f"/components/{quote(component_id, safe='')}")

    @mcp.tool(name="CreateCircuitDraft", annotations=write)
    async def create_circuit_draft(ctx: Context, draft_json: str) -> str:
        """회로 JSON 문자열(name, requirements, component_instances, nets, layout)을 새 초안으로 저장합니다. 중복 호출하면 새 회로가 생성됩니다."""
        try:
            draft = CircuitDraft.model_validate_json(draft_json)
        except ValidationError as exc:
            raise ToolError("INVALID_CIRCUIT_JSON: " + exc.json(include_input=False, include_url=False)) from None
        return await call(ctx, "POST", "/circuits", draft.model_dump(mode="json"))

    @mcp.tool(name="GetCircuitStatus", annotations=read)
    async def get_circuit_status(ctx: Context, circuit_id: str) -> str:
        """현재 사용자의 최신 회로·버전·검증 결과를 조회합니다."""
        return await call(ctx, "GET", f"/circuits/{quote(circuit_id, safe='')}")

    @mcp.tool(name="UpdateCircuit", annotations=write)
    async def update_circuit(ctx: Context, circuit_id: str, update_json: str) -> str:
        """expected_version과 전체 초안 필드를 포함한 JSON 문자열로 회로를 교체합니다. 검증 결과를 초기화하며 재검증이 필요합니다."""
        try:
            update = CircuitUpdate.model_validate_json(update_json)
        except ValidationError as exc:
            raise ToolError("INVALID_CIRCUIT_JSON: " + exc.json(include_input=False, include_url=False)) from None
        return await call(ctx, "PUT", f"/circuits/{quote(circuit_id, safe='')}", update.model_dump(mode="json"))

    @mcp.tool(name="ValidateCircuit", annotations=write)
    async def validate_circuit(ctx: Context, circuit_id: str, expected_version: PositiveVersion) -> str:
        """지정 버전의 연결·정적 전압 규칙을 검사해 passed/failed/unknown 결과를 저장합니다. 실제 안전 보증이 아닙니다."""
        return await call(ctx, "POST", f"/circuits/{quote(circuit_id, safe='')}/validate", {"expected_version": expected_version})

    @mcp.tool(name="ApplyCircuitLayout", annotations=write)
    async def apply_circuit_layout(ctx: Context, circuit_id: str, expected_version: PositiveVersion,
                                   allow_unvalidated_draft: bool = False) -> str:
        """편집기 반영 버전을 기록합니다. 미통과 회로는 초안 표시 의도가 있을 때만 allow_unvalidated_draft=true로 호출합니다."""
        return await call(ctx, "POST", f"/circuits/{quote(circuit_id, safe='')}/apply",
                          {"expected_version": expected_version, "allow_unvalidated_draft": allow_unvalidated_draft})

    research_write = ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=True)

    @mcp.tool(name="ResearchComponent", annotations=research_write)
    async def research_component(ctx: Context, model: str, manufacturer: str = "", source_urls_json: str = "[]") -> str:
        """제조사 공식 데이터시트를 조사하는 비동기 작업을 만듭니다. source_urls_json은 HTTPS URL 배열의 JSON 문자열입니다. 반환된 id로 GetJobStatus를 호출하세요. 결과는 검토 전 후보이며 자동 승인되지 않습니다."""
        try:
            request = ResearchRequest(model=model, manufacturer=manufacturer or None, source_urls=json.loads(source_urls_json))
        except (ValidationError, ValueError, TypeError):
            raise ToolError("INVALID_RESEARCH_INPUT") from None
        return await call(ctx, "POST", "/components/research", request.model_dump(mode="json"))

    @mcp.tool(name="AnalyzeDatasheet", annotations=research_write)
    async def analyze_datasheet(ctx: Context, url: str, model: str, manufacturer: str = "") -> str:
        """공개 HTTPS PDF/HTML을 비동기 분석해 페이지별 근거 발췌와 미확인 항목을 반환합니다. 자동 핀 확정/OCR/안전 보증은 하지 않습니다. 반환된 id로 GetJobStatus를 조회하세요."""
        request = DatasheetRequest(url=url, model=model, manufacturer=manufacturer or None)
        return await call(ctx, "POST", "/datasheets/analyze", request.model_dump(mode="json"))

    @mcp.tool(name="GetJobStatus", annotations=read)
    async def get_job_status(ctx: Context, job_id: str) -> str:
        """조사·문서·이미지·KiCad 파일 검증 작업의 queued/running/completed/failed 상태와 결과를 조회합니다. running이면 무한 반복을 피하고 잠시 후 재조회합니다. job completed와 실제 ERC/ngspice 통과 여부는 구분하세요."""
        return await call(ctx, "GET", f"/jobs/{quote(job_id, safe='')}")

    @mcp.tool(name="ListComponentCandidates", annotations=read)
    async def list_component_candidates(ctx: Context) -> str:
        """현재 연결 소유자의 조사 후보 목록을 조회합니다. pending_review 후보를 검증된 부품으로 사용하지 마세요."""
        return await call(ctx, "GET", "/component-candidates")

    @mcp.tool(name="GetComponentCandidate", annotations=read)
    async def get_component_candidate(ctx: Context, candidate_id: str) -> str:
        """후보의 출처·페이지별 근거·미확인 사항과 사람 검토 상태를 조회합니다. 승인 기능은 제공하지 않습니다."""
        return await call(ctx, "GET", f"/component-candidates/{quote(candidate_id, safe='')}")

    @mcp.tool(name="GetImageGenerationConfig", annotations=read)
    async def image_config(ctx: Context) -> str:
        """이미지 생성 키 설정 여부·SVG 형식·모델·팀 프롬프트 출처를 조회합니다. 키 값은 반환하지 않습니다."""
        return await call(ctx, "GET", "/component-images/config")

    @mcp.tool(name="GetComponentImageSpec", annotations=read)
    async def get_component_image_spec(ctx: Context, component_id: str = "", candidate_id: str = "", presentation_json: str = "null") -> str:
        """제작 크기·핀 좌표·최신 기본 그림 디자인 양식을 조회합니다. component_id/candidate_id 중 하나를 지정합니다. presentation_json은 선택 JSON 문자열: {kind:pcb 또는 bare,color:#RRGGBB,pin_sides:{핀ID:left/right/top/bottom}}. 반환 presentation을 SaveComponentSvg 요청에 복사하세요. 몸체의 작은 text와 재료 클래스 지원. 별도 이미지 서비스 키 불필요."""
        try:
            raw = json.loads(presentation_json)
            request = ImageSpecRequest(component_id=component_id or None, candidate_id=candidate_id or None,
                                       presentation=ImagePresentation.model_validate(raw) if raw is not None else None)
        except (ValidationError, ValueError, TypeError):
            raise ToolError("INVALID_IMAGE_PRESENTATION") from None
        return await call(ctx, "POST", "/component-images/spec", request.model_dump(mode="json"))

    @mcp.tool(name="SaveComponentSvg", annotations=write)
    async def save_component_svg(ctx: Context, request_json: str) -> str:
        """Copilot이 만든 SVG를 검사·저장합니다. JSON 문자열에 component_id 또는 candidate_id 하나, appearance(10자 이상), request_id(8~80자 영문/숫자/-/_), svg, GetComponentImageSpec에서 받은 presentation을 넣습니다. 몸체 text와 허용 재료 클래스를 지원합니다. 반환된 result.asset_id로 ApplyComponentImage를 호출합니다. 외부 이미지 API 키 불필요. 후보는 미리보기만 가능."""
        try:
            request = SvgSaveRequest.model_validate_json(request_json)
        except ValidationError as exc:
            raise ToolError("INVALID_SVG_REQUEST: " + exc.json(include_input=False, include_url=False)) from None
        return await call(ctx, "POST", "/component-images/svg", request.model_dump(mode="json"))

    @mcp.tool(name="GenerateComponentImage", annotations=research_write)
    async def generate_component_image(ctx: Context, request_json: str) -> str:
        """팀 프롬프트로 부품 SVG 외형을 생성하는 유료 API 작업입니다. JSON 문자열에 component_id 또는 candidate_id 하나, appearance(10~2000자), request_id(영문/숫자/-/_, 8~80자)를 넣습니다. 같은 요청 재조회에는 같은 request_id를 사용해 중복 생성을 막습니다. 작업 id로 GetJobStatus를 조회하세요. 후보 이미지는 미리보기 전용이며 핀·정격을 확정하지 않습니다."""
        try:
            request = ImageRequest.model_validate_json(request_json)
        except ValidationError as exc:
            raise ToolError("INVALID_IMAGE_REQUEST: " + exc.json(include_input=False, include_url=False)) from None
        return await call(ctx, "POST", "/component-images/generate", request.model_dump(mode="json"))

    @mcp.tool(name="ListComponentImages", annotations=read)
    async def list_component_images(ctx: Context, limit: Annotated[int, Field(ge=1, le=100)] = 50) -> str:
        """현재 소유자의 생성 이미지 목록·대상 부품·작업 상태를 조회합니다. 재생성 전에 기존 이미지를 확인하세요."""
        return await call(ctx, "GET", "/component-images", params={"limit": limit})

    @mcp.tool(name="GetComponentImage", annotations=read)
    async def get_component_image(ctx: Context, asset_id: str) -> str:
        """이미지 ID의 생성 상태·크기·편집기 핀 좌표·해시를 조회합니다. 그림 자체는 미르가 인증된 content API로 불러옵니다."""
        return await call(ctx, "GET", f"/component-images/{quote(asset_id, safe='')}")

    @mcp.tool(name="ApplyComponentImage", annotations=write)
    async def apply_component_image(ctx: Context, component_id: str, asset_id: str) -> str:
        """완료된 해당 부품의 이미지를 현재 소유자의 미르 표시용으로 선택합니다. 핀·정격·회로 버전은 바꾸지 않습니다. 후보 이미지는 적용할 수 없으며 등록 부품 ID로 새로 생성해야 합니다."""
        return await call(ctx, "PUT", f"/components/{quote(component_id, safe='')}/image", {"asset_id": asset_id})

    @mcp.tool(name="GetCircuitVerificationConfig", annotations=read)
    async def verification_config(ctx: Context) -> str:
        """가져온 KiCad 파일 검증용 kicad-cli/ngspice 실행 파일의 준비 여부와 지원 분석 종류를 조회합니다. 실행되지 않은 검사를 통과로 표현하지 마세요."""
        return await call(ctx, "GET", "/verification/config")

    @mcp.tool(name="ImportKiCadProject", annotations=write)
    async def import_kicad_project(ctx: Context, project_json: str) -> str:
        """KiCad 회로도와 함께 제공된 모델/하위 회로도 텍스트를 저장합니다. JSON 문자열: name, main_file, files:[{name,content}]. 서버 로컬 경로를 읽는 도구가 아닙니다. 사용자가 제공한 파일만 사용하세요. 반환 id가 project_id입니다. 미르 웹의 파일 가져오기를 사용해도 됩니다."""
        try:
            body = KiCadImport.model_validate_json(project_json)
        except ValidationError as exc:
            raise ToolError("INVALID_KICAD_IMPORT: " + exc.json(include_input=False, include_url=False)) from None
        return await call(ctx, "POST", "/verification/projects", body.model_dump(mode="json"))

    @mcp.tool(name="GetKiCadProject", annotations=read)
    async def get_kicad_project(ctx: Context, project_id: str) -> str:
        """현재 소유자가 가져온 KiCad 프로젝트의 주 회로도·파일 목록·해시를 조회합니다. 미르 DB 회로 ID와 구분하세요."""
        return await call(ctx, "GET", f"/verification/projects/{quote(project_id, safe='')}")

    @mcp.tool(name="VerifyKiCadProject", annotations=write)
    async def verify_kicad_project(ctx: Context, project_id: str, checks_json: str = "{}") -> str:
        """가져온 KiCad 프로젝트에 ERC와 선택 ngspice 검사를 비동기로 실행합니다. JSON 문자열: run_erc(기본 true), run_ngspice(기본 false), analysis(op/transient), timestep, duration, vectors(예: [v(out),i(V1)]의 문자열 배열). 작업 id로 GetJobStatus를 조회합니다. 모델/실행 파일 누락은 unavailable/unsupported이며 통과가 아닙니다. 미르 DB 회로 검증 상태는 바꾸지 않습니다."""
        try:
            body = KiCadChecks.model_validate_json(checks_json)
        except ValidationError as exc:
            raise ToolError("INVALID_KICAD_CHECKS: " + exc.json(include_input=False, include_url=False)) from None
        return await call(ctx, "POST", f"/verification/projects/{quote(project_id, safe='')}/verify", body.model_dump(mode="json"))

    http_app = mcp.streamable_http_app()
    previous_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(application):
        async with previous_lifespan(application):
            async with mcp.session_manager.run():
                yield

    app.router.lifespan_context = lifespan
    # Mount last at / so /mcp works without redirect and existing REST routes retain priority.
    app.mount("/", KeyAuthMiddleware(http_app, authenticate))
