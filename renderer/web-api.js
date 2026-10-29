import './web-chat.js';
import './server-connection.js';
import { createServerChatApi } from './server-chat.js?v=shared-server-1';
// Electron의 기존 연결은 유지하고, 일반 브라우저에서만 대체 연결을 만든다.
if (!window.api) {
  const localPage = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const localBase = localPage ? `http://${location.hostname}:8002` : null;
  let settings = { mode: 'demo', secret: '', tokenEndpoint: '' };
  try {
    const config = await fetch('./agent-config.json', { cache: 'no-store' });
    if (config.ok) settings = window.MirWebChat.readWebChatDefaults(await config.json());
  } catch { /* 로컬 설정이 없으면 데모를 사용한다. */ }
  let connection = { mode: localPage ? 'local' : 'remote', url: localPage ? '' : location.origin, key: '' };
  const requestCircuit = window.MirServerConnection.createTransport({ read: () => connection });
  let client = null;
  let catalogSentFor = null;
  const userParts = new Map();

  function download(data, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  function pickFiles(multiple = false) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json'; input.multiple = multiple;
      input.onchange = () => resolve([...input.files]);
      input.oncancel = () => resolve([]);
      input.click();
    });
  }

  function savePart(part) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(part.id) || !part.name || !Array.isArray(part.pins) || !part.pins.length) {
      throw new Error('부품의 id, name, pins를 확인하세요.');
    }
    userParts.set(part.id, part);
    return part.id;
  }

  async function getClient() {
    if (!client) {
      await import('./directline.js');
      client = new window.MirDirectLineClient(settings);
    }
    return client;
  }

  window.api = {
    browserMode: true,
    // 키·토큰·대화는 현재 탭의 메모리에만 보관한다.
    getSettings: async () => ({ mode: settings.mode, tokenEndpoint: settings.tokenEndpoint, webChatUrl: settings.webChatUrl, hasSecret: false }),
    setSettings: async (s) => {
      if (s.mode === 'secret') throw new Error('브라우저에서는 Direct Line 비밀 키 대신 토큰 끝점 URL을 사용하세요.');
      if (s.mode === 'token' && new URL(s.tokenEndpoint).protocol !== 'https:') throw new Error('HTTPS 토큰 URL이 필요합니다.');
      if (s.mode === 'web') s.webChatUrl = window.MirWebChat.validateWebChatUrl(s.webChatUrl);
      settings = { ...s, secret: '' }; client = null; catalogSentFor = null;
      return true;
    },
    sendToAgent: async (text, catalog) => {
      if (settings.mode === 'demo') return { demo: true };
      if (settings.mode === 'web') throw new Error('오른쪽 Microsoft 웹 채팅에서 메시지를 보내세요.');
      const c = await getClient();
      if (!c.conversationId) await c.start();
      const message = catalogSentFor === c.conversationId ? text : `${catalog}\n\n${text}`;
      const reply = await c.send(message);
      catalogSentFor = c.conversationId;
      return { reply };
    },
    testAgent: async () => {
      if (settings.mode === 'demo') return '데모 모드입니다.';
      if (settings.mode === 'web') {
        window.MirWebChat.validateWebChatUrl(settings.webChatUrl);
        return '웹 채팅 URL 형식을 확인했습니다. 실제 대화 권한과 응답은 오른쪽 채팅에서 확인하세요.';
      }
      const c = await getClient(); await c.start();
      return 'Copilot Studio 연결 성공';
    },
    resetAgent: async () => { client?.reset(); catalogSentFor = null; },
    listParts: async () => {
      const response = await fetch('./parts');
      if (!response.ok) throw new Error('부품 목록을 읽지 못했습니다.');
      const data = await response.json();
      const parts = new Map(data.parts.map((p) => [p.id, p]));
      for (const [id, p] of userParts) parts.set(id, p);
      return { parts: [...parts.values()], errors: data.errors };
    },
    savePart: async (p) => { savePart(p); download(p, `${p.id}.json`); return p.id; },
    importParts: async () => {
      const added = [], errors = [];
      for (const f of await pickFiles(true)) {
        try { added.push(savePart(JSON.parse(await f.text()))); }
        catch (e) { errors.push(`${f.name}: ${e.message}`); }
      }
      return { added, errors };
    },
    openPartsFolder: async () => alert('브라우저에서 추가한 부품은 이 탭에서만 유지됩니다. 내려받은 JSON을 + 파일로 다시 불러오세요.'),
    savePartTemplate: async () => download(await (await fetch('./template')).json(), 'my-part.json'),
    saveProject: async (d) => download(d, 'wiring.mir.json'),
    openProject: async () => { const [file] = await pickFiles(); return file ? JSON.parse(await file.text()) : null; },
    openDoc: async (name) => window.open(`./docs/${encodeURIComponent(name)}`, '_blank', 'noopener'),
    getAppIcon: async () => null,
    getServerConnection: async () => ({ mode: connection.mode, url: connection.url, hasKey: !!connection.key }),
    setServerConnection: async (input) => { connection = window.MirServerConnection.updateConnection(connection, input); return true; },
    getAutoAuthStatus: async () => {
      if (connection.mode === 'remote') {
        try { return { ready: (await requestCircuit('/chat/config')).status === 200, remote: true }; }
        catch { return { ready: false, remote: true }; }
      }
      if (!localBase) return { ready: false };
      try {
        const response = await fetch(localBase + '/local-connection/status', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000) });
        return response.ok ? await response.json() : { ready: false };
      } catch { return { ready: false }; }
    },
    openAgentWebsite: async (url) => window.open(window.MirWebChat.validateWebChatUrl(url), '_blank', 'noopener'),
    requestCircuit
  };
}
export const runtimeApi = createServerChatApi(window.api);
