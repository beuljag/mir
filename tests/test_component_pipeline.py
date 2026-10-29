import json
import time

from fastapi.testclient import TestClient
import pytest

from app.main import create_app
from app.storage import Store

KEY = 'pipeline-owner-test-key-123456789'
OTHER = 'pipeline-other-test-key-123456789'
URL = 'https://example.com/test-pump-datasheet.pdf'


@pytest.fixture
def client(tmp_path):
    app = create_app(str(tmp_path / 'pipeline.db'), {KEY: 'a', OTHER: 'b'})
    # 실제 인터넷 자료를 읽었다고 주장하지 않는 합성 조사 응답으로 전체 연결을 검증한다.
    app.state.research.analyzer = lambda url, model, maker: {
        'source': {'title': 'Synthetic pump test source', 'reference': url, 'sha256': 'fixture-sha', 'page': '1'},
        'requested_model': model, 'model_match': True, 'verification_status': 'unverified',
        'evidence': [], 'warnings': ['테스트용 합성 자료']}
    with TestClient(app, headers={'X-API-Key': KEY}) as c:
        yield c
    app.state.research.pool.shutdown(wait=True)
    app.state.images.pool.shutdown(wait=True)


def call(client, name, arguments):
    result = client.post('/mcp', headers={'Accept': 'application/json, text/event-stream'}, json={
        'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {'name': name, 'arguments': arguments}}).json()['result']
    assert not result.get('isError'), result
    return json.loads(result['content'][0]['text'])


def body(request_id='new-pump-001'):
    return {'request_id': request_id, 'model': 'PIPELINE TEST PUMP', 'manufacturer': 'Test Fixture', 'category': 'actuator',
            'pins': [{'id': 'POS', 'label': '+', 'direction': 'power_in', 'signal_type': 'power'},
                     {'id': 'NEG', 'label': '-', 'direction': 'ground', 'signal_type': 'ground'}],
            'unresolved_fields': ['rated_voltage', 'rated_current'], 'notes': 'Synthetic fixture; not a real pump specification'}


def test_research_create_image_apply_circuit_and_reuse_full_mcp_pipeline(client):
    assert call(client, 'SearchComponents', {'q': 'PIPELINE TEST PUMP'}) == []
    request = call(client, 'ResearchComponent', {'model': 'PIPELINE TEST PUMP', 'manufacturer': 'Test Fixture',
                                               'source_urls_json': json.dumps([URL])})
    for _ in range(100):
        job = call(client, 'GetJobStatus', {'job_id': request['id']})
        if job['status'] not in ('queued', 'running'):
            break
        time.sleep(.01)
    assert job['status'] == 'completed'
    candidate_id = job['result']['candidate_id']
    draft = {**body(), 'candidate_id': candidate_id}
    component = call(client, 'CreateComponent', {'component_json': json.dumps(draft)})
    cid = component['id']
    assert component['is_draft'] and component['verification_status'] == 'unverified'
    assert component['source_references'][0]['reference'] == URL
    assert call(client, 'GetComponentCandidate', {'candidate_id': candidate_id})['status'] == 'pending_review'
    spec = call(client, 'GetComponentImageSpec', {'component_id': cid, 'presentation_json': '{"kind":"bare","color":"#1d3557"}'})
    w, h = spec['layout']['width'], spec['layout']['height']
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect x="35" y="30" width="60" height="26" class="metal"/><text x="65" y="47" class="art-text tiny dark">TEST PUMP</text></svg>'
    saved = call(client, 'SaveComponentSvg', {'request_json': json.dumps({
        'component_id': cid, 'request_id': 'pump-image-001', 'appearance': '합성 테스트 펌프 외형 그림',
        'presentation': spec['presentation'], 'svg': svg})})
    asset = saved['result']['asset_id']
    assert call(client, 'ApplyComponentImage', {'component_id': cid, 'asset_id': asset})['applied']
    assert client.get('/components/' + cid + '/image').json()['asset_id'] == asset
    circuit = call(client, 'CreateCircuitDraft', {'draft_json': json.dumps({
        'name': '검색·저장·이미지 연결 테스트', 'component_instances': [
            {'instance_id': 'P', 'component_definition_id': cid},
            {'instance_id': 'PS', 'component_definition_id': 'virtual-supply'}],
        'nets': [{'net_id': 'power', 'connected_pin_refs': [{'instance_id': 'P', 'pin_id': 'POS'}, {'instance_id': 'PS', 'pin_id': 'VOUT'}]}]})})
    validation = call(client, 'ValidateCircuit', {'circuit_id': circuit['id'], 'expected_version': 1})
    assert validation['status'] == 'unknown'
    assert not any(i['code'] == 'UNKNOWN_COMPONENT' for i in validation['issues'])
    assert call(client, 'ApplyCircuitLayout', {'circuit_id': circuit['id'], 'expected_version': 1, 'allow_unvalidated_draft': True})['editor_url']
    assert call(client, 'SearchComponents', {'q': 'PIPELINE TEST PUMP'})[0]['id'] == cid
    assert call(client, 'CreateComponent', {'component_json': json.dumps(draft)})['id'] == cid
    reopened = Store(client.app.state.images.store.path)
    assert reopened.components('a')[cid].model == 'PIPELINE TEST PUMP'
    assert reopened.active_image('a', cid).id == asset
    assert cid not in reopened.components('b') and cid not in reopened.components()


def test_creation_deduplication_owner_isolation_and_no_verification_override(client):
    result = client.post('/components', json=body())
    assert result.status_code == 201
    cid = result.json()['id']
    assert client.post('/components', json=body()).json()['id'] == cid
    assert client.post('/components', json={**body(), 'model': 'OTHER MODEL'}).status_code == 409
    assert client.get('/components/' + cid, headers={'X-API-Key': OTHER}).status_code == 404
    assert client.get('/components/search?q=PIPELINE', headers={'X-API-Key': OTHER}).json() == []
    assert client.get('/components/' + cid + '/image-spec', headers={'X-API-Key': OTHER}).status_code == 404
    assert client.post('/components', json={**body('override-01'), 'verification_status': 'verified'}).status_code == 422
    assert client.post('/components', json={**body('duplicate-pins'), 'pins': [body()['pins'][0]] * 2}).status_code == 422
    assert client.post('/components', json=body(), headers={'X-API-Key': 'wrong'}).status_code == 401
    other = client.post('/components', json=body(), headers={'X-API-Key': OTHER}).json()
    assert other['id'] != cid


def test_unknown_pinout_still_creates_reusable_body_and_validation_stays_unknown(client):
    component = client.post('/components', json={'request_id': 'unknown-supply', 'model': '외부 전원 (모델 미확인)', 'category': 'power', 'is_virtual': True}).json()
    assert component['pins'] == [] and 'pinout' in component['unresolved_fields']
    cid = component['id']
    spec = client.get('/components/' + cid + '/image-spec').json()
    assert spec['layout']['pins'] == [] and spec['presentation']['kind'] == 'bare'
    created = client.post('/circuits', json={'name': '외형 초안', 'component_instances': [{'instance_id': 'PS', 'component_definition_id': cid}]}).json()
    result = client.post('/circuits/' + created['id'] + '/validate', json={'expected_version': 1}).json()
    assert result['status'] == 'unknown' and any(i['code'] == 'PINOUT_NOT_DEFINED' for i in result['issues'])


def test_catalog_paginates_new_parts_beyond_first_100(client):
    for i in range(103):
        result = client.post('/components', json={**body(f'catalog-{i:04}'), 'model': f'CATALOG PUMP {i}'})
        assert result.status_code == 201
    first = client.get('/components/search?limit=100&offset=0').json()
    second = client.get('/components/search?limit=100&offset=100').json()
    assert len(first) == 100 and len(second) == 6
    assert len({c['id'] for c in first + second}) == 106


def test_candidate_ownership_and_model_match_required(client):
    from app.models import CandidateRecord
    client.app.state.images.store.add_candidate(CandidateRecord(id='owned', job_id='job', requested_model='PIPELINE TEST PUMP', analyses=[]), 'a')
    request = {**body(), 'candidate_id': 'owned'}
    assert client.post('/components', json=request, headers={'X-API-Key': OTHER}).status_code == 404
    assert client.post('/components', json={**request, 'model': 'UNRELATED'}).status_code == 422
    assert client.get('/components/search?q=PIPELINE').json() == []


def test_optional_search_key_reads_dotenv_and_unknown_maker_results_remain_candidates(tmp_path, monkeypatch):
    from app import research
    from app.models import ResearchRequest
    root = tmp_path / 'search'
    root.mkdir()
    (root / '.env').write_text('BRAVE_SEARCH_API_KEY=fixture-search-key\n', encoding='utf-8')
    monkeypatch.setattr(research, 'ROOT', root)
    monkeypatch.delenv('BRAVE_SEARCH_API_KEY', raising=False)
    store = Store(str(root / 'search.db'))
    def fetch(url, **kwargs):
        assert url.startswith('https://api.search.brave.com/')
        assert kwargs['headers']['X-Subscription-Token'] == 'fixture-search-key'
        return {'body': json.dumps({'web': {'results': [{'url': URL}, {'url': 'http://unsafe.example'}]}}).encode()}
    service = research.ResearchService(store, fetcher=fetch)
    try:
        urls, methods = service.discover(ResearchRequest(model='TEST PUMP', manufacturer='Unknown fixture maker'))
        assert urls == [URL]
        assert 'brave_unconfirmed_sources' in methods
        assert not research.official_domain(URL, 'Unknown fixture maker')
        assert store.components() and store.list_candidates('a') == []
    finally:
        service.pool.shutdown(wait=True)
