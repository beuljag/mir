"""Direct Line 비밀 키와 대화 토큰을 서버 메모리에만 보관하는 채팅 연결."""
import asyncio
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote, urlsplit
from uuid import uuid4
import re
import json
import logging
from logging.handlers import RotatingFileHandler

import httpx
from dotenv import dotenv_values
from fastapi import Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

ROOT = Path(__file__).resolve().parents[1]


def chat_logger():
    logger = logging.getLogger('circuit.chat')
    logger.setLevel(logging.INFO)
    logger.propagate = False
    if not logger.handlers:
        folder = ROOT / 'logs'
        folder.mkdir(exist_ok=True)
        handler = RotatingFileHandler(folder / 'chat.log', maxBytes=2_000_000, backupCount=3, encoding='utf-8')
        handler.setFormatter(logging.Formatter('%(asctime)s %(message)s'))
        logger.addHandler(handler)
    return logger


class ChatError(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code


def settings(env_file=None):
    # 매번 읽으므로 .env에 키를 넣은 뒤 서버를 다시 시작할 필요가 없다.
    values = {**dotenv_values(env_file or ROOT / '.env', interpolate=False), **os.environ}
    secret = (values.get('COPILOT_DIRECT_LINE_SECRET') or '').strip()
    if any(ord(char) < 32 or ord(char) == 127 for char in secret):
        raise ChatError(503, 'INVALID_DIRECT_LINE_SECRET')
    domain = (values.get('COPILOT_DIRECT_LINE_DOMAIN') or 'https://directline.botframework.com/v3/directline').rstrip('/')
    try:
        parsed = urlsplit(domain)
        port = parsed.port
    except ValueError:
        raise ChatError(503, 'INVALID_DIRECT_LINE_DOMAIN') from None
    if (parsed.scheme != 'https' or parsed.username or parsed.password or port not in (None, 443)
            or not re.fullmatch(r'(?:[a-z0-9-]+\.)?directline\.botframework\.com', parsed.hostname or '')
            or parsed.path != '/v3/directline' or parsed.query or parsed.fragment):
        raise ChatError(503, 'INVALID_DIRECT_LINE_DOMAIN')
    return {'secret': secret, 'domain': domain,
            'mode': values.get('COPILOT_CHAT_MODE', 'directline'),
            'configured': bool(secret)}


@dataclass
class Session:
    owner: str
    conversation: str
    token: str
    domain: str
    user_id: str = field(default_factory=lambda: 'dl_' + uuid4().hex)
    watermark: str | None = None
    touched: float = field(default_factory=time.monotonic)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    catalog_sent: bool = False
    request_id: str | None = None
    deadline: float = 0
    last_reply: float = 0
    replies: list[str] = field(default_factory=list)
    seen: set[str] = field(default_factory=set)
    status: str = 'idle'
    error: str | None = None
    sent_at: float = 0
    polls: int = 0
    received: dict = field(default_factory=dict)
    sent_activity_id: str | None = None


class DirectLineChat:
    def __init__(self, env_file=None, transport=None):
        self.env_file, self.transport = env_file, transport
        self.sessions = {}
        self.creation_lock = asyncio.Lock()
        self.reply_timeout = 120
        self.quiet_seconds = 3
        self.logger = chat_logger()

    def trace(self, event, **fields):
        self.logger.info(json.dumps({'event': event, 'mock': self.transport is not None, **fields}, ensure_ascii=False))

    def diagnostics(self, owner):
        return [{'session_ref': sid[-8:], 'status': s.status, 'polls': s.polls,
                 'elapsed_seconds': round(time.monotonic() - s.sent_at, 1) if s.sent_at else 0,
                 'bot_message_count': len(s.replies), 'activity_counts': dict(s.received), 'error': s.error}
                for sid, s in self.sessions.items() if s.owner == owner]

    def config(self):
        cfg = settings(self.env_file)
        return {'mode': cfg['mode'], 'configured': cfg['configured'], 'provider': 'copilot-directline'}

    async def rpc(self, domain, token, method, path, body=None, params=None):
        started = time.monotonic()
        operation = 'conversation' if path == '/conversations' else 'activities'
        try:
            async with httpx.AsyncClient(transport=self.transport, timeout=15, follow_redirects=False, trust_env=False) as client:
                response = await client.request(method, domain + path,
                    headers={'Authorization': 'Bearer ' + token}, json=body, params=params)
        except httpx.HTTPError:
            self.trace('upstream_network_error', method=method, operation=operation,
                       duration_ms=round((time.monotonic() - started) * 1000))
            raise ChatError(502, 'DIRECT_LINE_NETWORK_ERROR') from None
        self.trace('upstream_response', method=method, operation=operation, status=response.status_code,
                   duration_ms=round((time.monotonic() - started) * 1000))
        # 제공자가 오류 본문에 키나 토큰을 반사하더라도 브라우저·로그에 내보내지 않는다.
        if response.status_code >= 300:
            code = 'DIRECT_LINE_AUTH_FAILED' if response.status_code in (401, 403) else 'DIRECT_LINE_UPSTREAM_ERROR'
            raise ChatError(502, code)
        try:
            data = response.json()
            if not isinstance(data, dict):
                raise ValueError('expected object')
            return data
        except ValueError:
            raise ChatError(502, 'DIRECT_LINE_INVALID_RESPONSE') from None

    async def start(self, owner):
        cfg = settings(self.env_file)
        if not cfg['configured']:
            raise ChatError(503, 'COPILOT_SECRET_NOT_CONFIGURED')
        async with self.creation_lock:
            now = time.monotonic()
            self.sessions = {key: s for key, s in self.sessions.items() if now - s.touched < 1800}
            if len(self.sessions) >= 64 or sum(s.owner == owner for s in self.sessions.values()) >= 16:
                raise ChatError(429, 'CHAT_SESSION_LIMIT')
            data = await self.rpc(cfg['domain'], cfg['secret'], 'POST', '/conversations')
            conversation, token = data.get('conversationId'), data.get('token')
            if not isinstance(conversation, str) or not conversation or not isinstance(token, str) or not token:
                raise ChatError(502, 'DIRECT_LINE_INVALID_RESPONSE')
            sid = uuid4().hex
            self.sessions[sid] = Session(owner, conversation, token, cfg['domain'])
            self.trace('session_started', session_ref=sid[-8:])
            return {'session_id': sid}

    def get(self, sid, owner):
        session = self.sessions.get(sid)
        if session is None or session.owner != owner:
            raise ChatError(404, 'CHAT_SESSION_NOT_FOUND')
        if time.monotonic() - session.touched >= 1800:
            self.sessions.pop(sid, None)
            raise ChatError(410, 'CHAT_SESSION_EXPIRED')
        session.touched = time.monotonic()
        return session

    async def send(self, sid, owner, message, catalog):
        session = self.get(sid, owner)
        async with session.lock:
            if session.status == 'waiting':
                raise ChatError(409, 'CHAT_REQUEST_IN_PROGRESS')
            if session.status == 'failed':
                raise ChatError(409, 'CHAT_SESSION_NEEDS_RESET')
            text = (catalog + '\n\n' if catalog and not session.catalog_sent else '') + message
            if len(text.encode('utf-8')) > 200000:
                raise ChatError(422, 'CHAT_MESSAGE_TOO_LARGE')
            # 초기 인사와 이전 응답이 다음 요청의 응답으로 섞이지 않게 현재 위치를 읽는다.
            data = await self.rpc(session.domain, session.token, 'GET', f'/conversations/{quote(session.conversation, safe="")}/activities', params={'watermark': session.watermark} if session.watermark else None)
            session.watermark = data.get('watermark', session.watermark)
            session.request_id = uuid4().hex
            session.status = 'waiting'
            session.replies, session.seen, session.error = [], set(), None
            session.deadline, session.last_reply = time.monotonic() + self.reply_timeout, 0
            session.sent_at, session.polls, session.received = time.monotonic(), 0, {}
            try:
                accepted = await self.rpc(session.domain, session.token, 'POST', f'/conversations/{quote(session.conversation, safe="")}/activities',
                    {'type': 'message', 'from': {'id': session.user_id, 'role': 'user'}, 'text': text, 'locale': 'ko-KR'})
                session.sent_activity_id = accepted.get('id') if isinstance(accepted.get('id'), str) else None
            except ChatError:
                # POST 수락 여부가 불확실할 때 자동 재전송하지 않는다.
                session.status, session.error = 'failed', 'CHAT_SEND_UNCONFIRMED'
                raise
            session.catalog_sent = True
            self.trace('message_accepted', session_ref=sid[-8:], message_chars=len(message), catalog_included=bool(catalog))
            return {'request_id': session.request_id, 'status': session.status}

    async def poll(self, sid, owner, rid):
        session = self.get(sid, owner)
        async with session.lock:
            if rid != session.request_id:
                raise ChatError(404, 'CHAT_REQUEST_NOT_FOUND')
            if session.status == 'waiting':
                try:
                    data = await self.rpc(session.domain, session.token, 'GET', f'/conversations/{quote(session.conversation, safe="")}/activities',
                        params={'watermark': session.watermark} if session.watermark else None)
                    session.watermark = data.get('watermark', session.watermark)
                    session.polls += 1
                    for activity in data.get('activities', []):
                        if not isinstance(activity, dict) or not isinstance(activity.get('from'), dict):
                            continue
                        sender = activity['from']
                        aid = activity.get('id')
                        if aid and aid in session.seen:
                            continue
                        if aid:
                            session.seen.add(aid)
                        kind = activity.get('type')
                        kind = kind if kind in ('message', 'typing', 'event', 'endOfConversation', 'messageUpdate') else 'other'
                        # 일부 채널의 봇 답변은 role이 없다. 이 경우 전송한 메시지에 대한
                        # replyToId를 확인한다. 서버가 ID를 바꾼 사용자 에코는 수신 답변에서 제외한다.
                        bot_reply = sender.get('role') in ('bot', 'assistant', 'agent') or (
                            sender.get('role') not in ('user',) and sender.get('id') != session.user_id
                            and session.sent_activity_id is not None
                            and activity.get('replyToId') == session.sent_activity_id)
                        role = 'bot' if bot_reply else 'other'
                        summary = role + ':' + kind
                        session.received[summary] = session.received.get(summary, 0) + 1
                        if role != 'bot':
                            continue
                        text = activity.get('text')
                        if activity.get('type') == 'message' and isinstance(text, str) and text:
                            session.replies.append(text)
                            session.last_reply = time.monotonic()
                        elif activity.get('type') == 'typing' and session.replies:
                            session.last_reply = time.monotonic()
                    if session.replies and time.monotonic() - session.last_reply >= self.quiet_seconds:
                        session.status = 'completed'
                    elif time.monotonic() >= session.deadline:
                        session.status, session.error = 'failed', 'DIRECT_LINE_REPLY_TIMEOUT'
                except ChatError as exc:
                    session.status, session.error = 'failed', exc.code
                self.trace('reply_progress', session_ref=sid[-8:], status=session.status, polls=session.polls,
                           elapsed_seconds=round(time.monotonic() - session.sent_at, 1),
                           bot_message_count=len(session.replies), activity_counts=session.received, error=session.error)
            result = {'status': session.status, 'polls': session.polls,
                      'elapsed_seconds': round(time.monotonic() - session.sent_at, 1) if session.sent_at else 0,
                      'bot_message_count': len(session.replies)}
            if session.status == 'completed':
                result['reply'] = '\n\n'.join(session.replies)
            if session.error:
                result['error'] = session.error
            return result


class MessageRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    message: str = Field(min_length=1, max_length=16000)
    catalog: str = Field(default='', max_length=70000)


def attach_chat(app, authenticate):
    service = DirectLineChat()
    app.state.chat = service

    def fail(exc):
        raise HTTPException(exc.status, detail={'code': exc.code})

    @app.get('/chat/config', include_in_schema=False)
    def config():
        try:
            return app.state.chat.config()
        except ChatError as exc:
            return {'mode': 'directline', 'configured': False, 'error': exc.code}

    @app.post('/chat/sessions', include_in_schema=False, status_code=201)
    async def start(owner=Depends(authenticate)):
        try:
            return await app.state.chat.start(owner)
        except ChatError as exc:
            fail(exc)

    @app.get('/chat/diagnostics', include_in_schema=False)
    def diagnostics(owner=Depends(authenticate)):
        return {'sessions': app.state.chat.diagnostics(owner)}

    @app.post('/chat/sessions/{sid}/messages', include_in_schema=False, status_code=202)
    async def send(sid: str, body: MessageRequest, owner=Depends(authenticate)):
        try:
            return await app.state.chat.send(sid, owner, body.message, body.catalog)
        except ChatError as exc:
            fail(exc)

    @app.get('/chat/sessions/{sid}/messages/{rid}', include_in_schema=False)
    async def poll(sid: str, rid: str, owner=Depends(authenticate)):
        try:
            return await app.state.chat.poll(sid, owner, rid)
        except ChatError as exc:
            fail(exc)

    @app.delete('/chat/sessions/{sid}', include_in_schema=False)
    def reset(sid: str, owner=Depends(authenticate)):
        try:
            app.state.chat.get(sid, owner)
            del app.state.chat.sessions[sid]
            return {'ok': True}
        except ChatError as exc:
            fail(exc)
