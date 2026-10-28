"""8002번 로컬 전용 연결이 .env의 키로 기존 API를 대신 호출한다."""
import json
import os
import re
from pathlib import Path

import httpx
from dotenv import dotenv_values
from fastapi import HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

ROOT = Path(__file__).resolve().parents[1]
LOCAL_PORT = 8002
ORIGINS = {'http://127.0.0.1:8000', 'http://localhost:8000'}
ROUTES = re.compile(r'^/(?:chat/(?:config|diagnostics|sessions(?:/[a-f0-9]+(?:/messages(?:/[a-f0-9]+)?)?)?)|components/search(?:\?limit=100(?:&offset=[0-9]{1,5})?)?|components/[a-zA-Z0-9_.%-]+(?:/image)?|circuits(?:/[a-zA-Z0-9-]+(?:/validate)?)?)$')


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
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://localhost') as client:
            response = await client.request(body.method, body.path, json=body.body,
                                            headers={'X-API-Key': api_key})
        # Return the normal API result, never authentication configuration.
        return {'status': response.status_code, 'body': response.json()}
