import pytest
import httpx
from fastapi.testclient import TestClient
from app.main import create_app
from app import local_connection
from app.directline_chat import DirectLineChat

KEY = 'local-automatic-test-key-1234567890'


@pytest.fixture
def app(tmp_path):
    return create_app(str(tmp_path / 'local.db'), {KEY: 'local-owner'})


def test_loopback_html_can_call_key_authenticated_api_from_other_port(app):
    origin = 'http://127.0.0.1:5500'
    with TestClient(app, base_url='http://127.0.0.1:8000', client=('127.0.0.1', 54000)) as client:
        response = client.options('/components/search', headers={
            'Origin': origin, 'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'x-api-key',
        })
        assert response.status_code == 200
        assert response.headers['access-control-allow-origin'] == origin
        assert client.get('/components/search', headers={'Origin': origin}).status_code == 401
        response = client.post('http://127.0.0.1:8002/local-connection/request', headers={'Origin': origin},
                               json={'path': '/components/search?limit=100'})
        assert response.status_code == 403


def test_standalone_html_can_use_key_authenticated_editor_api(app):
    with TestClient(app, base_url='http://127.0.0.1:8000') as client:
        headers = {'Origin': 'null'}
        preflight = {**headers, 'Access-Control-Request-Method': 'GET',
                     'Access-Control-Request-Headers': 'x-api-key'}
        response = client.options('/components/search?limit=100', headers=preflight)
        assert response.status_code == 200
        assert response.headers['access-control-allow-origin'] == 'null'

        denied = client.get('/components/search', headers=headers)
        assert denied.status_code == 401
        assert denied.headers['access-control-allow-origin'] == 'null'
        allowed = client.get('/components/search', headers={**headers, 'X-API-Key': KEY})
        assert allowed.status_code == 200
        assert allowed.headers['access-control-allow-origin'] == 'null'

        authenticated = {**headers, 'X-API-Key': KEY}
        capabilities = client.get('/circuits/capabilities', headers=authenticated)
        assert capabilities.status_code == 200
        assert capabilities.headers['access-control-allow-origin'] == 'null'
        verification = client.get('/verification/config', headers=authenticated).json()
        assert capabilities.json() == {**verification, 'editor_wires': True}
        assert client.get('/circuits/capabilities', headers=headers).status_code == 401

        assert 'access-control-allow-origin' not in client.options('/mcp', headers=preflight).headers
        local = client.get('http://127.0.0.1:8002/local-connection/status', headers=headers)
        assert local.status_code == 403
        assert 'access-control-allow-origin' not in local.headers


def test_local_connection_authenticates_without_exposing_key(app):
    with TestClient(app, base_url='http://127.0.0.1:8002', client=('127.0.0.1', 54000)) as client:
        status = client.get('/local-connection/status')
        assert status.json() == {'ready': True, 'authentication': 'server-env'}
        response = client.post('/local-connection/request', headers={'Origin': 'http://127.0.0.1:8000'},
                               json={'path': '/components/search?limit=100'})
        assert response.status_code == 200
        assert response.json()['status'] == 200
        assert {'virtual-sensor', 'led-red', 'esp32-devkitc'} <= {p['id'] for p in response.json()['body']}
        assert KEY not in status.text + response.text
        create = client.post('/local-connection/request', json={'path': '/circuits', 'method': 'POST', 'body': {
            'name': '자동 인증 회로', 'component_instances': [{'instance_id': 'P', 'component_definition_id': 'virtual-supply'}]}}).json()
        assert create['status'] == 201
        cid = create['body']['id']
        fetched = client.get(f'/circuits/{cid}', headers={'X-API-Key': KEY})
        assert fetched.status_code == 200


def test_public_port_and_spoofed_headers_cannot_use_auto_auth(app):
    with TestClient(app, base_url='http://127.0.0.1:8000', client=('127.0.0.1', 54000)) as client:
        for headers in [{}, {'Host': '127.0.0.1:8002', 'X-Forwarded-Port': '8002', 'Origin': 'http://127.0.0.1:8000'}]:
            assert client.get('/local-connection/status', headers=headers).status_code == 403
            assert client.post('/local-connection/request', headers=headers, json={'path': '/components/search'}).status_code == 403
        assert client.get('/components/search').status_code == 401


def test_wrong_client_host_origin_and_privileged_routes_rejected(app, tmp_path):
    with TestClient(app, base_url='http://127.0.0.1:8002', client=('127.0.0.1', 54000)) as client:
        assert client.get('/local-connection/status', headers={'Host': 'evil.example:8002'}).status_code == 403
        assert client.get('/local-connection/status', headers={'Origin': 'https://evil.example'}).status_code == 403
        assert client.get('/local-connection/status', headers={'Sec-Fetch-Site': 'cross-site'}).status_code == 403
        for path in ['/mcp', '/component-candidates/123/review', 'https://example.com', '/local-connection/status']:
            response = client.post('/local-connection/request', json={'path': path})
            assert response.status_code == 400
        options = client.options('/local-connection/request', headers={
            'Origin': 'http://127.0.0.1:8000', 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type'})
        assert options.status_code == 200
        assert options.headers['Access-Control-Allow-Origin'] == 'http://127.0.0.1:8000'
    remote_test_app = create_app(str(tmp_path / 'remote.db'), {KEY: 'local-owner'})
    with TestClient(remote_test_app, base_url='http://127.0.0.1:8002', client=('203.0.113.1', 54000)) as client:
        assert client.get('/local-connection/status').status_code == 403


def test_dotenv_key_keeps_existing_owners(monkeypatch, tmp_path):
    (tmp_path / 'config').mkdir()
    (tmp_path / 'config' / 'local-api-keys.json').write_text('{"legacy-test-key-12345678901234":"legacy-owner"}', encoding='utf-8')
    (tmp_path / '.env').write_text('CIRCUIT_API_KEY=new-test-key-1234567890123456\nCIRCUIT_API_OWNER=local-owner\n', encoding='utf-8')
    monkeypatch.setattr(local_connection, 'ROOT', tmp_path)
    for name in ['CIRCUIT_API_KEY', 'CIRCUIT_API_KEYS', 'CIRCUIT_API_OWNER']:
        monkeypatch.delenv(name, raising=False)
    keys, selected = local_connection.load_api_keys()
    assert selected == 'new-test-key-1234567890123456'
    assert keys[selected] == 'local-owner'
    assert keys['legacy-test-key-12345678901234'] == 'legacy-owner'


def test_chat_starts_without_browser_key_via_local_connection(app, tmp_path, monkeypatch):
    monkeypatch.delenv('COPILOT_DIRECT_LINE_SECRET', raising=False)
    env = tmp_path / '.env'
    env.write_text('COPILOT_DIRECT_LINE_SECRET=mock-secret-for-local-chat\n', encoding='utf-8')
    def handle(request):
        return httpx.Response(201, json={'conversationId': 'private-conversation', 'token': 'private-token'})
    app.state.chat = DirectLineChat(env_file=env, transport=httpx.MockTransport(handle))
    with TestClient(app, base_url='http://127.0.0.1:8002', client=('127.0.0.1', 54000)) as client:
        response = client.post('/local-connection/request', json={'path': '/chat/sessions', 'method': 'POST'})
        assert response.status_code == 200 and response.json()['status'] == 201
        assert 'session_id' in response.json()['body']
        assert KEY not in response.text and 'private-token' not in response.text and 'mock-secret-for-local-chat' not in response.text


def test_public_mir_uses_server_owner_for_chat_and_circuits(tmp_path, monkeypatch):
    monkeypatch.setenv('MIR_PUBLIC_ACCESS', '1')
    monkeypatch.setenv('COPILOT_DIRECT_LINE_SECRET', 'mock-secret-for-public-chat')
    app = create_app(str(tmp_path / 'public.db'), {KEY: 'copilot-owner'})

    def handle(request):
        return httpx.Response(201, json={'conversationId': 'private-conversation', 'token': 'private-token'})

    app.state.chat = DirectLineChat(transport=httpx.MockTransport(handle))
    with TestClient(app) as client:
        def call(path, method='GET', body=None):
            return client.post('/mir/api', headers={'Origin': 'null'},
                               json={'path': path, 'method': method, 'body': body})

        found = call('/components/search?limit=100')
        assert found.headers['access-control-allow-origin'] == 'null'
        assert found.json()['status'] == 200
        capability = call('/circuits/capabilities').json()['body']
        assert capability['editor_wires'] is True
        assert capability['authentication_required'] is True
        circuit = call('/circuits', 'POST', {
            'name': '공개 미르 회로',
            'component_instances': [
                {'instance_id': 'P', 'component_definition_id': 'virtual-supply'},
                {'instance_id': 'L', 'component_definition_id': 'led-red'},
            ],
            'editor_wires': [{'id': 'wire-1', 'from': 'P.V+', 'to': 'L.A', 'kind': 'power', 'note': '전원선'}],
        }).json()
        assert circuit['status'] == 201
        path = '/circuits/' + circuit['body']['id']
        saved = call(path).json()['body']
        assert saved['name'] == '공개 미르 회로'
        assert saved['editor_wires'][0]['from'] == 'P.V+'
        assert saved['editor_wires'][0]['note'] == '전원선'
        assert client.get(path, headers={'X-API-Key': KEY}).status_code == 200
        assert client.get(path).status_code == 401
        chat = call('/chat/sessions', 'POST')
        assert chat.json()['status'] == 201
        assert all(secret not in chat.text for secret in (KEY, 'private-token', 'private-conversation'))
        for route, method in (
            ('/mcp', 'POST'), ('/components/search', 'PUT'), ('/chat/diagnostics', 'GET'),
            ('/components/%2e%2e', 'GET'), ('/verification/projects', 'POST'), (path, 'DELETE'),
        ):
            assert call(route, method).status_code == 403
        for _ in range(19):
            assert call('/chat/sessions', 'POST').status_code == 200
        assert call('/chat/sessions', 'POST').status_code == 429


def test_public_mir_disabled_by_default(tmp_path, monkeypatch):
    monkeypatch.setenv('MIR_PUBLIC_ACCESS', '0')
    app = create_app(str(tmp_path / 'private.db'), {KEY: 'owner'})
    with TestClient(app) as client:
        response = client.post('/mir/api', json={'path': '/components/search'})
        assert response.status_code == 403
        assert response.json()['detail']['code'] == 'MIR_PUBLIC_ACCESS_DISABLED'
