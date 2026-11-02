import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load = async name => import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../renderer/'+name,import.meta.url),'utf8')).toString('base64'));
const {applyAgentResult}=await load('agent-result.js');
const {buildRecommendRequest,buildChatRequest,parseReply}=await load('agent.js');
test('부품 등록 뒤 회로 저장 계약을 전달하고 현재 배선 미첨부 때도 유지',()=>{
  for (const text of [buildRecommendRequest('펌프 제어'),buildChatRequest('배선을 만들어줘',null)]) {
    assert.match(text,/CreateCircuitDraft/);assert.match(text,/circuit_reference/);assert.match(text,/부품·이미지 등록만/);
  }
});
test('빈 화면은 실제 회로 ID를 불러오고 원시 배선보다 DB 회로를 우선',async()=>{
  const calls=[];
  const result=parseReply('```json\n{"type":"circuit_reference","circuit_id":"saved"}\n```');
  const backend={refreshAfterAgent:async()=>calls.push('refresh'),openCircuit:async(id,options)=>calls.push([id,options])};
  assert.equal(await applyAgentResult({...result,wiring:{}},{backend,hasInstances:()=>false,drawWiring:()=>assert.fail('DB 회로 우선')}),'circuit-loaded');
  assert.deepEqual(calls,['refresh',['saved',{showPanel:false}]]);
});
test('편집 중인 화면은 DB 회로 응답으로 자동 덮어쓰지 않음',async()=>{
  const backend={refreshAfterAgent:async()=>{},openCircuit:async()=>assert.fail('기존 회로 덮어쓰기 금지')};
  assert.equal(await applyAgentResult({circuit:{circuit_id:'saved'}},{backend,hasInstances:()=>true}),'circuit-available');
});
test('새로 만든 부품·이미지를 먼저 읽은 후 배선을 그린다',async()=>{
  const defs=new Set();let rendered=false;
  const backend={refreshAfterAgent:async()=>{defs.add('new-board');}};
  const wiring={parts:[{part:'new-board'}],connections:[]};
  await applyAgentResult({wiring},{backend,hasInstances:()=>false,drawWiring:value=>{assert.ok(defs.has(value.parts[0].part));rendered=true;}});
  assert.ok(rendered);
});


test('DB 불러오기 버튼 경로가 실제 회로를 조회하여 선과 배치로 변환',async()=>{
  const circuitApi=await load('circuit-api.js');
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',disabled:false,textContent:'',classList:{add(){},remove(){}}});return elements.get(id);};
  globalThis.document={getElementById:element};globalThis.location={search:''};globalThis.confirm=()=>true;
  const definition={id:'new-board',model:'Uno draft',category:'board',is_virtual:true,is_draft:true,verification_status:'unverified',pins:[
    {id:'D2',type:'gpio',name:'D2'},{id:'GND',type:'gnd',name:'GND'}],source_references:[]};
  const record={id:'saved',version:1,status:'unknown',name:'2D draft',requirements:'test',component_instances:[{instance_id:'U1',component_definition_id:'new-board'}],
    nets:[{net_id:'test-only',connected_pin_refs:[{instance_id:'U1',pin_id:'D2'},{instance_id:'U1',pin_id:'GND'}]}],layout:[{instance_id:'U1',x:50,y:70,rotation:0}]};
  const requests=[];
  globalThis.resultTestApi={getAutoAuthStatus:async()=>({ready:true}),requestCircuit:async(path)=>{
    requests.push(path);
    if(path.startsWith('/components/search'))return{status:200,body:[definition]};
    if(path.endsWith('/image'))return{status:404,body:{}};
    if(path.startsWith('/components/'))return{status:200,body:definition};
    assert.equal(path,'/circuits/saved');return{status:200,body:record};
  }};
  globalThis.resultTestCircuit=circuitApi;
  const source=readFileSync(new URL('../renderer/backend-panel.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  const prefix='const {CircuitApi,toCircuitDraft,fromCircuit,definitionToPart,loadComponentImage,loadComponentCatalog}=globalThis.resultTestCircuit; const runtimeApi=globalThis.resultTestApi;';
  const {initBackendPanel}=await import('data:text/javascript;base64,'+Buffer.from(prefix+source).toString('base64'));
  const state={defs:new Map(),instances:[],wires:[]};let replaced;
  const panel=initBackendPanel({getState:()=>state,replace:value=>{replaced=value;},renderParts(){},message(){}});
  await panel.openCircuit('saved',{showPanel:false});
  assert.ok(requests.includes('/circuits/saved'));
  assert.equal(replaced.instances[0].part,'new-board');assert.equal(replaced.instances[0].x,50);
  assert.deepEqual(replaced.wires.map(w=>[w.from,w.to]),[['U1.D2','U1.GND']]);
  assert.ok(state.defs.has('new-board'));
});
