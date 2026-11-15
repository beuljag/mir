import asyncio
from io import BytesIO
import json

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfWriter

from app import directline_chat
from app.chat_reference_images import ReferenceImage, first_reference_url, resolve_reference_images
from app.directline_chat import ChatError, DirectLineChat, settings
from app.main import create_app

KEY = 'chat-api-test-key-123456789012345'
OTHER = 'chat-api-other-key-12345678901234'
SECRET = 'mock-directline-secret-do-not-return'
TOKEN = 'mock-conversation-token-do-not-return'


@pytest.fixture
def chat(tmp_path, monkeypatch):
    for key in ('COPILOT_DIRECT_LINE_SECRET', 'COPILOT_DIRECT_LINE_DOMAIN', 'COPILOT_CHAT_MODE', 'COPILOT_REPLY_TIMEOUT_SECONDS'):
        monkeypatch.delenv(key, raising=False)
    env = tmp_path / '.env'
    env.write_text('COPILOT_DIRECT_LINE_SECRET=' + SECRET + '\n', encoding='utf-8')
    calls = []
    polls = 0

    def handle(request):
        nonlocal polls
        calls.append(request)
        assert request.url.host == 'directline.botframework.com'
        if request.url.path.endswith('/conversations'):
            assert request.headers['Authorization'] == 'Bearer ' + SECRET
            return httpx.Response(201, json={'conversationId': 'remote-conversation', 'token': TOKEN, 'streamUrl': 'secret-stream'})
        assert request.headers['Authorization'] == 'Bearer ' + TOKEN
        if request.method == 'POST':
            return httpx.Response(200, json={'id': 'sent-activity'})
        polls += 1
        activities = [] if polls == 1 else [
            {'id': 'user-message', 'type': 'message', 'from': {'role': 'user'}, 'text': 'ignore echo'},
            {'id': 'answer', 'type': 'message', 'from': {'role': 'bot'}, 'text': '설계 초안\n```json\n{"type":"circuit_reference","circuit_id":"c1"}\n```'},
            {'id': 'answer-no-role', 'type': 'message', 'from': {'id': 'server-assigned-user-id'}, 'text': 'ID가 바뀐 사용자 메시지'},
            {'id': 'bot-answer-no-role', 'type': 'message', 'from': {'id': 'actual-bot'}, 'replyToId': 'sent-activity', 'text': '역할 필드가 없는 실제 답변'}]
        return httpx.Response(200, json={'activities': activities, 'watermark': str(polls)})

    service = DirectLineChat(env_file=env, transport=httpx.MockTransport(handle))
    service.quiet_seconds = 0
    app = create_app(str(tmp_path / 'db.sqlite'), {KEY: 'a', OTHER: 'b'})
    app.state.chat = service
    with TestClient(app) as client:
        client.headers['X-API-Key'] = KEY
        yield client, service, env, calls


def test_secret_and_tokens_stay_on_server_chat_roundtrip(chat):
    client, service, env, calls = chat
    config = client.get('/chat/config').json()
    assert config['configured'] is True
    response = client.post('/chat/sessions')
    assert response.status_code == 201
    sid = response.json()['session_id']
    assert sid != 'remote-conversation'
    sent = client.post(f'/chat/sessions/{sid}/messages', json={'message': '라즈베리파이 펌프', 'catalog': '부품 목록'})
    assert sent.status_code == 202
    rid = sent.json()['request_id']
    result = client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status'] == 'completed' and 'circuit_id' in result['reply']
    all_responses = json.dumps([config, response.json(), sent.json(), result])
    assert SECRET not in all_responses and TOKEN not in all_responses and 'secret-stream' not in all_responses
    assert 'ignore echo' not in result['reply']
    assert 'ID가 바뀐 사용자 메시지' not in result['reply']
    diagnostics = client.get('/chat/diagnostics').json()
    assert '역할 필드가 없는 실제 답변' in result['reply']
    assert diagnostics['sessions'][0]['activity_counts']['bot:message'] == 2
    assert diagnostics['sessions'][0]['bot_message_count'] == 2
    assert SECRET not in json.dumps(diagnostics) and TOKEN not in json.dumps(diagnostics)
    assert client.get('/.env').status_code in (401, 404)
    posted = [r for r in calls if r.method == 'POST' and r.url.path.endswith('/activities')]
    posted_text = json.loads(posted[0].content)['text']
    assert posted_text.startswith('부품 목록\n\n라즈베리파이 펌프\n\n')
    assert '[미르 조사 우선·확인 질문 규칙]' in posted_text and 'clarification' in posted_text
    assert '질문보다 조사를 먼저' in posted_text and '핀 이름·핀 개수·핀 기능을 전부 나열하도록 요구하지 않습니다' in posted_text
    assert client.delete(f'/chat/sessions/{sid}').json() == {'ok': True}


def test_progress_can_arrive_after_five_minutes_from_shared_mcp_connection(chat):
    client, service, _, calls = chat
    sid = client.post('/chat/sessions').json()['session_id']
    rid = client.post(f'/chat/sessions/{sid}/messages', json={'message': '새 센서 배선'}).json()['request_id']
    session = service.sessions[sid]
    session.sent_at -= 600
    assert session.deadline is None
    assert f'request_id={rid}' in json.loads(calls[-1].content)['text']
    refreshed = 'refreshed-test-token'

    def handle(request):
        if request.url.path.endswith('/tokens/refresh'):
            assert request.headers['Authorization'] == 'Bearer ' + TOKEN
            return httpx.Response(200, json={'conversationId': session.conversation, 'token': refreshed, 'expires_in': 1800})
        assert request.headers['Authorization'] == 'Bearer ' + refreshed
        return httpx.Response(200, json={'activities': []})

    service.transport = httpx.MockTransport(handle)
    session.refresh_token_at = 0
    headers = {'X-API-Key': OTHER, 'Accept': 'application/json, text/event-stream'}

    def report(request_id, stage='research'):
        response = client.post('/mcp', headers=headers, json={
            'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
            'params': {'name': 'ReportChatProgress', 'arguments': {'request_id': request_id, 'stage': stage}},
        })
        assert response.status_code == 200
        return json.loads(response.json()['result']['content'][0]['text'])

    assert report('unrelated-request') == {'accepted': False}
    assert report(rid) == report(rid) == {'accepted': True}
    assert report(rid, 'wiring') == {'accepted': True}
    result = client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status'] == 'waiting'
    assert result['progress'] == [
        {'seq': 1, 'message': directline_chat.PROGRESS_STAGES['research']},
        {'seq': 2, 'message': directline_chat.PROGRESS_STAGES['wiring']},
    ]
    assert session.refresh_token_at > 0


def test_product_url_followup_attaches_reference_files_to_the_same_conversation(chat, monkeypatch):
    client, _, _, calls = chat
    product = 'https://example.com/boards/demo'
    page = b'''
        <img src="/logo.png" alt="Company logo">
        <img src="data:image/png;base64,placeholder" data-src="/front.png" alt="Demo board front">
        <img src="/pin-definition.jpg" alt="Pin definition">
        <img src="/outline.png" alt="Mechanical dimensions">
    '''
    buffer = BytesIO()
    Image.new('RGB', (100, 100), '#005fb0').save(buffer, 'PNG')
    fetched_urls = []

    def fetch(url, **kwargs):
        fetched_urls.append(url)
        return {'url': url, 'content_type': 'text/html' if url == product else 'image/png',
                'body': page if url == product else buffer.getvalue()}

    monkeypatch.setattr(directline_chat, 'resolve_reference_images',
                        lambda url: resolve_reference_images(url, fetcher=fetch))
    sid = client.post('/chat/sessions').json()['session_id']
    first = client.post(f'/chat/sessions/{sid}/messages', json={'message': 'LED를 깜빡이게 해줘'})
    assert first.status_code == 202
    assert client.get(f'/chat/sessions/{sid}/messages/{first.json()["request_id"]}').json()['status'] == 'completed'

    second = client.post(f'/chat/sessions/{sid}/messages', json={'message': product})
    assert second.status_code == 202
    assert second.json()['reply_timeout_seconds'] is None
    upload = next(request for request in calls if request.url.path.endswith('/upload'))
    first_message = next(request for request in calls if request.method == 'POST' and request.url.path.endswith('/activities'))
    assert upload.url.path.rsplit('/', 1)[0] == first_message.url.path.rsplit('/', 1)[0]
    assert upload.url.params['userId'] == json.loads(first_message.content)['from']['id']
    for name in ('board-photo.jpg', 'pin-definition.png', 'board-dimensions.png'):
        assert f'filename="{name}"'.encode() in upload.content
    assert '직전의 부품·회로 요청'.encode() in upload.content
    assert 'https://example.com/pin-definition.jpg'.encode() in upload.content
    assert 'https://example.com/logo.png' not in fetched_urls


def test_known_board_name_resolves_official_page_without_reusing_sibling_layout():
    root = directline_chat.ROOT
    assert first_reference_url('ESP32-P4-NANO로 LED 켜기', root) == 'https://docs.waveshare.com/ESP32-P4-NANO'
    assert first_reference_url('ESP32-P4-NANO-WIFI6-DB로 LED 켜기', root) is None
    assert first_reference_url('ESP32-P4-NANO https://example.com/pinout', root) == 'https://example.com/pinout'


def test_linked_pdf_drawing_attaches_the_selected_page():
    pdf = PdfWriter()
    pdf.add_blank_page(600, 300)
    pdf.add_blank_page(300, 600)
    content = BytesIO()
    pdf.write(content)
    page = 'https://example.com/boards/example'
    drawing = 'https://example.com/mechanical-drawing.pdf#page=2'

    def fetch(url, **kwargs):
        if url == page:
            return {'url': url, 'content_type': 'text/html',
                    'body': b'<a href="/mechanical-drawing.pdf#page=2">Drawing</a>'}
        assert url == drawing
        return {'url': url, 'content_type': 'application/pdf', 'body': content.getvalue()}

    (image,) = resolve_reference_images(page, fetcher=fetch)
    assert image.role == 'board-dimensions' and image.url == drawing
    with Image.open(BytesIO(image.content)) as rendered:
        assert rendered.format == 'PNG' and rendered.height == 2 * rendered.width


@pytest.mark.parametrize('first_source_unavailable', [False, True])
def test_discovered_board_link_continues_original_request_with_attachments(chat, monkeypatch, first_source_unavailable):
    client, service, _, _ = chat
    sid = client.post('/chat/sessions').json()['session_id']
    url = 'https://manufacturer.example/unknown-board'
    alternate = 'https://distributor.example/mechanical-drawing.pdf'
    posts = []
    uploads = []

    def upstream(request):
        if request.method == 'POST':
            posts.append(request)
            if request.url.path.endswith('/upload'):
                uploads.append(request)
            return httpx.Response(200, json={'id': f'posted-{len(posts)}'})
        if not request.url.params.get('watermark'):
            return httpx.Response(200, json={'watermark': 'before'})
        if not uploads:
            source = alternate if len(posts) == 2 else url
            reply = json.dumps({'type': 'mir_board_references', 'urls': [source]}, indent=2)
        else:
            reply = '{"type":"circuit","circuit_id":"new-board-circuit","version":1}'
        return httpx.Response(200, json={'watermark': 'after', 'activities': [
            {'id': f'reply-{len(posts)}', 'type': 'message', 'from': {'role': 'bot'}, 'text': reply},
            {'id': f'end-{len(posts)}', 'type': 'event', 'name': 'turn.complete', 'from': {'role': 'bot'}},
        ]})

    service.transport = httpx.MockTransport(upstream)

    def resolve(found):
        if first_source_unavailable and found == url:
            return []
        return [ReferenceImage('pin-definition', found, 'image/png', 'png', b'fixture')]

    monkeypatch.setattr(directline_chat, 'resolve_reference_images',
                        resolve)
    sent = client.post(f'/chat/sessions/{sid}/messages', json={'message': '처음 보는 보드로 LED 켜줘'}).json()
    path = f'/chat/sessions/{sid}/messages/{sent["request_id"]}'
    handoff = client.get(path).json()
    assert handoff['status'] == 'waiting' and handoff['reply_timeout_seconds'] is None
    if first_source_unavailable:
        assert not uploads
        assert '다른 호스트' in json.loads(posts[1].content)['text']
        assert client.get(path).json()['status'] == 'waiting'
    assert len(uploads) == 1 and (alternate if first_source_unavailable else url).encode() in uploads[0].content
    result = client.get(path).json()
    assert result['status'] == 'completed' and 'new-board-circuit' in result['reply']
    assert 'mir_board_references' not in result['reply'] and len(uploads) == 1


@pytest.mark.parametrize('rendered', [True, False])
def test_missing_artwork_pdf_in_final_answer_retries_the_saved_circuit(chat, monkeypatch, rendered):
    client, service, _, _ = chat
    sid = client.post('/chat/sessions').json()['session_id']
    url = 'https://manufacturer.example/board-mechanical-drawing.pdf'
    posts = []

    def upstream(request):
        if request.method == 'POST':
            posts.append(request)
            return httpx.Response(200, json={'id': f'posted-{len(posts)}'})
        if not request.url.params.get('watermark'):
            return httpx.Response(200, json={'watermark': 'before'})
        reply = (f'보드 그림은 미적용입니다. 기구 도면 ({url})을 첨부해 주세요.\n'
                 '```json\n{"type":"circuit_reference","circuit_id":"existing-board-circuit","version":1}\n```'
                 if len(posts) == 1 else '같은 보드에 그림을 적용했습니다.')
        return httpx.Response(200, json={'watermark': 'after', 'activities': [
            {'id': f'reply-{len(posts)}', 'type': 'message', 'from': {'role': 'bot'}, 'text': reply},
            {'id': f'end-{len(posts)}', 'type': 'event', 'name': 'turn.complete', 'from': {'role': 'bot'}},
        ]})

    service.transport = httpx.MockTransport(upstream)
    fetched = []

    def resolve(found):
        fetched.append(found)
        return [ReferenceImage('board-dimensions', found, 'image/png', 'png', b'fixture')] if rendered else []

    monkeypatch.setattr(directline_chat, 'resolve_reference_images', resolve)
    sent = client.post(f'/chat/sessions/{sid}/messages', json={'message': '보드로 LED 켜줘'}).json()
    path = f'/chat/sessions/{sid}/messages/{sent["request_id"]}'
    result = client.get(path).json()
    assert fetched == [url]
    if rendered:
        assert result['status'] == 'waiting'
        assert posts[1].url.path.endswith('/upload')
        assert b'board-dimensions.png' in posts[1].content
        assert b'existing-board-circuit' in posts[1].content
        result = client.get(path).json()
        assert '그림을 적용했습니다' in result['reply']
    else:
        assert len(posts) == 1
        assert '그림은 미적용입니다' in result['reply']
    assert result['status'] == 'completed' and 'existing-board-circuit' in result['reply']


def test_chat_auth_owner_isolation_and_limits(chat):
    client, service, env, calls = chat
    assert client.post('/chat/sessions', headers={'X-API-Key': 'bad'}).status_code == 401
    sid = client.post('/chat/sessions').json()['session_id']
    assert client.get('/chat/diagnostics', headers={'X-API-Key': OTHER}).json() == {'sessions': []}
    assert client.post(f'/chat/sessions/{sid}/messages', json={'message': 'x'}, headers={'X-API-Key': OTHER}).status_code == 404
    assert client.delete(f'/chat/sessions/{sid}', headers={'X-API-Key': OTHER}).status_code == 404
    assert client.post(f'/chat/sessions/{sid}/messages', json={'message': 'x' * 16001}).status_code == 422
    first = client.post(f'/chat/sessions/{sid}/messages', json={'message': 'x'})
    assert first.status_code == 202
    assert client.post(f'/chat/sessions/{sid}/messages', json={'message': 'again'}).status_code == 409
    assert client.get(f'/chat/sessions/{sid}/messages/wrong').status_code == 404


def test_env_hot_reload_and_no_secret_configured(chat):
    client, service, env, calls = chat
    env.write_text('COPILOT_DIRECT_LINE_SECRET=\n', encoding='utf-8')
    assert not client.get('/chat/config').json()['configured']
    result = client.post('/chat/sessions')
    assert result.status_code == 503
    assert result.json()['detail']['code'] == 'COPILOT_SECRET_NOT_CONFIGURED'
    assert calls == []
    env.write_text('COPILOT_DIRECT_LINE_SECRET=' + SECRET + '\n', encoding='utf-8')
    assert client.get('/chat/config').json()['configured']
    assert client.post('/chat/sessions').status_code == 201


def test_upstream_error_sanitized_and_not_retried(chat):
    client, service, env, calls = chat
    rejected = []
    def reject(request):
        rejected.append(request)
        return httpx.Response(403, json={'error': {'message': SECRET + TOKEN}})
    service.transport = httpx.MockTransport(reject)
    response = client.post('/chat/sessions')
    assert response.status_code == 502 and response.json()['detail']['code'] == 'DIRECT_LINE_AUTH_FAILED'
    assert SECRET not in response.text and TOKEN not in response.text
    assert len(rejected) == 1


def test_secret_cannot_be_sent_to_arbitrary_domain(chat):
    client, service, env, calls = chat
    for domain in ['http://directline.botframework.com/v3/directline', 'https://example.com/v3/directline',
                   'https://user:pass@directline.botframework.com/v3/directline', 'https://directline.botframework.com:invalid/v3/directline']:
        env.write_text(f'COPILOT_DIRECT_LINE_SECRET={SECRET}\nCOPILOT_DIRECT_LINE_DOMAIN={domain}\n', encoding='utf-8')
        assert client.post('/chat/sessions').status_code == 503
    assert calls == []


def test_response_timeout_requires_reset_no_duplicate_send(chat):
    client, service, env, calls = chat
    service.quiet_seconds = 100
    sid = client.post('/chat/sessions').json()['session_id']
    rid = client.post(f'/chat/sessions/{sid}/messages', json={'message': 'one'}).json()['request_id']
    service.sessions[sid].deadline = service.sessions[sid].sent_at
    result = client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status'] == 'failed' and result['error'] == 'DIRECT_LINE_REPLY_TIMEOUT'
    assert client.post(f'/chat/sessions/{sid}/messages', json={'message': 'two'}).status_code == 409
    assert len([r for r in calls if r.method == 'POST' and r.url.path.endswith('/activities')]) == 1


def test_uncertain_post_is_not_replayed_and_error_does_not_expose_secret(chat):
    client, service, env, calls = chat
    sid = client.post('/chat/sessions').json()['session_id']
    sent = []
    def broken(request):
        if request.method == 'GET':
            return httpx.Response(200, json={'activities': [], 'watermark': '0'})
        sent.append(request)
        raise httpx.ReadTimeout('upstream debug ' + SECRET + TOKEN)
    service.transport = httpx.MockTransport(broken)
    result = client.post(f'/chat/sessions/{sid}/messages', json={'message': 'save once'})
    assert result.status_code == 502
    assert SECRET not in result.text and TOKEN not in result.text
    assert client.post(f'/chat/sessions/{sid}/messages', json={'message': 'save again'}).status_code == 409
    assert len(sent) == 1


def test_card_only_reply_is_not_lost(chat):
    client, service, env, calls = chat
    sid = client.post('/chat/sessions').json()['session_id']
    rid = client.post(f'/chat/sessions/{sid}/messages', json={'message': 'new sensor'}).json()['request_id']
    def cards(request):
        return httpx.Response(200, json={'watermark':'3','activities':[{'id':'card', 'type':'message',
            'from':{'role':'bot'}, 'attachments':[{'contentType':'application/vnd.microsoft.card.adaptive',
            'content':{'body':[{'type':'TextBlock','text':'부품 생성에 추가 정보가 필요합니다.'}],
            'actions':[{'type':'Action.OpenUrl','url':'https://untrusted.example'}]}}]}]})
    service.transport = httpx.MockTransport(cards)
    result = client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status'] == 'completed'
    assert result['reply'] == '부품 생성에 추가 정보가 필요합니다.'
    assert 'untrusted.example' not in result['reply']


def test_long_work_timeout_is_configurable_and_bounded(chat):
    client, service, env, calls = chat
    assert client.get('/chat/config').json()['reply_timeout_seconds'] is None
    env.write_text('COPILOT_DIRECT_LINE_SECRET=' + SECRET + '\nCOPILOT_REPLY_TIMEOUT_SECONDS=600\n', encoding='utf-8')
    assert client.get('/chat/config').json()['reply_timeout_seconds'] == 600
    opened = client.post('/chat/sessions').json()
    assert opened['reply_timeout_seconds'] == 600
    sid = opened['session_id']
    client.post(f'/chat/sessions/{sid}/messages',json={'message':'research'})
    session = service.sessions[sid]
    assert 599 < session.deadline - session.sent_at <= 600
    env.write_text('COPILOT_DIRECT_LINE_SECRET=' + SECRET + '\nCOPILOT_REPLY_TIMEOUT_SECONDS=0\n', encoding='utf-8')
    assert client.get('/chat/config').json()['reply_timeout_seconds'] is None
    for invalid in ['29','901','NaN']:
        env.write_text('COPILOT_DIRECT_LINE_SECRET=' + SECRET + '\nCOPILOT_REPLY_TIMEOUT_SECONDS=' + invalid + '\n', encoding='utf-8')
        assert client.post('/chat/sessions').json()['detail']['code'] == 'INVALID_REPLY_TIMEOUT'


def test_empty_end_of_conversation_fails_without_waiting_for_timeout(chat):
    client, service, env, calls = chat
    sid = client.post('/chat/sessions').json()['session_id']
    rid = client.post(f'/chat/sessions/{sid}/messages',json={'message':'one'}).json()['request_id']
    service.transport = httpx.MockTransport(lambda request: httpx.Response(200,json={'activities':[
        {'id':'end', 'type':'endOfConversation','from':{'role':'bot'}}]}))
    result = client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status'] == 'failed' and result['error'] == 'DIRECT_LINE_ENDED_WITHOUT_REPLY'


def test_connection_required_card_reports_actionable_error(chat):
    client, service, env, calls = chat
    sid = client.post('/chat/sessions').json()['session_id']
    rid = client.post(f'/chat/sessions/{sid}/messages',json={'message':'new board'}).json()['request_id']
    service.transport = httpx.MockTransport(lambda request: httpx.Response(200,json={'activities':[
        {'id':'connection', 'type':'message','from':{'role':'bot'},'attachments':[
            {'contentType':'application/vnd.microsoft.card.adaptive','content':{'body':[
                {'type':'TextBlock','text':'Connection Required'},
                {'type':'TextBlock','text':'This action requires a connection to CircuitAgent. Set up your connection, then select Retry.'}]}}]}]}))
    result=client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status']=='failed' and result['error']=='COPILOT_TOOL_CONNECTION_REQUIRED'


def test_progress_message_does_not_end_turn_before_final_answer(chat):
    client, service, env, calls = chat
    sid = client.post('/chat/sessions').json()['session_id']
    rid = client.post(f'/chat/sessions/{sid}/messages',json={'message':'create missing board'}).json()['request_id']
    batches = iter([
        [{'id':'progress','type':'message','from':{'role':'bot'},'text':'DB에 부품이 없습니다. 공식 자료를 조사합니다.'}],
        [],
        [{'id':'final','type':'message','from':{'role':'bot'},'text':'저장했습니다. component_id: pico'}]])
    service.transport = httpx.MockTransport(lambda request: httpx.Response(200,json={'activities':next(batches),'watermark':'x'}))
    waiting = client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert waiting['status'] == 'waiting'
    assert waiting['progress'] == [{'seq': 1, 'message': 'DB에 부품이 없습니다. 공식 자료를 조사합니다.'}]
    assert client.get(f'/chat/sessions/{sid}/messages/{rid}').json()['status']=='waiting'
    final=client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert final['status']=='completed' and 'component_id: pico' in final['reply']
    assert '공식 자료를 조사합니다.' not in final['reply']


def test_turn_complete_delivers_plain_design_reply_without_marker(chat):
    client, service, env, calls = chat
    sid = client.post('/chat/sessions').json()['session_id']
    rid = client.post(f'/chat/sessions/{sid}/messages', json={
        'message': '[요청 종류: 배선 추천] 사용할 모터를 확인해 주세요.'
    }).json()['request_id']
    session = service.sessions[sid]
    def activities(request):
        return httpx.Response(200, json={'activities': [
            {'id': 'answer', 'type': 'message', 'from': {'id': 'copilot'},
             'replyToId': session.sent_activity_id, 'text': '모터의 종류와 모델명을 알려주세요.'},
            {'id': 'complete', 'type': 'event', 'name': 'turn.complete',
             'from': {'id': 'copilot'}, 'replyToId': session.sent_activity_id}
        ]})
    service.transport = httpx.MockTransport(activities)
    result = client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status'] == 'completed'
    assert result['reply'] == '모터의 종류와 모델명을 알려주세요.'
    client.post(f'/chat/sessions/{sid}/messages', json={'message': '후속 요청'})
    assert not session.turn_complete_seen


def test_unrelated_event_keeps_design_progress_waiting(chat):
    client, service, env, calls = chat
    sid = client.post('/chat/sessions').json()['session_id']
    rid = client.post(f'/chat/sessions/{sid}/messages', json={
        'message': '[요청 종류: 배선 추천] 모터'
    }).json()['request_id']
    service.transport = httpx.MockTransport(lambda request: httpx.Response(200, json={'activities': [
        {'id': 'progress', 'type': 'message', 'from': {'role': 'bot'}, 'text': '자료를 조사합니다.'},
        {'id': 'event', 'type': 'event', 'name': 'progress', 'from': {'role': 'bot'}}
    ]}))
    assert client.get(f'/chat/sessions/{sid}/messages/{rid}').json()['status'] == 'waiting'


def test_input_hint_marks_intermediate_reply():
    from app.directline_chat import is_progress_message
    assert is_progress_message('작업을 실행할 예정입니다.','ignoringInput')
    assert is_progress_message('공식 자료를 조사합니다.')
    assert is_progress_message('상세 정보와 기존 이미지를 확인하겠습니다.')
    assert is_progress_message('이미지 제작 에이전트에 맡깁니다.')
    assert not is_progress_message('부품을 저장했습니다.')
    assert not is_progress_message('전압이 몇 V인가요?')


def test_design_waits_past_unrecognized_english_progress_until_saved_reference(chat):
    client, service, env, calls = chat
    sid=client.post('/chat/sessions').json()['session_id']
    rid=client.post(f'/chat/sessions/{sid}/messages',json={'message':'[요청 종류: 배선 추천] 아두이노 우노'}).json()['request_id']
    batches=iter([
        [{'id':'p','type':'message','from':{'role':'bot'},'text':'Now the resistor image.'}],
        [],
        [{'id':'f','type':'message','from':{'role':'bot'},'text':'저장 완료\n```json\n{"type":"circuit_reference","circuit_id":"real-id","version":1}\n```'}]])
    service.transport=httpx.MockTransport(lambda request:httpx.Response(200,json={'activities':next(batches)}))
    assert client.get(f'/chat/sessions/{sid}/messages/{rid}').json()['status']=='waiting'
    assert client.get(f'/chat/sessions/{sid}/messages/{rid}').json()['status']=='waiting'
    assert client.get(f'/chat/sessions/{sid}/messages/{rid}').json()['status']=='completed'


def test_design_question_marker_finishes_without_inventing_connections(chat):
    client, service, env, calls = chat
    sid=client.post('/chat/sessions').json()['session_id']
    rid=client.post(f'/chat/sessions/{sid}/messages',json={'message':'[요청 종류: 배선 추천] 미확인 보드'}).json()['request_id']
    service.transport=httpx.MockTransport(lambda request:httpx.Response(200,json={'activities':[
        {'id':'question','type':'message','from':{'role':'bot'},'text':'어떤 센서를 연결할까요?<!--MIR_TURN_COMPLETE-->'}]}))
    result=client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status']=='completed' and result['reply']=='어떤 센서를 연결할까요?'


def test_single_get_network_error_recovers_without_resending_message(chat):
    client,service,env,calls=chat
    sid=client.post('/chat/sessions').json()['session_id']
    rid=client.post(f'/chat/sessions/{sid}/messages',json={'message':'one'}).json()['request_id']
    reads=[]
    def flaky(request):
        reads.append(request)
        if len(reads)==1: raise httpx.ConnectError('transient '+SECRET+TOKEN)
        return httpx.Response(200,json={'activities':[{'id':'answer','type':'message','from':{'role':'bot'},'text':'복구됨'}]})
    service.transport=httpx.MockTransport(flaky)
    result=client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status']=='completed' and result['reply']=='복구됨'
    assert len(reads)==2 and all(r.method=='GET' for r in reads)
    assert len([r for r in calls if r.method=='POST' and r.url.path.endswith('/activities')])==1
    assert SECRET not in str(result) and TOKEN not in str(result)


def test_temporary_poll_outage_keeps_session_and_recovers(chat):
    client,service,env,calls=chat
    sid=client.post('/chat/sessions').json()['session_id']
    rid=client.post(f'/chat/sessions/{sid}/messages',json={'message':'one'}).json()['request_id']
    def offline(request): raise httpx.ReadError('temporary')
    service.transport=httpx.MockTransport(offline)
    result=client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status']=='waiting' and result['recovering_connection']
    service.transport=httpx.MockTransport(lambda request:httpx.Response(200,json={'activities':[
        {'id':'answer','type':'message','from':{'role':'bot'},'text':'완료'}]}))
    result=client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status']=='completed' and not result['recovering_connection']
    assert service.sessions[sid].network_failures==0


def test_persistent_network_outage_is_bounded(chat):
    client,service,env,calls=chat
    sid=client.post('/chat/sessions').json()['session_id']
    rid=client.post(f'/chat/sessions/{sid}/messages',json={'message':'one'}).json()['request_id']
    reads=[]
    def offline(request):
        reads.append(request);raise httpx.ReadError('offline')
    service.transport=httpx.MockTransport(offline)
    for expected in ['waiting','waiting','failed']:
        result=client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
        assert result['status']==expected
    assert result['error']=='DIRECT_LINE_NETWORK_ERROR' and len(reads)==9


def test_specification_question_is_a_final_design_reply(chat):
    client,service,env,calls=chat
    sid=client.post('/chat/sessions').json()['session_id']
    rid=client.post(f'/chat/sessions/{sid}/messages',json={'message':'[요청 종류: 배선 추천] 태양광 패널'}).json()['request_id']
    answer=json.dumps({'type':'clarification','questions':['태양광 패널의 모델명과 개방전압(Voc)을 알려주세요.']},ensure_ascii=False)
    service.transport=httpx.MockTransport(lambda request:httpx.Response(200,json={'activities':[
        {'id':'specs','type':'message','from':{'role':'bot'},'text':'```json\n'+answer+'\n```'}]}))
    result=client.get(f'/chat/sessions/{sid}/messages/{rid}').json()
    assert result['status']=='completed' and 'clarification' in result['reply']
