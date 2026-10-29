// 브라우저와 Electron에서 같은 웹 채팅 URL 검사를 사용한다.
(function () {
  function validateWebChatUrl(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'copilotstudio.microsoft.com' || url.port || url.username || url.password || url.hash ||
        !/^\/environments\/[a-f0-9-]{36}\/bots\/[a-zA-Z0-9_.-]+\/(canvas|webchat)$/.test(url.pathname)) {
      throw new Error('Copilot Studio의 HTTPS 웹 채팅 링크를 입력하세요.');
    }
    const allowed = new Set(['__version__', 'enableFileAttachment', 'cliAgent']);
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key)) throw new Error('키·토큰 등이 포함된 URL은 웹 채팅 주소로 저장하지 않습니다.');
    }
    return url.href;
  }
  function readWebChatDefaults(data) {
    try { return { mode: 'web', webChatUrl: validateWebChatUrl(data.webChatUrl), tokenEndpoint: '', secret: '' }; }
    catch { return { mode: 'demo', webChatUrl: '', tokenEndpoint: '', secret: '' }; }
  }
  function embeddedWebChatUrl(value) {
    const url = new URL(validateWebChatUrl(value));
    // canvas는 안내 페이지를 포함한다. 같은 에이전트의 채팅 전용 화면을 넣는다.
    url.pathname = url.pathname.replace(/\/canvas$/, '/webchat');
    return url.href;
  }
  const api = { validateWebChatUrl, readWebChatDefaults, embeddedWebChatUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.MirWebChat = api;
})();
