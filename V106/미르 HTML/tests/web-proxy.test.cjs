const test = require('node:test');
const assert = require('node:assert/strict');
process.env.MIR_DEPLOYMENT='railway';process.env.MIR_WEB_ORIGIN='https://web.example';process.env.MIR_BACKEND_URL='https://api.example';process.env.PORT='8791';delete process.env.HOST;
const nativeFetch=globalThis.fetch, calls=[];
let mockBody={image_data:null},upstreamStatus=200;
globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return new Response(JSON.stringify(upstreamStatus===200?{status:200,body:mockBody}:mockBody),{status:upstreamStatus,headers:{'content-type':'application/json'}});};
const {createServer}=require('../serve.cjs');
let server,base;
test.before(async()=>{server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{await new Promise(r=>server.close(r));globalThis.fetch=nativeFetch;});
const key='local-test-key-not-a-real-secret-0000';
async function send(body,origin='https://web.example',secret=key){const r=await nativeFetch(base+'/api/mir',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(secret?{'X-API-Key':secret}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
const body={mode:'remote',url:'https://api.example',route:'/components/led-red/image?optional=true',method:'GET'};
test('웹 상태·정적 HTML·부품 자료를 읽을 수 있다',async()=>{
 assert.equal((await (await nativeFetch(base+'/health')).json()).status,'ok');
 assert.match(await (await nativeFetch(base+'/')).text(),/미르 HTML/);
 assert.ok((await (await nativeFetch(base+'/api/parts')).json()).parts.length>0);
});
test('연결 정보 응답에 공개 주소만 포함하고 키를 넣지 않는다',async()=>{
 const data=await (await nativeFetch(base+'/connection')).json();assert.deepEqual(data,{hosted:true,proxy:true,backendOrigin:'https://api.example',authentication:'backend-public'});assert.ok(!JSON.stringify(data).includes(key));
});
test('선택 이미지 응답 200/null과 공개 연결을 유지한다',async()=>{
 const result=await send(body);assert.equal(result.status,200);assert.equal(result.data.body.image_data,null);assert.equal(calls.at(-1).options.redirect,'error');
 assert.equal(calls.at(-1).url,'https://api.example/mir/api');assert.equal(calls.at(-1).options.method,'POST');assert.deepEqual(JSON.parse(calls.at(-1).options.body),{path:body.route,method:'GET',body:null});
});
test('사용자 API 키 없이 연결하고 사용자 키 헤더도 백엔드에 보내지 않는다',async()=>{
 const result=await send(body,'https://web.example','');assert.equal(result.status,200);assert.equal(calls.at(-1).options.headers['X-API-Key'],undefined);
 await send(body,'https://web.example','attacker-input');assert.equal(calls.at(-1).options.headers['X-API-Key'],undefined);
});
test('다른 출처·백엔드·로컬 인증을 중계하지 않는다',async()=>{
 const count=calls.length;assert.equal((await send(body,'https://evil.example')).status,403);
 assert.equal((await send({...body,url:'https://other.example'})).status,400);
 assert.equal((await send({...body,mode:'local',url:''})).status,400);
 assert.equal(calls.length,count);
});
test('공개 연결을 끈 백엔드의 인증 거절을 우회하지 않는다',async()=>{
 upstreamStatus=403;mockBody={detail:{code:'MIR_PUBLIC_ACCESS_DISABLED'}};
 try{const result=await send(body,'https://web.example','');assert.equal(result.data.status,403);assert.equal(result.data.body.detail.code,'MIR_PUBLIC_ACCESS_DISABLED');}finally{mockBody={image_data:null};upstreamStatus=200;}
});
test('허용하지 않은 경로는 요청 전에 차단한다',async()=>{
 const count=calls.length;assert.equal((await send({...body,route:'/admin'})).status,502);assert.equal(calls.length,count);
});
