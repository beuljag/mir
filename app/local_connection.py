"""8002번 로컬 전용 연결이 .env의 키로 기존 API를 대신 호출한다."""
import json
import os
import re
from collections import deque
from pathlib import Path
from time import monotonic

import httpx
from dotenv import dotenv_values
from fastapi import HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

ROOT = Path(__file__).resolve().parents[1]
LOCAL_PORT = 8002
ORIGINS = {'http://127.0.0.1:8000', 'http://localhost:8000'}
ROUTES = re.compile(r'^/(?:chat/(?:config|diagnostics|sessions(?:/[a-f0-9]+(?:/messages(?:/[a-f0-9]+)?)?)?)|verification/(?:config|projects(?:/[a-f0-9]{32}(?:/verify)?)?|jobs/[a-f0-9-]+/artifacts/(?:erc\.json|erc\.log|export\.cir|export\.log|run\.cir|ngspice\.log))|jobs/[a-f0-9-]+|components/search(?:\?limit=100(?:&offset=[0-9]{1,5})?)?|components/[a-zA-Z0-9_.%-]+(?:/image(?:\?optional=true)?)?|circuits(?:/[a-zA-Z0-9-]+(?:/validate)?)?)$')


def env_settings(root=None):
    return {**dotenv_values((root or ROOT) / '.env', interpolate=False), **os.environ}


def load_api_keys(root=None):
    root = root or ROOT
    values = env_settings(root)
    if values.get('CIRCUIT_API_KEYS'):
        keys = json.loads(values['CIRCUIT_API_KEYS'])
    else:
        path = root / 'config' / 'local-api-keys.json'
        keys = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    key = values.get('CIRCUIT_API_KEY')
    if key:
        keys[key] = values.get('CIRCUIT_API_OWNER') or keys.get(key, 'local-user')
    return keys, key or next(iter(keys), '')


def require_local(request: Request):
    server = request.scope.get('server')
    # Socket port is not derived from Host/Forwarded headers. The public tunnel targets 8000 only.
    if not server or server[1] != LOCAL_PORT:
        raise HTTPException(403, detail={'code': 'LOCAL_CONNECTION_ONLY'})
    if not request.client or request.client.host not in ('127.0.0.1', '::1'):
        raise HTTPException(403, detail={'code': 'LOCAL_CONNECTION_ONLY'})
    if request.headers.get('host') not in ('127.0.0.1:8002', 'localhost:8002', '[::1]:8002'):
        raise HTTPException(403, detail={'code': 'INVALID_LOCAL_HOST'})
    origin = request.headers.get('origin')
    if (origin and origin not in ORIGINS) or request.headers.get('sec-fetch-site') == 'cross-site':
        raise HTTPException(403, detail={'code': 'INVALID_LOCAL_ORIGIN'})


class LocalCall(BaseModel):
    model_config = ConfigDict(extra='forbid')
    path: str = Field(max_length=500)
    method: str = 'GET'
    body: dict | None = None


async def forward_call(app, api_key, body):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://localhost') as client:
        response = await client.request(body.method, body.path, json=body.body, headers={'X-API-Key': api_key})
    return {'status': response.status_code, 'body': response.json()}


def attach_local_connection(app, api_key):
    @app.get('/local-connection/status', include_in_schema=False)
    def status(request: Request):
        require_local(request)
        return {'ready': bool(api_key), 'authentication': 'server-env'}

    @app.post('/local-connection/request', include_in_schema=False)
    async def call(request: Request, body: LocalCall):
        require_local(request)
        if not ROUTES.fullmatch(body.path) or body.method not in ('GET', 'POST', 'PUT', 'DELETE'):
            raise HTTPException(400, detail={'code': 'LOCAL_ROUTE_NOT_ALLOWED'})
        if not api_key:
            raise HTTPException(503, detail={'code': 'LOCAL_API_KEY_NOT_CONFIGURED'})
        return await forward_call(app, api_key, body)


CHAT_SESSION = r'/chat/sessions/[a-f0-9]{32}'
CIRCUIT = r'/circuits/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}'
PUBLIC_ROUTES = {
    'GET': re.compile(rf'/chat/config|{CHAT_SESSION}/messages/[a-f0-9]{{32}}'
                      rf'|/components/search(?:\?limit=100(?:&offset=[0-9]{{1,5}})?)?'
                      rf'|/components/[a-zA-Z0-9_][a-zA-Z0-9_.-]*(?:/image(?:\?optional=true)?)?'
                      rf'|/circuits/capabilities|/verification/config|{CIRCUIT}'),
    'POST': re.compile(rf'/chat/sessions|{CHAT_SESSION}/messages|/circuits|{CIRCUIT}/validate'),
    'PUT': re.compile(CIRCUIT),
    'DELETE': re.compile(CHAT_SESSION),
}
PUBLIC_CONNECTION = '/mir/api'


def attach_public_connection(app, api_key):
    # The limit is shared across callers. The tunnel can present a common source IP.
    chat_starts, chat_messages, db_writes = deque(), deque(), deque()

    def take_slot(bucket, limit):
        now = monotonic()
        while bucket and now - bucket[0] >= 60:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(429, detail={'code': 'MIR_PUBLIC_RATE_LIMIT'}, headers={'Retry-After': '60'})
        bucket.append(now)

    @app.post(PUBLIC_CONNECTION, include_in_schema=False)
    async def public_call(request: Request):
        if not api_key:
            raise HTTPException(403, detail={'code': 'MIR_PUBLIC_ACCESS_DISABLED'})
        if request.headers.get('content-type', '').split(';', 1)[0].strip().lower() != 'application/json':
            raise HTTPException(415, detail={'code': 'MIR_JSON_REQUIRED'})
        raw = bytearray()
        async for chunk in request.stream():
            if len(raw) + len(chunk) > 1_048_576:
                raise HTTPException(413, detail={'code': 'MIR_PUBLIC_PAYLOAD_TOO_LARGE'})
            raw.extend(chunk)
        try:
            body = LocalCall.model_validate_json(raw)
        except ValidationError:
            raise HTTPException(422, detail={'code': 'MIR_INVALID_REQUEST'}) from None
        allowed = PUBLIC_ROUTES.get(body.method)
        if not allowed or not allowed.fullmatch(body.path):
            raise HTTPException(403, detail={'code': 'MIR_PUBLIC_ROUTE_NOT_ALLOWED'})
        if body.method == 'GET' and body.path in ('/circuits/capabilities', '/verification/config'):
            return {'status': 200, 'body': {
                'kicad_available': False, 'ngspice_available': False, 'analyses': [],
                'message': 'KiCad·ngspice 파일 검증에는 배선 API 키가 필요합니다.',
            }}
        if body.method == 'POST' and body.path == '/chat/sessions':
            take_slot(chat_starts, 20)
        elif body.method == 'POST' and body.path.startswith('/chat/'):
            take_slot(chat_messages, 20)
        elif body.method in ('POST', 'PUT'):
            take_slot(db_writes, 60)
        return await forward_call(app, api_key, body)
