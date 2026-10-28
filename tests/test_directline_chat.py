import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.directline_chat import ChatError, DirectLineChat, settings
from app.main import create_app

KEY = 'chat-api-test-key-123456789012345'
OTHER = 'chat-api-other-key-12345678901234'
SECRET = 'mock-directline-secret-do-not-return'
TOKEN = 'mock-conversation-token-do-not-return'


@pytest.fixture
def chat(tmp_path, monkeypatch):
    for key in ('COPILOT_DIRECT_LINE_SECRET', 'COPILOT_DIRECT_LINE_DOMAIN', 'COPILOT_CHAT_MODE'):
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
    assert json.loads(posted[0].content)['text'] == '부품 목록\n\n라즈베리파이 펌프'
    assert client.delete(f'/chat/sessions/{sid}').json() == {'ok': True}


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
    service.reply_timeout = 0
    sid = client.post('/chat/sessions').json()['session_id']
    rid = client.post(f'/chat/sessions/{sid}/messages', json={'message': 'one'}).json()['request_id']
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
