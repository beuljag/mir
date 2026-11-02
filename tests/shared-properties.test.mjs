import test from 'node:test';
import assert from 'node:assert/strict';
import {toCircuitDraft, fromCircuit} from '../renderer/circuit-api.js';
test('DB conversion preserves customized component values and labels', () => {
  const state={instances:[{ref:'R1',part:'resistor-220',props:{ohms:4700},label:'limit',x:2,y:3}],wires:[],title:'custom'};
  const draft=toCircuitDraft(state);
  const restored=fromCircuit({...draft,id:'test',version:1});
  assert.deepEqual(restored.instances[0].props,{ohms:4700});
  assert.equal(restored.instances[0].label,'limit');
});
