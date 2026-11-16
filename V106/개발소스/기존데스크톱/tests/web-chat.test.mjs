import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { validateWebChatUrl, readWebChatDefaults, embeddedWebChatUrl } = require('../renderer/web-chat.js');
const url = 'https://copilotstudio.microsoft.com/environments/cfe472a7-8d6b-e57d-9381-81572ac35b9d/bots/cr72a_circuitcoordinator_IEnqiS/canvas?__version__=2&enableFileAttachment=false&cliAgent=true';

test('사용자가 제공한 새 에이전트 웹 링크와 쿼리를 유지', () => {
  assert.equal(validateWebChatUrl(url), url);
  const settings = readWebChatDefaults({ webChatUrl: url });
  assert.equal(settings.mode, 'web');
  assert.equal(settings.webChatUrl, url);
  assert.equal(settings.secret, '');
});

test('임의 사이트, HTTP, 계정 포함 URL과 Studio 편집기 주소를 거절', () => {
  for (const value of [url.replace('https:', 'http:'), url.replace('copilotstudio.microsoft.com', 'example.com'),
    url.replace('https://', 'https://user:pass@'), 'javascript:alert(1)',
    url.replace('/canvas?', '/settings?'), url.replace('/canvas?', '/canvas/other?')]) {
    assert.throws(() => validateWebChatUrl(value));
  }
});

test('API 키와 토큰을 주소에 넣거나 fragment로 전달하는 것을 거절', () => {
  for (const suffix of ['&token=secret', '&api_key=secret', '#token=secret']) {
    assert.throws(() => validateWebChatUrl(url + suffix));
  }
});

test('설정이 없거나 잘못되면 임의 링크를 열지 않고 데모로 시작', () => {
  assert.equal(readWebChatDefaults({}).mode, 'demo');
  assert.equal(readWebChatDefaults({ webChatUrl: 'https://example.com' }).mode, 'demo');
});

test('삽입 화면만 채팅 전용 경로를 쓰며 같은 에이전트와 쿼리를 유지', () => {
  assert.equal(embeddedWebChatUrl(url), url.replace('/canvas?', '/webchat?'));
  assert.equal(embeddedWebChatUrl(url.replace('/canvas?', '/webchat?')), url.replace('/canvas?', '/webchat?'));
  assert.equal(validateWebChatUrl(url), url);
});
