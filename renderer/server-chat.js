// 서버의 Direct Line 연결을 미르의 기존 채팅 UI에 붙인다. 비밀 키는 받지 않는다.
export function createServerChatApi(base, { sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let apiKey = '', sessionId = null, selectedMode = null, generation = 0, inFlight = false;
  const messages = {
    CIRCUIT_API_KEY_REQUIRED: '로컬 자동 연결을 사용할 수 없습니다. 서버켜기.bat로 서버를 실행하고 새로고침하세요. 키는 .env에서 관리합니다.',
    COPILOT_SECRET_NOT_CONFIGURED: '서버 .env의 COPILOT_DIRECT_LINE_SECRET에 Direct Line 비밀 키를 넣으세요.',
    DIRECT_LINE_AUTH_FAILED: 'Direct Line 인증에 실패했습니다. 비밀 키와 지역별 Direct Line 주소를 확인하세요.',
    DIRECT_LINE_REPLY_TIMEOUT: '응답 대기 시간이 끝났습니다. 새 대화를 연 뒤 상태를 확인하세요. 요청은 자동 재전송하지 않습니다.',
    CHAT_SESSION_NEEDS_RESET: '새로 만들기로 대화를 다시 연 뒤 요청하세요.',
    CHAT_SESSION_EXPIRED: '대화가 만료됐습니다. 새로 만들기로 다시 시작하세요.'
  };
  function error(code, status) {
    const e = new Error(messages[code] || code); e.code = code; e.status = status; return e;
  }
  async function call(path, method = 'GET', body) {
    const response = await base.requestCircuit(path, {
      method, headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (response.status >= 400) throw error(response.body?.detail?.code || `HTTP ${response.status}`, response.status);
    return response.body;
  }
  async function requireKey() {
    if (!apiKey && !(await base.getAutoAuthStatus?.())?.ready) throw error('CIRCUIT_API_KEY_REQUIRED');
  }
  function checkGeneration(value) { if (value !== generation) throw error('CHAT_RESET'); }
  return {
    ...base,
    setCircuitKey: (key) => {
      if (key !== apiKey) { apiKey = key; sessionId = null; generation++; }
    },
    getSettings: async () => {
      const previous = await base.getSettings();
      let config;
      try { config = await call('/chat/config'); } catch { config = null; }
      const mode = selectedMode || (config?.mode === 'directline' ? 'server' : previous.mode);
      const autoAuth = await base.getAutoAuthStatus?.();
      return { ...previous, mode, serverSecretConfigured: !!config?.configured, apiKeyReady: !!apiKey || !!autoAuth?.ready };
    },
    setSettings: async (settings) => {
      if (settings.mode !== 'server') await base.setSettings(settings);
      selectedMode = settings.mode;
    },
    sendToAgent: async (text, catalog, onProgress = () => {}) => {
      if (selectedMode !== 'server') return base.sendToAgent(text, catalog);
      await requireKey();
      if (inFlight) throw error('CHAT_REQUEST_IN_PROGRESS');
      const current = generation;
      inFlight = true;
      try {
        if (!sessionId) {
          onProgress({ stage: 'opening' });
          const opened = await call('/chat/sessions', 'POST');
          checkGeneration(current); sessionId = opened.session_id;
        }
        const sent = await call(`/chat/sessions/${sessionId}/messages`, 'POST', { message: text, catalog: catalog || '' });
        onProgress({ stage: 'waiting' });
        checkGeneration(current);
        const until = Date.now() + 150000;
        while (Date.now() < until) {
          await sleep(900); checkGeneration(current);
          const result = await call(`/chat/sessions/${sessionId}/messages/${sent.request_id}`);
          onProgress({ stage: result.bot_message_count ? 'receiving' : 'waiting', ...result });
          checkGeneration(current);
          if (result.status === 'completed') return { reply: result.reply };
          if (result.status === 'failed') throw error(result.error || 'DIRECT_LINE_REPLY_FAILED');
        }
        throw error('DIRECT_LINE_REPLY_TIMEOUT');
      } finally { inFlight = false; }
    },
    testAgent: async () => {
      if (selectedMode !== 'server') return base.testAgent();
      await requireKey();
      const opened = await call('/chat/sessions', 'POST');
      await call(`/chat/sessions/${opened.session_id}`, 'DELETE');
      return '서버 .env의 키로 Direct Line 대화 생성에 성공했습니다. 실제 답변은 채팅에서 확인하세요.';
    },
    resetAgent: async () => {
      const previous = sessionId; sessionId = null; generation++;
      if (previous && apiKey) {
        try { await call(`/chat/sessions/${previous}`, 'DELETE'); } catch { /* 만료된 대화는 서버에서 정리한다. */ }
      }
      await base.resetAgent();
    },
    selectMode: (mode) => { selectedMode = mode; }
  };
}
