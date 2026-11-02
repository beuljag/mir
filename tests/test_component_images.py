import base64
import json
import time
import xml.etree.ElementTree as ET

import httpx
import pytest
from fastapi.testclient import TestClient

from app.component_images import ImageError, ImageService, canvas_layout, safe_svg
from app.main import create_app
from app.models import CandidateRecord
from app.storage import Store

KEY = 'image-owner-test-key-123456789'
OTHER = 'image-other-test-key-123456789'


def drawing(layout, body='<rect x="12" y="30" width="50" height="24" fill="#219c8f"/>'):
    w, h = layout['width'], layout['height']
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>'


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY', 'image-provider-test-secret')
    monkeypatch.setenv('COMPONENT_IMAGE_MODEL', 'gpt-5-mini')
    app = create_app(str(tmp_path / 'images.db'), {KEY: 'a', OTHER: 'b'})
    calls = []

    def handle(request):
        body = json.loads(request.content)
        calls.append(body)
        assert request.url == 'https://api.openai.com/v1/responses'
        assert request.headers['authorization'] == 'Bearer image-provider-test-secret'
        assert 'AI에게 줄 요청문' in body['instructions']
        assert body['store'] is False
        data = json.loads(body['input'])
        return httpx.Response(200, json={'status': 'completed', 'output': [
            {'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps({'svg': drawing(data['layout'])})}]}]})

    app.state.images.transport = httpx.MockTransport(handle)
    app.state.images.test_calls = calls
    with TestClient(app, headers={'X-API-Key': KEY}) as c:
        yield c
    app.state.images.pool.shutdown(wait=True)
    app.state.research.pool.shutdown(wait=True)


def finish(client, job):
    for _ in range(100):
        result = client.get('/jobs/' + job['id']).json()
        if result['status'] not in ('queued', 'running'):
            return result
        time.sleep(.01)
    raise AssertionError('이미지 작업이 완료되지 않았습니다.')


def native_body(client, request_id='native-svg-01'):
    spec = client.get('/components/virtual-sensor/image-spec').json()
    return {'component_id': 'virtual-sensor', 'appearance': '초록색 PCB의 단순한 평면 센서 외형',
            'request_id': request_id, 'svg': drawing(spec['layout'])}


def test_native_svg_without_provider_key_and_apply_owner_isolation(client, monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY', '')
    before = client.get('/components/virtual-sensor').json()
    assert client.get('/component-images/config').json()['configured'] is False
    body = native_body(client)
    result = client.post('/component-images/svg', json=body)
    assert result.status_code == 201, result.text
    job = result.json()
    assert job['status'] == 'completed'
    asset_id = job['result']['asset_id']
    image = client.get('/component-images/' + asset_id).json()
    assert image['model'] == 'copilot-svg' and image['illustrative_only']
    assert client.post('/component-images/svg', json=body).json()['id'] == job['id']
    assert client.post('/component-images/svg', json={**body, 'appearance': '요청 식별자는 같지만 다른 이미지 설명'}).status_code == 409
    path = '/components/virtual-sensor/image'
    assert client.get(path).status_code == 404
    assert client.put(path, json={'asset_id': asset_id}).json()['applied']
    content = client.get(path).json()
    svg = base64.b64decode(content['image_data'].split(',')[1])
    tree = ET.fromstring(svg)
    pads = tree.findall('{http://www.w3.org/2000/svg}rect[@class="pad"]')
    assert [(float(p.attrib['x']) + 5, float(p.attrib['y']) + 5) for p in pads] == [(p['x'], p['y']) for p in image['layout']['pins']]
    assert content['design_version'] == 'v2' and content['art_nodes']
    assert client.get('/components/virtual-sensor').json() == before
    assert client.put('/components/virtual-supply/image', json={'asset_id': asset_id}).status_code == 409
    for endpoint in [path, '/component-images/' + asset_id, '/component-images/' + asset_id + '/content', '/jobs/' + job['id']]:
        assert client.get(endpoint, headers={'X-API-Key': OTHER}).status_code == 404
    assert client.get('/component-images', headers={'X-API-Key': OTHER}).json() == []
    assert client.app.state.images.test_calls == []


def test_provider_generation_job_deduplication_and_persistence(client):
    body = {'component_id': 'virtual-sensor', 'appearance': '초록색 PCB와 단순한 센서 몸체를 플랫 스타일로 그린다.', 'request_id': 'provider-01'}
    result = client.post('/component-images/generate', json=body)
    assert result.status_code == 202
    job = finish(client, result.json())
    assert job['status'] == 'completed', job
    assert client.post('/component-images/generate', json=body).json()['id'] == job['id']
    assert len(client.app.state.images.test_calls) == 1
    asset_id = job['result']['asset_id']
    meta = client.get('/component-images/' + asset_id).json()
    assert meta['sha256'] and not meta['has_transparency'] and meta['format'] == 'svg'
    assert client.put('/components/virtual-sensor/image', json={'asset_id': asset_id}).status_code == 200
    service = client.app.state.images
    reopened = Store(service.store.path)
    assert reopened.active_image('a', 'virtual-sensor').id == asset_id
    assert 'image-provider-test-secret' not in str(meta) + str(job)
    assert not list(service.folder.glob('*.tmp'))


@pytest.mark.parametrize('body', [
    '<script>alert(1)</script>', '<text onclick="alert(1)">VCC</text>', '<image href="https://example.com/x.png"/>',
    '<rect onclick="alert(1)"/>', '<g style="fill:url(https://example.com)"><rect/></g>',
    '<rect fill="url(#fake)"/>', '<foreignObject/>', '<svg/>', '<animate/>',
    '<path d="M 1e999 0"/>', '<g xmlns="https://example.com"/>',
    '<text font-family="http://evil.example/font">text</text>', '<text font-size="100">text</text>',
    '<text><tspan>nested</tspan></text>', '<rect class="arbitrary-page-style"/>',
])
def test_svg_active_content_and_extreme_geometry_rejected(body):
    layout = {'width': 160, 'height': 100, 'pins': []}
    with pytest.raises(ImageError):
        safe_svg(drawing(layout, body), layout)


def test_wrong_size_and_xml_entities_rejected(client):
    body = native_body(client)
    body['svg'] = body['svg'].replace('viewBox="0 0 ', 'viewBox="1 1 ')
    assert client.post('/component-images/svg', json=body).status_code == 422
    body = native_body(client)
    body['svg'] = '<!DOCTYPE svg [<!ENTITY x "oops">]>' + body['svg']
    assert client.post('/component-images/svg', json=body).status_code == 422
    assert client.get('/component-images').json() == []


def test_missing_key_provider_errors_and_tampered_files(client, monkeypatch):
    body = {'component_id': 'virtual-sensor', 'appearance': '단순한 초록색 PCB 센서 외형', 'request_id': 'provider-fail-01'}
    monkeypatch.setenv('OPENAI_API_KEY', '')
    assert client.post('/component-images/generate', json=body).status_code == 503
    monkeypatch.setenv('OPENAI_API_KEY', 'image-provider-test-secret')
    client.app.state.images.transport = httpx.MockTransport(lambda req: httpx.Response(401, json={'error': 'private-provider-details'}))
    job = finish(client, client.post('/component-images/generate', json=body).json())
    assert job['error']['code'] == 'IMAGE_PROVIDER_HTTP_401'
    assert 'private-provider-details' not in str(job)
    assert client.put('/components/virtual-sensor/image', json={'asset_id': job['result']['asset_id']}).status_code == 409
    native = client.post('/component-images/svg', json=native_body(client)).json()
    asset_id = native['result']['asset_id']
    (client.app.state.images.folder / (asset_id + '.svg')).write_text('<svg/>', encoding='utf-8')
    assert client.get('/component-images/' + asset_id + '/content').status_code == 409


def test_pending_candidate_preview_is_not_registered_as_component(client):
    store = client.app.state.images.store
    candidate = CandidateRecord(id='test-candidate', job_id='test-job', requested_model='TEST PUMP', analyses=[])
    store.add_candidate(candidate, 'a')
    spec = client.get('/component-images/spec', params={'candidate_id': candidate.id})
    assert spec.status_code == 200
    layout = spec.json()['layout']
    assert client.get('/component-images/spec', params={'candidate_id': candidate.id}, headers={'X-API-Key': OTHER}).status_code == 404
    assert client.get('/component-images/spec').status_code == 422
    body = {'candidate_id': candidate.id, 'appearance': '검토 전 펌프의 단순한 외형 참고 이미지', 'request_id': 'candidate-image-01', 'svg': drawing(layout)}
    job = client.post('/component-images/svg', json=body).json()
    assert job['status'] == 'completed'
    asset_id = job['result']['asset_id']
    assert client.put('/components/virtual-sensor/image', json={'asset_id': asset_id}).status_code == 409
    assert client.get('/components/search?q=PUMP').json() == []
    assert client.get('/component-candidates/' + candidate.id).json()['status'] == 'pending_review'


def test_local_proxy_reads_active_image_without_public_key_bypass(client):
    job = client.post('/component-images/svg', json=native_body(client)).json()
    client.put('/components/virtual-sensor/image', json={'asset_id': job['result']['asset_id']})
    response = client.get('/components/virtual-sensor/image', headers={'X-API-Key': ''})
    assert response.status_code == 401
    # 소켓 포트 기반 로컬 인증 제한은 기존 테스트에서 별도로 검사한다.
    assert KEY not in client.get('/components/virtual-sensor/image').text


def test_mcp_native_svg_roundtrip(client):
    def tool(name, arguments):
        response = client.post('/mcp', headers={'Accept': 'application/json, text/event-stream'}, json={
            'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {'name': name, 'arguments': arguments}})
        result = response.json()['result']
        assert not result.get('isError'), result
        return json.loads(result['content'][0]['text'])
    spec = tool('GetComponentImageSpec', {'component_id': 'virtual-sensor'})
    body = {'component_id': 'virtual-sensor', 'appearance': '테스트용 단순한 플랫 센서 외형', 'request_id': 'mcp-svg-01', 'svg': drawing(spec['layout'])}
    job = tool('SaveComponentSvg', {'request_json': json.dumps(body)})
    asset_id = job['result']['asset_id']
    assert tool('GetComponentImage', {'asset_id': asset_id})['status'] == 'completed'
    assert tool('ApplyComponentImage', {'component_id': 'virtual-sensor', 'asset_id': asset_id})['applied']


def test_restarted_image_job_is_failed_instead_of_resubmitted(client):
    store = client.app.state.images.store
    from app.models import ComponentImage, JobRecord
    from app.research import now, ResearchService
    job = JobRecord(id='interrupted', kind='component_image', status='running', created_at=now(), updated_at=now())
    image = ComponentImage(id='a' * 32, job_id=job.id, component_id='virtual-sensor', label='test', model='test', created_at=now())
    store.create_image(image, 'a', 'interrupted-request', 'test', job)
    research = ResearchService(store)
    service = ImageService(store)
    try:
        assert store.get_job(job.id, 'a').error['code'] == 'SERVER_RESTARTED'
        assert store.get_image(image.id, 'a').error_code == 'SERVER_RESTARTED'
    finally:
        research.pool.shutdown(wait=True)
        service.pool.shutdown(wait=True)


def test_v2_body_text_materials_and_pcb_style(client):
    body = native_body(client, 'body-text-v2')
    spec = client.get('/components/virtual-sensor/image-spec').json()
    body['presentation'] = {**spec['presentation'], 'color': '#5b2a86'}
    body['svg'] = drawing(spec['layout'], '<rect x="40" y="30" width="50" height="30" class="metal"/>'
                          '<text x="65" y="48" text-anchor="middle" class="art-text strong dark">TEST CHIP</text>')
    response = client.post('/component-images/svg', json=body)
    assert response.status_code == 201, response.text
    asset_id = response.json()['result']['asset_id']
    content = client.get('/component-images/' + asset_id + '/content').json()
    tree = ET.fromstring(base64.b64decode(content['image_data'].split(',')[1]))
    text = tree.find('.//{http://www.w3.org/2000/svg}text')
    assert text.text == 'TEST CHIP'
    assert text.attrib['font-family'] == 'monospace'
    assert text.attrib['font-size'] == '12' and text.attrib['font-weight'] == '700'
    assert text.attrib['fill'] == '#232B36'
    assert tree[0].attrib['fill'] == '#5b2a86'
    assert len(tree.findall('{http://www.w3.org/2000/svg}circle[@class="hole"]')) == 4
    assert client.put('/components/virtual-sensor/image', json={'asset_id': asset_id}).status_code == 200
    assert client.get('/components/virtual-sensor/image').json()['presentation']['color'] == '#5b2a86'


def test_bare_with_four_pin_sides_matches_layoutpart_and_keeps_electrical_data(client):
    presentation = {'kind': 'bare', 'color': '#1d3557', 'pin_sides': {'VCC': 'top', 'GND': 'bottom', 'OUT': 'right'}}
    spec = client.post('/component-images/spec', json={'component_id': 'virtual-sensor', 'presentation': presentation}).json()
    by_pin = {p['id']: p for p in spec['layout']['pins']}
    assert spec['layout']['top'] == 18
    assert by_pin['VCC']['y'] == 0 and by_pin['GND']['y'] == spec['layout']['height']
    body = native_body(client, 'bare-four-sides')
    body.update(presentation=presentation, svg=drawing(spec['layout'], '<path d="M 0 0 L 30 30" class="lead"/>'
                                                     '<text x="50" y="50" class="art-text tiny on-canvas">TEST</text>'))
    job = client.post('/component-images/svg', json=body).json()
    asset_id = job['result']['asset_id']
    content = client.get('/component-images/' + asset_id + '/content').json()
    assert content['presentation']['kind'] == 'bare'
    assert all(n['attrs'].get('class') not in ('silk', 'pad', 'hole') for n in content['art_nodes'])
    assert client.put('/components/virtual-sensor/image', json={'asset_id': asset_id}).status_code == 200
    assert client.get('/components/virtual-sensor').json()['pins'][0]['direction'] == 'power_in'
    presentation['pin_sides']['invented-pin'] = 'left'
    assert client.post('/component-images/spec', json={'component_id': 'virtual-sensor', 'presentation': presentation}).status_code == 422


def test_legacy_image_binding_survives_v2(client):
    from app.models import ComponentImage, JobRecord
    from app.research import now
    store = client.app.state.images.store
    layout = canvas_layout(store.components()['virtual-sensor'], legacy=True)
    payload = drawing(layout).encode()
    import hashlib
    job = JobRecord(id='legacy-job', kind='component_image', status='completed', created_at=now(), updated_at=now())
    image = ComponentImage(id='b' * 32, job_id=job.id, label='legacy', component_id='virtual-sensor', status='completed',
                           created_at=now(), model='copilot-svg', layout=layout, sha256=hashlib.sha256(payload).hexdigest())
    store.create_image(image, 'a', 'legacy-request', 'old', job)
    (client.app.state.images.folder / (image.id + '.svg')).write_bytes(payload)
    assert client.put('/components/virtual-sensor/image', json={'asset_id': image.id}).status_code == 200
    content = client.get('/components/virtual-sensor/image').json()
    assert content['design_version'] == 'v1' and content['art_nodes'] is None
