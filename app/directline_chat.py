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

from .chat_reference_images import first_reference_url, resolve_reference_images

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
        reply_timeout = int(values.get('COPILOT_REPLY_TIMEOUT_SECONDS') or 0)
        if reply_timeout and not 30 <= reply_timeout <= 900:
            raise ValueError()
    except (ValueError, TypeError):
        raise ChatError(503, 'INVALID_REPLY_TIMEOUT') from None
    return {'reply_timeout_seconds': reply_timeout or None, 'secret': secret, 'domain': domain,
            'mode': values.get('COPILOT_CHAT_MODE', 'directline'),
            'configured': bool(secret)}


FINAL_MARKER = '<!--MIR_TURN_COMPLETE-->'
PROGRESS_STAGES = {
    'lookup': '부품함에서 사용할 부품을 확인하고 있어요.',
    'research': '제조사 자료에서 핀 배치와 전압 사양을 확인하고 있어요.',
    'artwork': '부품의 그림과 핀 위치를 준비하고 있어요.',
    'wiring': '확인된 핀을 바탕으로 배선을 설계하고 있어요.',
    'verify': '전원과 핀 연결을 검토하고 있어요.',
    'save': '설계 결과를 미르에 저장하고 있어요.',
}
REFERENCE_REQUEST = re.compile(r'\{\s*"type"\s*:\s*"mir_board_references"\s*,\s*"urls"\s*:\s*\[[^\]]{0,4100}\]\s*\}')
REFERENCE_INSTRUCTIONS = (
    '\n\n[미르 보드 자료 전달] 모든 제조사에 적용합니다. 기존 그림이 없는 보드에서 실물 그림 또는 핀 배치에 필요한 '
    '이미지를 아직 읽지 못했다면 정확한 모델과 제조사의 공식 제품 페이지, 상면 사진, 핀 배치도 또는 치수도 URL을 먼저 찾으세요. '
    '공개 PDF 치수도도 사용할 수 있습니다. 여러 페이지의 문서는 필요한 페이지 번호를 주소 끝에 #page=번호로 붙입니다. '
    '찾은 공개 HTTPS 주소를 {"type":"mir_board_references","urls":["실제 HTTPS URL","대체 HTTPS URL"]} '
    '형식의 JSON 메시지 하나로 반환하고 이번 응답을 끝냅니다. URL은 최대 2개입니다. 미르가 자료를 첨부해 같은 대화를 이어갑니다. '
    '미르가 이미 해당 자료를 시도했다고 알려주면 읽은 근거로 작업을 계속하고, 확인하지 못한 위치는 추측하지 않습니다. '
    '핀 이름과 방향은 핀표에서, 편집기의 연결점은 상면도에서 확인합니다. PCB 제작용 치수·공차는 치수도나 CAD를 사용합니다.'
)


def requested_reference_urls(text):
    match = REFERENCE_REQUEST.search(text)
    if not match:
        return None
    try:
        urls = json.loads(match.group())['urls']
    except ValueError:
        return []
    return list(dict.fromkeys(url for url in urls if isinstance(url, str)
                             and url.startswith('https://') and len(url) <= 2000))[:2]


def structured_results(text):
    candidates = re.findall(r'```(?:json)?\s*([\s\S]*?)```', text)
    candidates.append(text)
    for candidate in candidates:
        try: data = json.loads(candidate)
        except (ValueError, TypeError): continue
        if isinstance(data, dict):
            yield data


def saved_circuit_reference(text):
    for data in structured_results(text):
        if isinstance(data.get('circuit_id'), str):
            reference = {'type': 'circuit_reference', 'circuit_id': data['circuit_id']}
            if isinstance(data.get('version'), int):
                reference['version'] = data['version']
            return reference
    return None


def artwork_retry_urls(text):
    # A published agent can describe the missing drawing in prose even when
    # it did not use the structured request for visual references.
    if not all(re.search(pattern, text) for pattern in (
            r'그림|이미지|외형', r'미적용|미등록|(?:읽지|확인하지|적용하지|저장하지) 못', r'도면|핀 배치', r'첨부')):
        return []
    candidates = re.findall(r'https://[^\s<>"\[\]{}()]+', text)
    return list(dict.fromkeys(url.rstrip('.,;:!?。') for url in candidates
                              if len(url) <= 2000 and re.search(r'\.pdf(?:[?#]|$)', url.rstrip('.,;:!?。'), re.I)))[:2]


def has_design_result(text):
    for data in structured_results(text):
        if (
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
    deadline: float | None = None
    refresh_token_at: float | None = None
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
    turn_complete_seen: bool = False
    network_failures: int = 0
    reference_attempts: set[str] = field(default_factory=set)
    reference_rounds: int = 0
    pending_references: list[str] | None = None
    reference_fallback: list[str] = field(default_factory=list)
    progress: list[dict] = field(default_factory=list)
    reported_stages: set[str] = field(default_factory=set)

    def add_progress(self, message):
        message = message.strip()[:600]
        if message and (not self.progress or self.progress[-1]['message'] != message):
            seq = self.progress[-1]['seq'] + 1 if self.progress else 1
            self.progress.append({'seq': seq, 'message': message})
            del self.progress[:-20]


class DirectLineChat:
    def __init__(self, env_file=None, transport=None):
        self.env_file, self.transport = env_file, transport
        self.sessions = {}
        self.creation_lock = asyncio.Lock()
        self.reference_slots = asyncio.Semaphore(4)
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
                'reply_timeout_seconds': cfg['reply_timeout_seconds']}

    def report_progress(self, request_id, stage):
        # The MCP connection can use a different key from the MIR client.
        # The random request ID scopes this write to one active turn.
        for session in tuple(self.sessions.values()):
            if session.request_id == request_id and session.status == 'waiting':
                if stage not in session.reported_stages:
                    session.reported_stages.add(stage)
                    session.add_progress(PROGRESS_STAGES[stage])
                    self.trace('agent_work_stage', stage=stage)
                return True
        return False

    async def rpc(self, domain, token, method, path, body=None, params=None, files=None):
        started = time.monotonic()
        operation = {'/conversations': 'conversation', '/tokens/refresh': 'token_refresh'}.get(
            path, 'upload' if files else 'activities')
        # GET만 재시도한다. POST는 수락 여부가 불명확하므로 자동 재전송하지 않는다.
        attempts = 3 if method == 'GET' else 1
        for attempt in range(attempts):
            try:
                async with httpx.AsyncClient(transport=self.transport, timeout=10 if method == 'GET' else 15,
                                             follow_redirects=False, trust_env=False) as client:
                    response = await client.request(method, domain + path,
                        headers={'Authorization': 'Bearer ' + token}, json=body, params=params, files=files)
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
            session = self.sessions[sid] = Session(owner, conversation, token, cfg['domain'])
            self.schedule_token_refresh(session, data.get('expires_in'))
            self.trace('session_started', session_ref=sid[-8:])
            return {'session_id': sid, 'reply_timeout_seconds': cfg['reply_timeout_seconds']}

    @staticmethod
    def schedule_token_refresh(session, expires_in):
        if type(expires_in) is int and expires_in > 0:
            session.refresh_token_at = time.monotonic() + expires_in - min(120, expires_in / 2)

    async def refresh_token_if_needed(self, session):
        if session.refresh_token_at is None or time.monotonic() < session.refresh_token_at:
            return
        data = await self.rpc(session.domain, session.token, 'POST', '/tokens/refresh')
        token, expires_in = data.get('token'), data.get('expires_in')
        if (data.get('conversationId') != session.conversation or not isinstance(token, str) or not token
                or type(expires_in) is not int or expires_in <= 0):
            raise ChatError(502, 'DIRECT_LINE_INVALID_RESPONSE')
        session.token = token
        self.schedule_token_refresh(session, expires_in)

    def get(self, sid, owner):
        session = self.sessions.get(sid)
        if session is None or session.owner != owner:
            raise ChatError(404, 'CHAT_SESSION_NOT_FOUND')
        if time.monotonic() - session.touched >= 1800:
            self.sessions.pop(sid, None)
            raise ChatError(410, 'CHAT_SESSION_EXPIRED')
        session.touched = time.monotonic()
        return session

    async def reference_images(self, urls):
        if self.reference_slots.locked() or not urls:
            return []
        async with self.reference_slots:
            results = await asyncio.gather(*(asyncio.to_thread(resolve_reference_images, url) for url in urls))
        # Prefer the first usable official source; fill missing diagram types
        # from the alternate source, within the existing upload size limit.
        images = {}
        for result in results:
            for image in result:
                images.setdefault(image.role, image)
        return list(images.values())

    async def post_activity(self, session, text, images):
        path = f'/conversations/{quote(session.conversation, safe="")}'
        activity = {'type': 'message', 'from': {'id': session.user_id, 'role': 'user'}, 'text': text, 'locale': 'ko-KR'}
        if images:
            files = [('activity', ('activity.json', json.dumps(activity, ensure_ascii=False), 'application/vnd.microsoft.activity'))]
            files.extend(('file', (image.filename, image.content, image.content_type)) for image in images)
            accepted = await self.rpc(session.domain, session.token, 'POST', path + '/upload',
                                      params={'userId': session.user_id}, files=files)
        else:
            accepted = await self.rpc(session.domain, session.token, 'POST', path + '/activities', activity)
        session.sent_activity_id = accepted.get('id') if isinstance(accepted.get('id'), str) else None

    async def continue_with_references(self, session, existing_circuit=None):
        urls = [url for url in session.pending_references if url not in session.reference_attempts]
        session.pending_references = None
        session.reference_rounds += 1
        session.reference_attempts.update(urls)
        images = await self.reference_images(urls) if session.reference_rounds <= 2 else []
        if existing_circuit and not images:
            self.trace('reference_continuation', reference_image_count=0, round=session.reference_rounds)
            session.status = 'completed'
            return
        if images:
            session.add_progress('찾은 제조사 도면을 첨부해 설계를 이어가고 있어요.')
        text = ('[미르 제조사 자료 확인 결과] 직전 사용자 요청을 이어서 처리하세요. 이미지 보기 기능으로 첨부를 열어 '
                '모델·핀 배치·헤더 방향을 확인하세요. '
                '제조사 도면에서 기판 외곽과 패드 중심이 보이면 그 페이지를 SVG 배치 근거로 사용합니다. '
                '이미 처리한 주소는 다시 요청하지 마세요.')
        if not existing_circuit:
            text += ' 확인된 핀으로 회로를 저장한 뒤 그림을 제작·적용하세요.'
        if images:
            text += '\n첨부 파일과 출처:\n' + '\n'.join(f'- {image.filename} → {image.url}' for image in images)
        else:
            text += '\n요청한 주소에서 첨부 파일을 가져오지 못했습니다.'
            if urls:
                text += '\n시도한 주소:\n' + '\n'.join(f'- {url}' for url in urls)
            if session.reference_rounds < 2:
                text += ('\n제조사 파일 서버, 제조사 공식 저장소, 제조사 원본을 배포하는 유통사 등 다른 호스트에서 '
                         '같은 모델의 도면이나 상면 사진을 찾아 자료 요청을 한 번 더 하세요. 같은 주소는 반복하지 마세요.')
            else:
                text += '\n확인한 자료로 이어가고 근거가 부족한 핀과 외형은 미확인으로 표시하세요.'
        if session.reference_rounds >= 2:
            text += '\n이번 사용자 메시지에서 자동 자료 요청은 종료했습니다. 확인된 범위로 실제 결과와 답변을 반환하세요.'
        if existing_circuit:
            text += ('\n이 회로는 이미 저장되었습니다. 같은 회로의 보드 부품에 그림만 제작·저장·적용하고, '
                     '최종 응답에도 기존 회로 참조를 반환하세요. ' + json.dumps(existing_circuit, ensure_ascii=False))
            session.reference_fallback = session.replies.copy()
        text += '\n최종 답변 끝에 ' + FINAL_MARKER + '를 붙이세요.'
        # A rejected/uncertain POST must never be retried from the next poll.
        try:
            await self.post_activity(session, text, images)
        except ChatError as exc:
            session.status, session.error = 'failed', exc.code
            return
        session.replies.clear()
        session.turn_complete_seen = session.final_result_seen = False
        session.awaiting_work = True
        session.last_reply = 0
        self.trace('reference_continuation', reference_image_count=len(images), round=session.reference_rounds)

    async def send(self, sid, owner, message, catalog):
        session = self.get(sid, owner)
        async with session.lock:
            if session.status == 'waiting':
                raise ChatError(409, 'CHAT_REQUEST_IN_PROGRESS')
            if session.status == 'failed':
                raise ChatError(409, 'CHAT_SESSION_NEEDS_RESET')
            request_id = uuid4().hex
            reply_timeout = settings(self.env_file)['reply_timeout_seconds']
            session.requires_design_result = '[요청 종류: 배선 추천]' in message
            session.final_result_seen = False
            session.turn_complete_seen = False
            session.reference_attempts.clear()
            session.reference_rounds = 0
            session.pending_references = None
            session.reference_fallback.clear()
            text = (catalog + '\n\n' if catalog and not session.catalog_sent else '') + message
            text += '\n\n[미르 조사 우선·확인 질문 규칙] ' + '질문보다 조사를 먼저 합니다. 1) SearchComponents/GetComponentDetails로 DB와 출처를 확인하고, 모델로 찾을 수 있는 핀맵·핀 기능·동작 전압·정격·데이터시트는 검색 에이전트와 웹 검색/ResearchComponent/AnalyzeDatasheet로 직접 조사합니다. 비어 있는 pins나 unresolved_fields를 그대로 사용자에게 채우라고 요구하지 않습니다. 2) 조회한 실제 공식 자료와 작업 결과를 확인해 부품 정의를 보완하고 설계를 계속합니다. 검색 수단이 없거나 실패하면 성공했다고 꾸미지 않습니다. 3) 조사해도 실제 사용할 제품을 특정할 수 없을 때만 최소한의 식별 정보(모델명·제조사·모듈 변형)를 묻습니다. 예: 태양광 패널의 모델명을 알려주세요. 모델을 받으면 Voc와 핀 정보는 다시 직접 조사하고, 공개 자료로 알 수 없는 실제 제품의 값만 추가로 묻습니다. 사용자가 핀 이름·핀 개수·핀 기능을 전부 나열하도록 요구하지 않습니다. 사용자 제작 보드처럼 공식 자료가 없는 경우에만 자료 링크나 핀맵을 요청할 수 있습니다. 4) 이 확인 질문에는 필요한 부품명과 항목만 짧게 쓰고 오류 위치·내부 도구·실패 원인 설명을 붙이지 않습니다. 최종 JSON은 {"type":"clarification","questions":["태양광 패널의 모델명을 알려주세요."]}로 반환합니다. 사양을 추측하거나 확인 전 배선을 확정하지 않습니다.' + ' 조사 후보의 unresolved_fields나 agent_extraction_tasks는 검토·추출 항목이지 사용자 필수 입력 목록이 아닙니다. document_sections와 evidence를 읽어 실제 확인할 수 있는 내용을 먼저 추출합니다. 상품명 전체 문자열이 일치하지 않아도 source.title, source_title_identifiers, identifier_matches로 모델을 재확인합니다. 사용자 메시지에 제시된 OUT·VCC·GND 같은 핀 표기는 근거로 반영하고 같은 표기를 다시 나열하라고 묻지 않습니다. 확인된 핀 역할과 아직 확인되지 않은 전원 정격·제품 변형은 별도로 취급합니다. 모터와 외부 전원에는 다음 규칙을 우선 적용합니다. 모터는 제품 식별에 필요한 종류와 모델명 중 빠진 항목만 묻습니다. 정격 전압·전류, 기동·스톨 전류, 핀맵과 사용법은 모델로 DB와 제조사 자료를 직접 조사합니다. 확인하지 못한 정격은 미확인으로 남기고, 그 값이 필요한 실제 배선은 확정하지 않습니다. 정격이나 핀 정보를 사용자에게 요구하지 않습니다. 외부 전원이 필요하고 사용자가 종류를 지정하지 않으면 배터리를 기본으로 사용합니다. 파워서플라이 등 다른 전원을 지정하거나 나중에 변경하면 그 선택에 맞춰 설계를 갱신합니다. 일반 외부 전원의 모델명이나 전압별 핀 유무를 묻지 않습니다. 확인된 부하와 드라이버 사양에 맞춰 필요한 출력 전압과 전류 용량을 선정합니다. 파워서플라이는 출력 설정값과 +/− 출력 단자로 표현하고, 기기별 단자 배치나 출력 범위를 확인하지 못하면 필요한 조건만 안내합니다.'
            text += ('\n\n[기존 부품과 제조사 자료 우선] SearchComponents로 미르 기본 부품과 DB를 먼저 찾고, '
                     '맞는 기본 부품의 ID·그림·가상 동작을 재사용합니다. 빨간 LED는 led-red, 220Ω 저항은 resistor-220입니다. '
                     '새 실물 부품은 정확한 모델의 제조사 공식 제품 페이지·데이터시트·외형 자료를 우선 확인합니다. '
                     '실물 보드의 그림은 공식 사진 또는 CAD와 핀 배치도로 커넥터 위치를 확인하고 physical_layout을 사용합니다.')
            text += REFERENCE_INSTRUCTIONS
            text += ('\n\n[미르 진행 안내] 작업 단계가 바뀔 때 ReportChatProgress를 사용할 수 있으면 '
                     f'request_id={request_id}로 현재 단계(lookup, research, artwork, wiring, verify, save)를 한 번씩 알리세요. '
                     '이미 보고한 단계는 반복하지 마세요. 진행 안내는 최종 답변과 별개입니다. '
                     '도구가 없으면 지원되는 경우에만 별도 중간 메시지를 보내고 계속 진행하세요.')
            images = []
            if reference_url := first_reference_url(message, ROOT):
                images = await self.reference_images([reference_url])
                session.reference_attempts.add(reference_url)
                text += ('\n\n[미르 참고 링크] 링크만 보냈다면 직전의 부품·회로 요청을 이어서 처리합니다. '
                         '첨부 이미지의 보기 기능을 사용해 제조사 도면에 보이는 기판 외곽과 패드 중심을 SVG 배치에 활용합니다. '
                         '첨부된 핀 배치도와 치수도로 해당 모델의 핀 번호·방향·배선 연결점을 확인하고, '
                         '사진은 외형 확인에 씁니다. 읽은 근거와 원본 URL을 부품 검색 및 이미지 제작 에이전트에 전달합니다. '
                         '같은 모델의 이전 초안에 핀이 비어 있으면 새로 확인한 핀으로 새 초안을 저장해 그 ID를 씁니다. '
                         '첨부로 필요한 핀이 확인된 회로 요청은 그 핀으로 회로를 먼저 저장하고, 같은 부품 ID에 SVG를 제작·적용합니다. '
                         '필요한 자료가 빠졌거나 첨부를 읽지 못했다면 링크의 제조사 자료를 더 조사합니다. '
                         '사용자에게 핀 번호를 그대로 옮겨 적거나 같은 자료를 다시 올리게 하기 전에 대체 출처를 확인합니다. '
                         '확인한 핀만 배선에 사용합니다.')
                if images:
                    text += '\n첨부 파일과 출처:\n' + '\n'.join(f'- {image.filename} → {image.url}' for image in images)
            if session.requires_design_result:
                text += '\n\n[미르 응답 계약] 진행 중 안내는 최종 결과가 아닙니다. 실제 회로 저장 결과 또는 화면용 배선 JSON까지 실행하세요. 최종 답변은 한국어로 작성하고 맨 마지막에 ' + FINAL_MARKER + '를 붙이세요. 정보가 부족해 작업을 멈추고 질문하는 경우에도 마지막에 이 표식을 붙이세요. 단순 중간 안내에는 표식을 붙이지 마세요.'
            if len(text.encode('utf-8')) > 200000:
                raise ChatError(422, 'CHAT_MESSAGE_TOO_LARGE')
            # 초기 인사와 이전 응답이 다음 요청의 응답으로 섞이지 않게 현재 위치를 읽는다.
            await self.refresh_token_if_needed(session)
            data = await self.rpc(session.domain, session.token, 'GET', f'/conversations/{quote(session.conversation, safe="")}/activities', params={'watermark': session.watermark} if session.watermark else None)
            session.watermark = data.get('watermark', session.watermark)
            session.request_id = request_id
            session.status = 'waiting'
            session.replies, session.seen, session.error = [], set(), None
            session.progress.clear()
            session.reported_stages.clear()
            session.awaiting_work = False
            session.network_failures = 0
            session.sent_at, session.polls, session.received = time.monotonic(), 0, {}
            session.deadline = None if reply_timeout is None else session.sent_at + reply_timeout
            session.last_reply = 0
            if images:
                session.add_progress('제조사 사진이나 도면을 요청에 첨부했어요.')
            try:
                await self.post_activity(session, text, images)
            except ChatError:
                # POST 수락 여부가 불확실할 때 자동 재전송하지 않는다.
                session.status, session.error = 'failed', 'CHAT_SEND_UNCONFIRMED'
                raise
            session.catalog_sent = True
            self.trace('message_accepted', session_ref=sid[-8:], message_chars=len(message),
                       catalog_included=bool(catalog), reference_image_count=len(images))
            return {'request_id': session.request_id, 'status': session.status, 'reply_timeout_seconds': reply_timeout}

    async def poll(self, sid, owner, rid):
        session = self.get(sid, owner)
        async with session.lock:
            if rid != session.request_id:
                raise ChatError(404, 'CHAT_REQUEST_NOT_FOUND')
            if session.status == 'waiting':
                try:
                    await self.refresh_token_if_needed(session)
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
                                   turn_complete=kind == 'event' and activity.get('name') == 'turn.complete',
                                   has_text=bool(activity.get('text')), has_speak=bool(activity.get('speak')),
                                   input_hint=activity.get('inputHint') if activity.get('inputHint') in ('acceptingInput','ignoringInput','expectingInput') else None,
                                   attachment_count=len(attachments) if isinstance(attachments, list) else 0)
                        text = activity_text(activity)
                        final_marked = FINAL_MARKER in text
                        text = text.replace(FINAL_MARKER, '').strip()
                        if activity.get('type') == 'message' and isinstance(text, str) and text:
                            if (urls := requested_reference_urls(text)) is not None:
                                if session.reference_rounds >= 2:
                                    session.replies.append('제조사 도면을 확인하지 못해 보드 그림을 적용할 수 없어요.')
                                    session.status = 'completed'
                                else:
                                    session.pending_references = urls
                                    session.last_reply = time.monotonic()
                                continue
                            final = final_marked or has_design_result(text) or activity.get('inputHint') == 'expectingInput'
                            connection_required = text.lstrip().startswith('Connection Required') and 'Set up your connection' in text
                            if not final and not connection_required and is_progress_message(text, activity.get('inputHint')):
                                session.add_progress(text)
                                session.awaiting_work = not session.final_result_seen
                                session.last_reply = time.monotonic()
                                continue
                            session.replies.append(text)
                            if not session.reference_rounds and session.pending_references is None and saved_circuit_reference(text):
                                urls = [url for url in artwork_retry_urls(text) if url not in session.reference_attempts]
                                if urls:
                                    session.pending_references = urls
                            session.final_result_seen = session.final_result_seen or final
                            session.awaiting_work = session.requires_design_result and not session.final_result_seen
                            session.last_reply = time.monotonic()
                            if connection_required:
                                session.status, session.error = 'failed', 'COPILOT_TOOL_CONNECTION_REQUIRED'
                        elif activity.get('type') == 'endOfConversation':
                            if session.replies: session.status = 'completed'
                            else: session.status, session.error = 'failed', 'DIRECT_LINE_ENDED_WITHOUT_REPLY'
                        elif activity.get('type') == 'typing' and session.replies:
                            session.last_reply = time.monotonic()
                        elif kind == 'event' and activity.get('name') == 'turn.complete':
                            session.turn_complete_seen = True
                    if (session.status == 'waiting' and session.pending_references is not None
                            and (session.turn_complete_seen or time.monotonic() - session.last_reply >= self.quiet_seconds)):
                        existing_circuit = next((reference for text in reversed(session.replies)
                                                 if (reference := saved_circuit_reference(text))), None)
                        if not session.final_result_seen or existing_circuit:
                            await self.continue_with_references(session, existing_circuit)
                    if session.status == 'waiting' and session.turn_complete_seen:
                        if session.replies:
                            session.status = 'completed'
                        else:
                            session.status, session.error = 'failed', 'DIRECT_LINE_ENDED_WITHOUT_REPLY'
                    if session.status == 'waiting' and session.replies and not session.awaiting_work and time.monotonic() - session.last_reply >= self.quiet_seconds:
                        session.status = 'completed'
                    elif session.status == 'waiting' and session.deadline is not None and time.monotonic() >= session.deadline:
                        session.status, session.error = 'failed', 'DIRECT_LINE_REPLY_TIMEOUT'
                except ChatError as exc:
                    if exc.code == 'DIRECT_LINE_NETWORK_ERROR':
                        session.network_failures += 1
                    if (exc.code == 'DIRECT_LINE_NETWORK_ERROR' and session.network_failures < 3
                            and (session.deadline is None or time.monotonic() < session.deadline)):
                        self.trace('poll_reconnecting', session_ref=sid[-8:], failures=session.network_failures)
                    else:
                        session.status, session.error = 'failed', exc.code
                self.trace('reply_progress', session_ref=sid[-8:], status=session.status, polls=session.polls,
                           elapsed_seconds=round(time.monotonic() - session.sent_at, 1),
                           bot_message_count=len(session.replies), activity_counts=session.received, error=session.error)
            if session.reference_fallback and session.status == 'failed':
                session.status, session.error = 'completed', None
                session.replies = session.reference_fallback.copy()
            if session.reference_fallback and session.status == 'completed':
                if not any(saved_circuit_reference(reply) for reply in session.replies):
                    reference = next(ref for reply in reversed(session.reference_fallback) if (ref := saved_circuit_reference(reply)))
                    session.replies.append('```json\n' + json.dumps(reference, ensure_ascii=False) + '\n```')
                session.reference_fallback.clear()
            result = {'status': session.status, 'polls': session.polls,
                      'elapsed_seconds': round(time.monotonic() - session.sent_at, 1) if session.sent_at else 0,
                      'reply_timeout_seconds': None if session.deadline is None else round(session.deadline - session.sent_at),
                      'progress': session.progress.copy(),
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
