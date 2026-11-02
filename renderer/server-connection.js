// Electron과 브라우저가 같은 서버 주소·경로 검사를 사용한다.
(function (root) {
  function normalizeServerUrl(value) {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('서버 주소는 경로·계정 정보 없이 입력하세요.');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('외부 서버에는 HTTPS 주소가 필요합니다.');
    return url.origin;
  }
  const routes = /^\/(?:chat\/(?:config|diagnostics|sessions(?:\/[a-f0-9]+(?:\/messages(?:\/[a-f0-9]+)?)?)?)|verification\/(?:config|projects(?:\/[a-f0-9]{32}(?:\/verify)?)?|jobs\/[a-f0-9-]+\/artifacts\/(?:erc\.json|erc\.log|export\.cir|export\.log|run\.cir|ngspice\.log))|jobs\/[a-f0-9-]+|components\/search(?:\?limit=100(?:&offset=[0-9]{1,5})?)?|components\/[a-zA-Z0-9_.%-]+(?:\/image)?|circuits(?:\/[a-zA-Z0-9-]+(?:\/validate)?)?)$/;
  function updateConnection(previous, input) {
    if (input.mode !== 'remote') return { mode: 'local', url: '', key: '' };
    const url = normalizeServerUrl(input.url.trim());
    const key = input.key?.trim() || (previous.url === url ? previous.key : '');
    if (!key || key.length < 24 || /[\r\n]/.test(key)) throw new Error('배선 API 키를 입력하세요. 서버 주소를 바꾸면 키도 다시 입력해야 합니다.');
    return { mode: 'remote', url, key };
  }
  function createTransport({ read, fetcher = (...args) => fetch(...args) }) {
    return async (route, options = {}) => {
      if (!routes.test(route) || !['GET', 'POST', 'PUT', 'DELETE'].includes(options.method || 'GET')) throw new Error('허용되지 않은 API 요청입니다.');
      const config = read();
      const remote = config.mode === 'remote';
      if (remote && !config.key) throw new Error('연결 설정에서 배선 API 키를 다시 입력하세요.');
      const direct = remote || options.headers?.['X-API-Key'];
      const response = await fetcher(direct ? (remote ? normalizeServerUrl(config.url) : 'http://127.0.0.1:8000') + route : 'http://127.0.0.1:8002/local-connection/request', {
        method: direct ? (options.method || 'GET') : 'POST',
        headers: { 'Content-Type': 'application/json', ...(direct ? { 'X-API-Key': remote ? config.key : options.headers['X-API-Key'] } : {}) },
        ...(direct ? (options.body ? { body: options.body } : {}) : { body: JSON.stringify({ path: route, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null }) }),
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(route.startsWith('/chat/') ? 45000 : 20000)
      });
      let body;
      try { body = await response.json(); } catch { throw new Error('서버가 JSON을 반환하지 않았습니다. 터널 실행 상태와 주소를 확인하세요.'); }
      return !direct && response.ok ? body : { status: response.status, body };
    };
  }
  const api = { normalizeServerUrl, updateConnection, createTransport };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MirServerConnection = api;
})(globalThis);
