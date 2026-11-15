import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load = async name => import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../renderer/'+name,import.meta.url),'utf8')).toString('base64'));
const {applyAgentResult,mergeAgentCircuit}=await load('agent-result.js');
const {buildRecommendRequest,buildChatRequest,parseReply}=await load('agent.js');
test('부품 등록 뒤 회로 저장 계약을 전달하고 현재 배선 미첨부 때도 유지',()=>{
  for (const text of [buildRecommendRequest('펌프 제어'),buildChatRequest('배선을 만들어줘',null)]) {
    assert.match(text,/CreateCircuitDraft/);assert.match(text,/circuit_reference/);assert.match(text,/부품·이미지 등록만/);
  }
});
test('빈 화면은 실제 회로 ID를 불러오고 원시 배선보다 DB 회로를 우선',async()=>{
  const calls=[];
  const result=parseReply('```json\n{"type":"circuit_reference","circuit_id":"saved"}\n```');
  const backend={refreshAfterAgent:async()=>calls.push('refresh'),applyAgentCircuit:async(id,{isCurrent})=>{calls.push([id,isCurrent()]);return 'circuit-loaded';}};
  assert.equal(await applyAgentResult({...result,wiring:{}},{backend,drawWiring:()=>assert.fail('DB 회로 우선')}),'circuit-loaded');
  assert.deepEqual(calls,['refresh',['saved',true]]);
});
test('독립 회로의 중복 부품 참조와 선 ID를 바꿔 기존 선과 연결되지 않게 한다',()=>{
  const old={instances:[{ref:'U1',part:'pi'},{ref:'R1',part:'resistor'}],
    wires:[{id:'db-0',from:'U1.GPIO17',to:'R1.P1'}]};
  const incoming={instances:[{ref:'U1',part:'uno'},{ref:'S1',part:'ultrasonic'}],
    wires:[{id:'db-0',from:'U1.D7',to:'S1.TRIG'}]};
  const combined=mergeAgentCircuit(old,incoming,{arrange:(added,others,previous)=>{
    assert.deepEqual(others,old.instances); assert.deepEqual(previous,[]);
    added.forEach(i=>i.y=200);
  }});
  assert.deepEqual(combined.instances.map(i=>i.ref),['U1','R1','U1_2','S1']);
  assert.deepEqual(combined.wires,[old.wires[0],{id:'db-0_2',from:'U1_2.D7',to:'S1.TRIG'}]);
  assert.deepEqual(combined.instances.slice(0,2),old.instances);
});
test('같은 DB 회로의 수정은 원래 참조를 재사용하며 다른 회로를 유지한다',()=>{
  const source={id:'second',version:1,ref:'U1'};
  const first={ref:'U1',part:'pi'};
  const second={ref:'U1_2',part:'uno',circuitSource:source};
  const old={instances:[first,second],wires:[]};
  const incoming={instances:[{...second,ref:'U1',circuitSource:{...source,version:2}}],wires:[]};
  const result=mergeAgentCircuit(old,incoming,{sourceId:'second',arrange:(added,others,previous)=>{
    assert.deepEqual(others,[first]); assert.deepEqual(previous,[second]);
  }});
  assert.equal(result.instances[0],first);
  assert.equal(result.instances[1].ref,'U1_2');
  assert.equal(result.instances[1].circuitSource.version,2);
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
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',disabled:false,textContent:'',classList:{add(){},remove(){}},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(id);};
  globalThis.document={getElementById:element};globalThis.location={search:'?circuit=saved'};globalThis.confirm=()=>true;
  globalThis.window = new EventTarget();
  const definition={id:'new-board',model:'Uno draft',category:'board',is_virtual:true,is_draft:true,verification_status:'unverified',pins:[
    {id:'D2',type:'gpio',name:'D2'},{id:'GND',type:'gnd',name:'GND'}],source_references:[]};
  const record={id:'saved',version:1,status:'unknown',name:'2D draft',requirements:'test',component_instances:[{instance_id:'U1',component_definition_id:'new-board'}],
    nets:[{net_id:'test-only',connected_pin_refs:[{instance_id:'U1',pin_id:'D2'},{instance_id:'U1',pin_id:'GND'}]}],layout:[{instance_id:'U1',x:50,y:70,rotation:0}]};
  const requests=[];
  globalThis.resultTestApi={getAutoAuthStatus:async()=>({ready:true}),requestCircuit:async(path)=>{
    requests.push(path);
    if(path.startsWith('/components/search'))return{status:200,body:[definition]};
    if(path.endsWith('/image?optional=true'))return{status:200,body:{image_data:null}};
    if(path.startsWith('/components/'))return{status:200,body:definition};
    assert.equal(path,'/circuits/saved');return{status:200,body:record};
  }};
  globalThis.resultTestCircuit=circuitApi;
  const source=readFileSync(new URL('../renderer/backend-panel.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  const prefix='const confirmAction = globalThis.confirm; const {CircuitApi,toCircuitDraft,fromCircuit,definitionToPart,loadComponentImage,loadComponentCatalog}=globalThis.resultTestCircuit; const runtimeApi=globalThis.resultTestApi;';
  const {initBackendPanel}=await import('data:text/javascript;base64,'+Buffer.from(prefix+source).toString('base64'));
  const state={defs:new Map(),instances:[],wires:[]};let replaced;
  const panel=initBackendPanel({getState:()=>state,replace:value=>{replaced=value;},renderParts(){},message(){}});
  await panel.connectAutomatically();
  await panel.openLinkedCircuit();
  assert.ok(requests.includes('/circuits/saved'));
  assert.equal(replaced.instances[0].part,'new-board');assert.equal(replaced.instances[0].x,50);
  assert.deepEqual(replaced.wires.map(w=>[w.from,w.to]),[['U1.D2','U1.GND']]);
  assert.ok(state.defs.has('new-board'));
});


test('사양 확인은 내부 진단 설명을 표시하지 않고 필요한 질문만 반환',async()=>{
  const result=parseReply('INA219 검증 단계에서 사양 오류가 발생했습니다.\n```json\n{"type":"clarification","questions":["태양광 패널의 모델명과 개방전압(Voc)을 알려주세요."]}\n```');
  assert.equal(result.text,'태양광 패널의 모델명과 개방전압(Voc)을 알려주세요.');
  assert.equal(result.circuit,undefined);assert.equal(result.wiring,undefined);
  const applied=await applyAgentResult(result,{backend:{refreshAfterAgent:async()=>assert.fail('확인 질문에서 DB 실패 안내를 추가하지 않음')},hasInstances:()=>false});
  assert.equal(applied,'clarification');
});
