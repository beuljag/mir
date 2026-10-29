import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('../renderer/server-chat.js', import.meta.url), 'utf8');
const { createServerChatApi } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

function setup() {
  const calls = [];
  const api = createServerChatApi({
    getSettings: async () => ({ mode: 'web' }), setSettings: async () => {}, resetAgent: async () => {},
    requestCircuit: async (path, options) => {
      calls.push({ path, options });
      if (path === '/chat/config') return { status: 200, body: { mode: 'directline', configured: true } };
      assert.equal(options.headers['X-API-Key'], 'local-api-key');
      if (path === '/chat/sessions') return { status: 201, body: { session_id: 'session' } };
      if (options.method === 'POST') return { status: 202, body: { request_id: 'request' } };
      if (options.method === 'DELETE') return { status: 200, body: { ok: true } };
      return { status: 200, body: { status: 'completed', reply: '실제 응답 JSON', bot_message_count: 1 } };
    }
  }, { sleep: async () => {} });
  return { api, calls };
}

test('서버 모드에서는 로컬 API 키가 없으면 원격 메시지를 보내지 않음', async () => {
  const { api, calls } = setup(); api.selectMode('server');
  await assert.rejects(api.sendToAgent('text', ''), (e) => e.code === 'CIRCUIT_API_KEY_REQUIRED');
  assert.equal(calls.length, 0);
});

test('서버 대화 생성·전송·결과 조회를 거쳐 기존 UI에 응답 반환', async () => {
  const { api, calls } = setup(); api.selectMode('server'); api.setCircuitKey('local-api-key');
  const settings = await api.getSettings();
  assert.equal(settings.mode, 'server'); assert.equal(settings.serverSecretConfigured, true);
  const progress = [];
  assert.deepEqual(await api.sendToAgent('message', 'catalog', (p) => progress.push(p.stage)), { reply: '실제 응답 JSON' });
  assert.deepEqual(progress, ['opening', 'waiting', 'receiving']);
  assert.deepEqual(calls.map((x) => x.path), ['/chat/config', '/chat/sessions', '/chat/sessions/session/messages', '/chat/sessions/session/messages/request']);
  assert.equal(calls.filter((x) => x.options.method === 'POST').length, 2);
});

test('연결 테스트는 새 대화를 만들고 로컬 세션을 정리', async () => {
  const { api, calls } = setup(); api.selectMode('server'); api.setCircuitKey('local-api-key');
  assert.match(await api.testAgent(), /대화 생성/);
  assert.equal(calls.at(-1).options.method, 'DELETE');
});

test('로컬 자동 연결이 준비되면 키 입력 없이 채팅 전송', async () => {
  const calls = [];
  const api = createServerChatApi({
    getSettings: async () => ({ mode: 'server' }), setSettings: async () => {}, resetAgent: async () => {},
    getAutoAuthStatus: async () => ({ ready: true }),
    requestCircuit: async (path, options) => {
      calls.push({ path, options });
      assert.equal(options.headers['X-API-Key'], undefined);
      if (path === '/chat/sessions') return { status: 201, body: { session_id: 'session' } };
      if (options.method === 'POST') return { status: 202, body: { request_id: 'request' } };
      return { status: 200, body: { status: 'completed', reply: '자동 연결 응답' } };
    }
  }, { sleep: async () => {} });
  api.selectMode('server');
  assert.deepEqual(await api.sendToAgent('message', 'catalog'), { reply: '자동 연결 응답' });
  assert.equal(calls.length, 3);
});


test('시간 초과 후 실패한 대화를 정리하고 다음 요청은 새 대화로 연결', async () => {
  const calls = []; let sessions = 0;
  const api = createServerChatApi({
    getAutoAuthStatus: async()=>({ready:true}), resetAgent:async()=>{},
    requestCircuit:async(path,options)=>{
      calls.push({path,method:options.method});
      if(path==='/chat/sessions') return {status:201,body:{session_id:`session${++sessions}`,reply_timeout_seconds:600}};
      if(options.method==='DELETE') return {status:200,body:{ok:true}};
      if(options.method==='POST') return {status:202,body:{request_id:'request'}};
      return {status:200,body:sessions===1 ? {status:'failed',error:'DIRECT_LINE_REPLY_TIMEOUT'} : {status:'completed',reply:'정상 복구'}};
    }
  },{sleep:async()=>{}});
  api.selectMode('server');
  await assert.rejects(api.sendToAgent('없는 센서',''),e=>e.code==='DIRECT_LINE_REPLY_TIMEOUT');
  assert.ok(calls.some(c=>c.path==='/chat/sessions/session1' && c.method==='DELETE'));
  assert.deepEqual(await api.sendToAgent('다음 요청',''),{reply:'정상 복구'});
  assert.equal(sessions,2);
  assert.equal(calls.filter(c=>c.path.endsWith('/messages') && c.method==='POST').length,2);
});

test('전송 수락 여부가 불명확해도 자동 재전송하지 않고 다음 호출을 복구',async()=>{
  let sessions=0, posts=0;
  const api=createServerChatApi({getAutoAuthStatus:async()=>({ready:true}),
    requestCircuit:async(path,options)=>{
      if(path==='/chat/sessions')return {status:201,body:{session_id:`s${++sessions}`}};
      if(options.method==='DELETE')return {status:200,body:{}};
      if(options.method==='POST') { posts++; if(posts===1) throw new Error('network'); return {status:202,body:{request_id:'r'}}; }
      return {status:200,body:{status:'completed',reply:'ok'}};
    }
  },{sleep:async()=>{}});
  api.selectMode('server');
  await assert.rejects(api.sendToAgent('first',''),/network/);
  assert.equal(posts,1);
  assert.equal((await api.sendToAgent('second','')).reply,'ok');
  assert.equal(posts,2);assert.equal(sessions,2);
});
