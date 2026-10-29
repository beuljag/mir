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


def test_local_connection_authenticates_without_exposing_key(app):
    with TestClient(app, base_url='http://127.0.0.1:8002', client=('127.0.0.1', 54000)) as client:
        status = client.get('/local-connection/status')
        assert status.json() == {'ready': True, 'authentication': 'server-env'}
        response = client.post('/local-connection/request', headers={'Origin': 'http://127.0.0.1:8000'},
                               json={'path': '/components/search?limit=100'})
        assert response.status_code == 200
        assert response.json()['status'] == 200 and len(response.json()['body']) == 3
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
