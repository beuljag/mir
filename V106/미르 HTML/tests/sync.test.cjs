const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const repo=path.resolve(__dirname,'..');

test('새 HTML을 가져와도 서버·배포·인증 어댑터는 유지한다',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mir-sync-check-'));
 try{
  const target=path.join(temp,'target'),source=path.join(temp,'source');
  for(const root of [target,source])for(const dir of ['assets','docs','scripts','서버'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  for(const file of ['sync-html.cjs','build-web.cjs'])fs.copyFileSync(path.join(repo,'scripts',file),path.join(target,'scripts',file));
  const protectedFiles=['serve.cjs','runtime-config.cjs','Dockerfile.web','Dockerfile.server','서버/run.py','assets/web-api.js','assets/server-connection.js'];
  for(const file of protectedFiles)fs.writeFileSync(path.join(target,file),'preserved '+file);
  fs.writeFileSync(path.join(source,'serve.cjs'),"const VERSION = 'V96';");
  fs.writeFileSync(path.join(source,'entry.js'),"import {initWorkspace} from './assets/app.js';initWorkspace();");
  fs.writeFileSync(path.join(source,'assets/app.js'),"export async function initWorkspace(){document.title='updated';}");
  for(const file of ['미르 HTML.html','미르.css','docs/help.html','assets/web-api.js','assets/server-connection.js'])fs.writeFileSync(path.join(source,file),'source '+file);
  fs.writeFileSync(path.join(source,'app.exe'),'not copied');
  const result=spawnSync(process.execPath,[path.join(target,'scripts/sync-html.cjs'),source],{encoding:'utf8',env:{...process.env,NODE_PATH:path.join(repo,'node_modules')}});
  assert.equal(result.status,0,result.stderr);
  for(const file of protectedFiles)assert.equal(fs.readFileSync(path.join(target,file),'utf8'),'preserved '+file);
  assert.equal(JSON.parse(fs.readFileSync(path.join(target,'mir-version.json'),'utf8')).version,'V96');
  assert.match(fs.readFileSync(path.join(target,'미르.js'),'utf8'),/updated/);
  assert.equal(fs.existsSync(path.join(target,'app.exe')),false);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
