from fastapi.testclient import TestClient
from app.main import create_app


def test_mir_assets_and_no_private_files(tmp_path):
    with TestClient(create_app(str(tmp_path / 'mir.db'), {'mir-test-key-long-enough-123456': 'a'})) as client:
        page = client.get('/mir/')
        assert page.status_code == 200 and 'btnBackend' in page.text
        assert client.get('/mir/app.js').status_code == 200
        assert client.get('/mir/web-api.js').status_code == 200
        assert client.get('/mir/directline.js').status_code == 200
        assert len(client.get('/mir/parts').json()['parts']) == 13
        assert client.get('/mir/docs/Copilot-Studio-지침.md').status_code == 200
        for path in ['/mir/.git/config', '/mir/main.js', '/mir/config/local-api-keys.json', '/mir/../config/local-api-keys.json']:
            assert client.get(path).status_code in (401, 404)
        assert client.get('/components/search').status_code == 401


def test_apply_links_to_mir_and_keeps_authentication(tmp_path):
    with TestClient(create_app(str(tmp_path / 'apply.db'), {'mir-test-key-long-enough-123456': 'a'})) as client:
        client.headers['X-API-Key'] = 'mir-test-key-long-enough-123456'
        draft = {'name': '미르 연결 시험', 'component_instances': [
            {'instance_id': 'P', 'component_definition_id': 'virtual-supply'}]}
        record = client.post('/circuits', json=draft).json()
        result = client.post(f"/circuits/{record['id']}/apply", json={'expected_version': 1, 'allow_unvalidated_draft': True})
        assert result.json()['editor_url'] == f"/mir/?circuit={record['id']}"
        client.headers.clear()
        assert client.get(f"/circuits/{record['id']}").status_code == 401
