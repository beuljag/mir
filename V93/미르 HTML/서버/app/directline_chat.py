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
    try:
        reply_timeout = int(values['COPILOT_REPLY_TIMEOUT_SECONDS']) if values.get('COPILOT_REPLY_TIMEOUT_SECONDS') else None
        if reply_timeout is not None and not 30 <= reply_timeout <= 900: raise ValueError()
    except (ValueError, TypeError):
        raise ChatError(503, 'INVALID_REPLY_TIMEOUT') from None
    return {'reply_timeout_seconds': reply_timeout, 'secret': secret, 'domain': domain,
            'mode': values.get('COPILOT_CHAT_MODE', 'directline'),
            'configured': bool(secret)}


FINAL_MARKER = '<!--MIR_TURN_COMPLETE-->'


def has_design_result(text):
    candidates = re.findall(r'```(?:json)?\s*([\s\S]*?)```', text)
    candidates.append(text)
    for candidate in candidates:
        try: data = json.loads(candidate)
        except (ValueError, TypeError): continue
        if isinstance(data, dict) and (
                (data.get('type') == 'clarification' and isinstance(data.get('questions'), list)
                 and data['questions'] and all(isinstance(q, str) and q.strip() for q in data['questions']))
                or isinstance(data.get('circuit_id'), str)
                or (data.get('type') == 'wiring' and isinstance(data.get('parts'), list) and data['parts'])):
            return True
    return False


def is_progress_message(text, input_hint=None):
    # Bot Framework의 ignoringInput과 명확한 진행 안내는 최종 응답이 아니다.
    if input_hint == 'ignoringInput': return True
    if input_hint == 'acceptingInput': return False
    last = text.strip().split('\n')[-1].strip()
    return bool(re.search(r'(?:조사|검색|조회|확인|분석|생성|제작|저장|등록|처리|위임|전달|요청|진행)(?:합니다|하겠습니다|할게요|하고 있습니다| 중입니다| 중이에요)[.!。…]*$', last)
                or re.search(r'(?:하겠습니다|해드리겠습니다|할게요|드릴게요|맡깁니다|맡기겠습니다)[.!。…]*$', last)
                or re.fullmatch(r'(?:잠시만|잠깐만) 기다려 ?(?:주세요|주십시오)[.!…]*', last))


def activity_text(activity):
    """테キ스트 없는 카드도 읽되 링크·버튼·외부 콘텐츠는 실행하지 않는다."""
    text = activity.get('text')
    if isinstance(text, str) and text.strip(): return text
    chunks = []
    def collect(node, depth=0):
        if depth > 12 or len(chunks) >= 100: return
        if isinstance(node, list):
            for item in node[:100]: collect(item, depth + 1)
        elif isinstance(node, dict):
            for name in ('title', 'subtitle', 'text'):
                if isinstance(node.get(name), str): chunks.append(node[name][:16000])
            for name in ('body', 'items', 'columns', 'inlines', 'facts'):
                collect(node.get(name), depth + 1)
            if node.get('type') is None and isinstance(node.get('value'), str): chunks.append(node['value'][:16000])
    attachments = activity.get('attachments')
    if isinstance(attachments, list):
        for attachment in attachments[:20]:
            if isinstance(attachment, dict) and attachment.get('contentType') in (
                'application/vnd.microsoft.card.adaptive', 'application/vnd.microsoft.card.hero',
                'application/vnd.microsoft.card.thumbnail'):
                collect(attachment.get('content'))
    return '\n'.join(chunks)[:64000]


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
    awaiting_work: bool = False
    requires_design_result: bool = False
    final_result_seen: bool = False
    network_failures: int = 0


class DirectLineChat:
    def __init__(self, env_file=None, transport=None):
        self.env_file, self.transport = env_file, transport
        self.sessions = {}
        self.creation_lock = asyncio.Lock()
        self.reply_timeout = 300
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
        return {'mode': cfg['mode'], 'configured': cfg['configured'], 'provider': 'copilot-directline',
                'reply_timeout_seconds': cfg['reply_timeout_seconds'] or self.reply_timeout}

    async def rpc(self, domain, token, method, path, body=None, params=None):
        started = time.monotonic()
        operation = 'conversation' if path == '/conversations' else 'activities'
        # GET만 재시도한다. POST는 수락 여부가 불명확하므로 자동 재전송하지 않는다.
        attempts = 3 if method == 'GET' else 1
        for attempt in range(attempts):
            try:
                async with httpx.AsyncClient(transport=self.transport, timeout=10 if method == 'GET' else 15,
                                             follow_redirects=False, trust_env=False) as client:
                    response = await client.request(method, domain + path,
                        headers={'Authorization': 'Bearer ' + token}, json=body, params=params)
                break
            except httpx.HTTPError as exc:
                self.trace('upstream_network_error', method=method, operation=operation,
                           attempt=attempt + 1, error_type=type(exc).__name__,
                           duration_ms=round((time.monotonic() - started) * 1000))
                if attempt + 1 == attempts:
                    raise ChatError(502, 'DIRECT_LINE_NETWORK_ERROR') from None
                await asyncio.sleep(0.25 if attempt == 0 else 0.75)
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
            return {'session_id': sid, 'reply_timeout_seconds': cfg['reply_timeout_seconds'] or self.reply_timeout}

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
            session.requires_design_result = '[요청 종류: 배선 추천]' in message
            session.final_result_seen = False
            text = (catalog + '\n\n' if catalog and not session.catalog_sent else '') + message
            text += '\n\n[미르 조사 우선·확인 질문 규칙] ' + '질문보다 조사를 먼저 합니다. 1) SearchComponents/GetComponentDetails로 DB와 출처를 확인하고, 모델로 찾을 수 있는 핀맵·핀 기능·동작 전압·정격·데이터시트는 검색 에이전트와 웹 검색/ResearchComponent/AnalyzeDatasheet로 직접 조사합니다. 비어 있는 pins나 unresolved_fields를 그대로 사용자에게 채우라고 요구하지 않습니다. 2) 조회한 실제 공식 자료와 작업 결과를 확인해 부품 정의를 보완하고 설계를 계속합니다. 검색 수단이 없거나 실패하면 성공했다고 꾸미지 않습니다. 3) 조사해도 실제 사용할 제품을 특정할 수 없을 때만 최소한의 식별 정보(모델명·제조사·모듈 변형)를 묻습니다. 예: 태양광 패널의 모델명을 알려주세요. 모델을 받으면 Voc와 핀 정보는 다시 직접 조사하고, 공개 자료로 알 수 없는 실제 제품의 값만 추가로 묻습니다. 사용자가 핀 이름·핀 개수·핀 기능을 전부 나열하도록 요구하지 않습니다. 사용자 제작 보드처럼 공식 자료가 없는 경우에만 자료 링크나 핀맵을 요청할 수 있습니다. 4) 이 확인 질문에는 필요한 부품명과 항목만 짧게 쓰고 오류 위치·내부 도구·실패 원인 설명을 붙이지 않습니다. 최종 JSON은 {"type":"clarification","questions":["태양광 패널의 모델명을 알려주세요."]}로 반환합니다. 사양을 추측하거나 확인 전 배선을 확정하지 않습니다.' + ' 조사 후보의 unresolved_fields나 agent_extraction_tasks는 검토·추출 항목이지 사용자 필수 입력 목록이 아닙니다. document_sections와 evidence를 읽어 실제 확인할 수 있는 내용을 먼저 추출합니다. 상품명 전체 문자열이 일치하지 않아도 source.title, source_title_identifiers, identifier_matches로 모델을 재확인합니다. 사용자 메시지에 제시된 OUT·VCC·GND 같은 핀 표기는 근거로 반영하고 같은 표기를 다시 나열하라고 묻지 않습니다. 확인된 핀 역할과 아직 확인되지 않은 전원 정격·제품 변형은 별도로 취급합니다. 모터와 외부 전원에는 다음 규칙을 우선 적용합니다. 모터는 제품 식별에 필요한 종류와 모델명 중 빠진 항목만 묻습니다. 정격 전압·전류, 기동·스톨 전류, 핀맵과 사용법은 모델로 DB와 제조사 자료를 직접 조사합니다. 확인하지 못한 정격은 미확인으로 남기고, 그 값이 필요한 실제 배선은 확정하지 않습니다. 정격이나 핀 정보를 사용자에게 요구하지 않습니다. 외부 전원이 필요하고 사용자가 종류를 지정하지 않으면 배터리를 기본으로 사용합니다. 파워서플라이 등 다른 전원을 지정하거나 나중에 변경하면 그 선택에 맞춰 설계를 갱신합니다. 일반 외부 전원의 모델명이나 전압별 핀 유무를 묻지 않습니다. 확인된 부하와 드라이버 사양에 맞춰 필요한 출력 전압과 전류 용량을 선정합니다. 파워서플라이는 출력 설정값과 +/− 출력 단자로 표현하고, 기기별 단자 배치나 출력 범위를 확인하지 못하면 필요한 조건만 안내합니다.'
            if session.requires_design_result:
                text += '\n\n[미르 응답 계약] 진행 중 안내는 최종 결과가 아닙니다. 실제 회로 저장 결과 또는 화면용 배선 JSON까지 실행하세요. 최종 답변은 한국어로 작성하고 맨 마지막에 ' + FINAL_MARKER + '를 붙이세요. 정보가 부족해 작업을 멈추고 질문하는 경우에도 마지막에 이 표식을 붙이세요. 단순 중간 안내에는 표식을 붙이지 마세요.'
            if len(text.encode('utf-8')) > 200000:
                raise ChatError(422, 'CHAT_MESSAGE_TOO_LARGE')
            # 초기 인사와 이전 응답이 다음 요청의 응답으로 섞이지 않게 현재 위치를 읽는다.
            data = await self.rpc(session.domain, session.token, 'GET', f'/conversations/{quote(session.conversation, safe="")}/activities', params={'watermark': session.watermark} if session.watermark else None)
            session.watermark = data.get('watermark', session.watermark)
            session.request_id = uuid4().hex
            session.status = 'waiting'
            session.replies, session.seen, session.error = [], set(), None
            session.awaiting_work = False
            session.network_failures = 0
            session.deadline, session.last_reply = time.monotonic() + (settings(self.env_file)['reply_timeout_seconds'] or self.reply_timeout), 0
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
                    session.network_failures = 0
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
                        attachments = activity.get('attachments')
                        self.trace('bot_activity', session_ref=sid[-8:], kind=kind,
                                   has_text=bool(activity.get('text')), has_speak=bool(activity.get('speak')),
                                   input_hint=activity.get('inputHint') if activity.get('inputHint') in ('acceptingInput','ignoringInput','expectingInput') else None,
                                   attachment_count=len(attachments) if isinstance(attachments, list) else 0)
                        text = activity_text(activity)
                        final_marked = FINAL_MARKER in text
                        text = text.replace(FINAL_MARKER, '').strip()
                        if activity.get('type') == 'message' and isinstance(text, str) and text:
                            session.replies.append(text)
                            session.final_result_seen = session.final_result_seen or final_marked or has_design_result(text) or activity.get('inputHint') == 'expectingInput'
                            session.awaiting_work = (session.requires_design_result and not session.final_result_seen) or (not session.final_result_seen and is_progress_message(text, activity.get('inputHint')))
                            session.last_reply = time.monotonic()
                            if text.lstrip().startswith('Connection Required') and 'Set up your connection' in text:
                                session.status, session.error = 'failed', 'COPILOT_TOOL_CONNECTION_REQUIRED'
                        elif activity.get('type') == 'endOfConversation':
                            if session.replies: session.status = 'completed'
                            else: session.status, session.error = 'failed', 'DIRECT_LINE_ENDED_WITHOUT_REPLY'
                        elif activity.get('type') == 'typing' and session.replies:
                            session.last_reply = time.monotonic()
                    if session.status == 'waiting' and session.replies and not session.awaiting_work and time.monotonic() - session.last_reply >= self.quiet_seconds:
                        session.status = 'completed'
                    elif session.status == 'waiting' and time.monotonic() >= session.deadline:
                        session.status, session.error = 'failed', 'DIRECT_LINE_REPLY_TIMEOUT'
                except ChatError as exc:
                    if exc.code == 'DIRECT_LINE_NETWORK_ERROR':
                        session.network_failures += 1
                    if exc.code == 'DIRECT_LINE_NETWORK_ERROR' and session.network_failures < 3 and time.monotonic() < session.deadline:
                        self.trace('poll_reconnecting', session_ref=sid[-8:], failures=session.network_failures)
                    else:
                        session.status, session.error = 'failed', exc.code
                self.trace('reply_progress', session_ref=sid[-8:], status=session.status, polls=session.polls,
                           elapsed_seconds=round(time.monotonic() - session.sent_at, 1),
                           bot_message_count=len(session.replies), activity_counts=session.received, error=session.error)
            result = {'status': session.status, 'polls': session.polls,
                      'elapsed_seconds': round(time.monotonic() - session.sent_at, 1) if session.sent_at else 0,
                      'bot_message_count': len(session.replies),
                      'recovering_connection': session.status == 'waiting' and session.network_failures > 0}
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
