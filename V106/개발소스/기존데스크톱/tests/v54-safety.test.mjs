import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServerChatApi} from '../renderer/server-chat.js';
const require=createRequire(import.meta.url);
const {validateProject}=require('../renderer/project-validation.js');
const fixture=()=>({format:'mir-wiring/1',title:'roundtrip',instances:[{ref:'U1',part:'board',x:0,y:20},{ref:'LED1',part:'led',x:200,y:40}],wires:[{id:'w1',from:'U1.OUT',to:'LED1.A',kind:'sda'}]});
const defs=new Map([['board',{pins:[{id:'OUT'}]}],['led',{pins:[{id:'A'}]}]]);
test('project boundary accepts valid file and preserves manual color',()=>{const d=fixture();assert.equal(validateProject(d,defs),d);assert.equal(d.wires[0].kind,'sda')});
test('project boundary rejects malformed items, duplicate references, invalid positions and dangling wires',()=>{
 const mutations=[d=>d.instances[0]=null,d=>d.instances[1].ref='U1',d=>d.instances[0].x=Infinity,d=>d.instances[0].x='30',d=>d.wires[0].from='MISSING.OUT',d=>d.wires[0].to='LED1.MISSING',d=>d.instances[0].part='missing',d=>d.wires.push({...d.wires[0]}),d=>d.wires[0].kind='unknown'];
 for(const mutate of mutations){const d=fixture();mutate(d);assert.throws(()=>validateProject(d,defs),/프로젝트 파일 오류/);}
});
test('saved explicit demo survives server discovery while first-run default can discover server',async()=>{
 for(const explicit of [true,false]){const api=createServerChatApi({getSettings:async()=>({mode:'demo',modeExplicit:explicit}),getAutoAuthStatus:async()=>({ready:true}),requestCircuit:async()=>({status:200,body:{mode:'directline',configured:true}})});assert.equal((await api.getSettings()).mode,explicit?'demo':'server')}
});
