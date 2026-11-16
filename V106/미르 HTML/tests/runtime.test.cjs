const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {readRuntimeConfig,shouldOpenBrowser} = require('../runtime-config.cjs');
const cloud = {MIR_DEPLOYMENT:'railway',MIR_WEB_ORIGIN:'https://web.example',MIR_BACKEND_URL:'https://api.example'};
test('로컬 기본 HOST·PORT와 브라우저 열기를 보존한다',()=>{
 const c=readRuntimeConfig({});assert.equal(c.host,'127.0.0.1');assert.equal(c.port,8791);assert.equal(c.publicOrigin,'http://127.0.0.1:8791');assert.equal(shouldOpenBrowser(['--open'],c),true);
});
test('Railway는 공개 바인딩과 지정 PORT를 쓰고 브라우저를 열지 않는다',()=>{
 const c=readRuntimeConfig({...cloud,PORT:'18091'});assert.equal(c.host,'0.0.0.0');assert.equal(c.port,18091);assert.equal(shouldOpenBrowser(['--open'],c),false);
});
for(const name of ['MIR_WEB_ORIGIN','MIR_BACKEND_URL'])test(name+' 누락을 변수 이름으로 알려준다',()=>{
 const env={...cloud};delete env[name];assert.throws(()=>readRuntimeConfig(env),new RegExp(name));
});
for(const value of ['0','65536','abc','8.2','-3'])test('잘못된 PORT 차단: '+value,()=>assert.throws(()=>readRuntimeConfig({PORT:value}),/PORT/));
for(const value of ['http://api.example','https://api.example/path','https://api.example/','https://account:mock-secret@api.example'])test('승인 백엔드 원점 검사: '+value.replace(/account:.*@/,'[redacted]@'),()=>{
 assert.throws(()=>readRuntimeConfig({...cloud,MIR_BACKEND_URL:value}),e=>e.message.includes('MIR_BACKEND_URL')&&!e.message.includes('mock-secret'));
});
for(const host of ['127.0.0.1','localhost','::','legacy-host.example','0.0.0.0',''])test('Railway는 기존 HOST와 무관하게 공개 바인딩을 사용한다: '+host,()=>{
 const c=readRuntimeConfig({...cloud,HOST:host,PORT:'18091'});assert.equal(c.host,'0.0.0.0');assert.equal(c.port,18091);assert.equal(c.publicOrigin,cloud.MIR_WEB_ORIGIN);assert.equal(c.backendOrigin,cloud.MIR_BACKEND_URL);
});
test('로컬의 사용자 지정 HOST와 IPv6를 유지한다',()=>{
 assert.equal(readRuntimeConfig({HOST:'localhost'}).host,'localhost');assert.equal(readRuntimeConfig({HOST:'::1',PORT:'8792'}).origin,'http://[::1]:8792');
 assert.throws(()=>readRuntimeConfig({HOST:'bad host'}),/HOST/);
});
test('지원하지 않는 실행 환경 이름을 거부한다',()=>assert.throws(()=>readRuntimeConfig({MIR_DEPLOYMENT:'typo'}),/MIR_DEPLOYMENT/));
test('배포 어댑터와 EXE 제외 범위를 유지한다',()=>{
 const pkg=require('../package.json');assert.equal(pkg.dependencies?.electron,undefined);assert.equal(pkg.devDependencies?.electron,undefined);
 const sync=fs.readFileSync(require.resolve('../scripts/sync-html.cjs'),'utf8');assert.match(sync,/preserved = new Set\(\['web-api.js', 'server-connection.js'\]\)/);
 assert.match(fs.readFileSync(require.resolve('../serve.cjs'),'utf8'),/if \(CLOUD\) return;/);
});
