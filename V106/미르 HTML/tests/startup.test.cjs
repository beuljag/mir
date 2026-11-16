const test=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');

test('Railway 기존 HOST가 있어도 실제 웹 프로세스가 시작하고 health에 응답한다',{timeout:15000},async()=>{
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,['serve.cjs','--open'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,MIR_DEPLOYMENT:'railway',HOST:'127.0.0.1',PORT:String(port),MIR_WEB_ORIGIN:'https://web.example',MIR_BACKEND_URL:'https://api.example'},stdio:'ignore'});
 const ended=once(child,'close');let closed=false;child.once('close',()=>closed=true);
 try{
  let healthy=false;
  for(let i=0;i<60;i++){
   assert.equal(closed,false,'웹 프로세스가 시작 중 종료됐습니다.');
   try{const response=await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(500)});assert.equal(response.status,200);assert.equal((await response.json()).status,'ok');healthy=true;break;}catch{}
   await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(healthy,true,'웹 서버가 health에 응답하지 않았습니다.');
 }finally{if(!closed)child.kill();await ended;}
});
