const test=require('node:test'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild');const Module=require('node:module');
const code=buildSync({entryPoints:[require.resolve('../assets/led-tutorial.js')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const loaded=new Module('tutorial-check');loaded._compile(code,'tutorial-check.cjs');const {ledLessonState}=loaded.exports;
test('LED 튜토리얼: 부품·세 배선·전원·HIGH·LOW 전체 단계',()=>{
 const s={instances:[],wires:[],gpio:{},power:false};assert.equal(ledLessonState(s).step,0);
 for(const [ref,part] of [['U1','esp32-devkitc'],['R1','resistor-220'],['LED1','led-red']]){s.instances.push({ref,part});assert.equal(ledLessonState(s).step,s.instances.length);}
 for(const [from,to] of [['U1.GPIO26','R1.P1'],['R1.P2','LED1.A'],['LED1.K','U1.GND1']])s.wires.push({from,to});
 assert.equal(ledLessonState(s).step,6);s.power=true;assert.equal(ledLessonState(s).step,7);
 s.gpio['U1.GPIO26']='HIGH';s.sim={parts:{LED1:{lit:true,burnt:false}}};assert.equal(ledLessonState(s).step,8);
 s.gpio['U1.GPIO26']='LOW';s.sim.parts.LED1.lit=false;assert.equal(ledLessonState(s,true).step,9);
 s.wires.push({from:'U1.3V3',to:'LED1.A'});assert.equal(ledLessonState(s,true).extra,true);
});
