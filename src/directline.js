// Copilot Studio 에이전트와 Direct Line(v3) REST API로 대화한다.
// 연결 방법은 두 가지:
//   1) secret        : Copilot Studio > 설정 > 보안 > 웹 채널 보안 의 비밀 키
//   2) tokenEndpoint : 미르 토큰 서버 주소(https://내서버, /token 자동), 또는
//                      Copilot Studio > 채널 > 모바일 앱 의 토큰 끝점 URL (인증 없음 설정일 때)

const DEFAULT_DOMAIN = 'https://directline.botframework.com/v3/directline';

// 미르 서버 주소만 적었으면(https://내서버) 뒤에 /token 을 붙인다. 경로가 있는 주소는 그대로 쓴다.
function withTokenPath(url) {
  try {
    const u = new URL(url);
    if (u.pathname === '/' || u.pathname === '') u.pathname = '/token';
    return u.toString();
  } catch {
    return url;
  }
}
const USER = { id: 'mir-user', name: '학생' };

class DirectLineClient {
  constructor(config) {
    this.config = config;
    this.token = null;
    this.conversationId = null;
    this.watermark = null;
    this.domain = DEFAULT_DOMAIN;
  }

  async getToken() {
    const { mode, secret, tokenEndpoint } = this.config;
    if (mode === 'secret') {
      if (!secret) throw new Error('Direct Line 비밀 키가 설정되지 않았습니다.');
      return secret;
    }
    if (!tokenEndpoint) throw new Error('토큰 끝점 URL이 설정되지 않았습니다.');
    const r = await fetch(withTokenPath(tokenEndpoint));
    if (!r.ok) throw new Error(`토큰 발급 실패 (${r.status})`);
    const data = await r.json();
    if (!data.token) throw new Error('토큰 끝점 응답에 token이 없습니다.');
    // 미르 토큰 서버는 domain을 함께 알려준다. Copilot Studio 토큰 끝점이면 지역 설정을 물어본다.
    if (data.domain) this.domain = data.domain.replace(/\/$/, '') + '/v3/directline';
    else await this.useRegionalDomain(tokenEndpoint);
    return data.token;
  }

  async useRegionalDomain(tokenEndpoint) {
    try {
      const u = new URL(tokenEndpoint);
      const settingsUrl = `${u.origin}/powervirtualagents/regionalchannelsettings?api-version=2022-03-01-preview`;
      const rs = await fetch(settingsUrl);
      if (rs.ok) {
        const data = await rs.json();
        const dl = data?.channelUrlsById?.directline;
        if (dl) this.domain = dl.replace(/\/$/, '') + '/v3/directline';
      }
    } catch { /* 기본 도메인 사용 */ }
  }

  async request(path, options = {}) {
    const r = await fetch(this.domain + path, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`Direct Line 오류 ${r.status}: ${text.slice(0, 200)}`);
    }
    return r.status === 204 ? null : r.json();
  }

  async start() {
    this.token = await this.getToken();
    const conv = await this.request('/conversations', { method: 'POST' });
    this.conversationId = conv.conversationId;
    if (conv.token) this.token = conv.token;
    this.watermark = null;
    // 에이전트의 인사말(대화 시작 토픽)을 받아서 버린다.
    await this.request(`/conversations/${this.conversationId}/activities`, {
      method: 'POST',
      body: JSON.stringify({ type: 'event', name: 'startConversation', from: USER, locale: 'ko-KR' })
    });
    await this.collectReplies({ timeoutMs: 8000, quietMs: 1500 });
  }

  async collectReplies({ timeoutMs = 90000, quietMs = 2500 } = {}) {
    const started = Date.now();
    let lastNew = 0;
    const replies = [];
    while (Date.now() - started < timeoutMs) {
      await new Promise((r) => setTimeout(r, 800));
      const q = this.watermark ? `?watermark=${encodeURIComponent(this.watermark)}` : '';
      const set = await this.request(`/conversations/${this.conversationId}/activities${q}`);
      this.watermark = set.watermark;
      const fromBot = (set.activities || []).filter((a) => a.from?.id !== USER.id);
      for (const a of fromBot) {
        if (a.type === 'message' && (a.text || a.attachments?.length)) {
          replies.push(a.text || '');
          lastNew = Date.now();
        }
      }
      // 첫 답을 받은 뒤 잠잠해지면 끝난 것으로 본다(에이전트가 여러 메시지로 나눠 보낼 수 있음).
      if (replies.length && Date.now() - lastNew > quietMs) break;
    }
    if (!replies.length) throw new Error('에이전트 응답 시간이 초과되었습니다.');
    return replies.join('\n\n');
  }

  async send(text) {
    if (!this.conversationId) await this.start();
    try {
      await this.postMessage(text);
    } catch (e) {
      // 대화가 만료되었으면 새로 연다.
      if (/40[134]/.test(e.message)) {
        await this.start();
        await this.postMessage(text);
      } else throw e;
    }
    return this.collectReplies();
  }

  postMessage(text) {
    return this.request(`/conversations/${this.conversationId}/activities`, {
      method: 'POST',
      body: JSON.stringify({ type: 'message', from: USER, text, locale: 'ko-KR' })
    });
  }

  reset() {
    this.conversationId = null;
    this.watermark = null;
  }
}

module.exports = { DirectLineClient };
