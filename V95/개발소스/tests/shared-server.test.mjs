import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
const require = createRequire(import.meta.url);
const { normalizeServerUrl, updateConnection, createTransport } = require('../renderer/server-connection.js');
const htmlConnection = require('../../미르 HTML/assets/server-connection.js');
const key = 'synthetic-shared-server-test-key';
test('공유 서버 주소를 바꾸면 이전 키를 보내지 않고 공개 연결을 선택', () => {
  assert.equal(normalizeServerUrl('https://example.com/'), 'https://example.com');
  for (const url of ['http://example.com', 'https://a:b@example.com', 'https://example.com/mcp', 'https://example.com/?key=x', 'https://example.com/#x', 'file:///x']) assert.throws(() => normalizeServerUrl(url));
  const old = { mode: 'remote', url: 'https://example.com', key };
  assert.equal(updateConnection(old, { mode: 'remote', url: old.url, key: '' }).key, key);
  assert.deepEqual(updateConnection(old, { mode: 'remote', url: 'https://other.example', key: '' }),
    { mode: 'remote', url: 'https://other.example', key: '' });
  assert.deepEqual(updateConnection(old, { mode: 'local' }), { mode: 'local', url: '', key: '' });
});

test('공개 공유 서버에 키 없이 미르 전용 요청 전송', async () => {
  const request = createTransport({
    read: () => ({ mode: 'remote', url: 'https://team.example' }),
    fetcher: async (url, options) => {
      assert.equal(url, 'https://team.example/mir/api');
      assert.deepEqual(options.headers, { 'Content-Type': 'application/json' });
      assert.deepEqual(JSON.parse(options.body), { path: '/chat/config', method: 'GET', body: null });
      return { ok: true, status: 200, json: async () => ({ status: 200, body: { configured: true } }) };
    },
  });
  assert.deepEqual(await request('/chat/config'), { status: 200, body: { configured: true } });
});

test('미르 HTML 공유 연결에서 빈 키를 허용하고 서버의 공개 DB를 조회', async () => {
  const config = htmlConnection.updateConnection({}, { mode: 'remote', url: 'https://team.example', key: '' });
  const request = htmlConnection.createTransport({
    read: () => config,
    fetcher: async (url, options) => {
      assert.equal(url, 'https://team.example/mir/api');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['X-API-Key'], undefined);
      assert.deepEqual(JSON.parse(options.body), { path: '/components/search?limit=100', method: 'GET', body: null });
      return Response.json({ status: 200, body: [] });
    },
  });
  assert.deepEqual(await request('/components/search?limit=100'), { status: 200, body: [] });
});
test('공유 서버에만 키를 보내며 리디렉션·임의 경로를 차단', async () => {
  const calls = [];
  const request = createTransport({ read: () => ({ mode: 'remote', url: 'https://team.example', key }), fetcher: async (url, options) => {
    calls.push({url, options}); return { ok: true, status: 200, json: async () => ({ configured: true }) };
  }});
  assert.equal((await request('/chat/config')).body.configured, true);
  assert.equal(calls[0].url, 'https://team.example/chat/config');
  assert.equal(calls[0].options.headers['X-API-Key'], key);
  assert.equal(calls[0].options.redirect, 'error');
  for (const route of ['https://evil.example', '//evil.example', '/circuits/../config', '/chat/config?key=x']) await assert.rejects(request(route));
  assert.equal(calls.length, 1);
});
test('로컬 자동 프록시는 키 없이 기존 응답을 풀어서 반환', async () => {
  const request = createTransport({ read: () => ({ mode: 'local' }), fetcher: async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8002/local-connection/request');
    assert.equal(options.headers['X-API-Key'], undefined);
    assert.equal(JSON.parse(options.body).path, '/chat/config');
    return {ok:true, status:200, json:async()=>({status:200,body:{mode:'directline'}})};
  }});
  assert.deepEqual(await request('/chat/config'), { status:200,body:{mode:'directline'} });
});
test('실제 HTTP 서버로 인증·PUT·인증 실패·리디렉션 차단 확인', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/chat/diagnostics') { res.writeHead(302, { Location: 'http://127.0.0.1:1/chat/config' }); return res.end(); }
    res.setHeader('Content-Type', 'application/json');
    if (req.headers['x-api-key'] !== key) { res.statusCode = 401; return res.end(JSON.stringify({detail:{code:'INVALID_API_KEY'}})); }
    res.end(JSON.stringify({method:req.method,ok:true}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    let config = { mode:'remote', url:`http://127.0.0.1:${server.address().port}`, key };
    const request = createTransport({read:()=>config});
    assert.equal((await request('/circuits/abc', {method:'PUT',body:'{}'})).body.method, 'PUT');
    config = {...config,key:'wrong-key'};
    assert.equal((await request('/chat/config')).status,401);
    await assert.rejects(request('/chat/diagnostics'));
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
