import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../renderer/circuit-api.js', import.meta.url), 'utf8');
const { fromCircuit, toCircuitDraft, CircuitApi } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const agentSource = readFileSync(new URL('../renderer/agent.js', import.meta.url), 'utf8');
const { parseReply } = await import('data:text/javascript;base64,' + Buffer.from(agentSource).toString('base64'));
const record = {
  id: 'circuit', version: 2, name: '센서 회로', requirements: '원래 요구사항',
  component_instances: ['P', 'S', 'U'].map((id) => ({ instance_id: id, component_definition_id: 'part-' + id })),
  nets: [{ net_id: 'power', connected_pin_refs: ['P', 'S', 'U'].map((id) => ({ instance_id: id, pin_id: 'VCC' })) }],
  layout: [{ instance_id: 'S', x: 150, y: 200, rotation: 90 }]
};
const netSignatures = (nets) => nets.map((n) => n.connected_pin_refs.map((p) => `${p.instance_id}.${p.pin_id}`).sort().join('|')).sort();

test('3핀 net의 연결 관계, net ID, 요구사항, 위치와 회전 보존', () => {
  const state = fromCircuit(record);
  assert.equal(state.wires.length, 2);
  const result = toCircuitDraft(state, record);
  assert.deepEqual(netSignatures(result.nets), netSignatures(record.nets));
  assert.equal(result.nets[0].net_id, 'power');
  assert.equal(result.requirements, record.requirements);
  assert.deepEqual(result.layout.find((p) => p.instance_id === 'S'), record.layout[0]);
});

test('화면에서 끊은 선을 저장하면 해당 핀이 net에서 빠짐', () => {
  const state = fromCircuit(record);
  state.wires.pop();
  const result = toCircuitDraft(state, record);
  assert.equal(result.nets.length, 1);
  assert.equal(result.nets[0].connected_pin_refs.length, 2);
  assert.notEqual(result.nets[0].net_id, 'power');
});

test('연결을 합치면 하나의 net, 중복 선으로 핀이 중복되지 않음', () => {
  const state = fromCircuit(record);
  state.wires.push({ from: 'S.VCC', to: 'U.VCC' });
  state.wires.push({ from: 'P.VCC', to: 'S.VCC' });
  assert.equal(toCircuitDraft(state).nets[0].connected_pin_refs.length, 3);
});

test('다른 net에 같은 핀이 중복되면 임의로 합치지 않고 불러오기 거절', () => {
  const bad = structuredClone(record);
  bad.nets.push({ net_id: 'short', connected_pin_refs: [{ instance_id: 'P', pin_id: 'VCC' }, { instance_id: 'U', pin_id: 'GND' }] });
  assert.throws(() => fromCircuit(bad), /중복된 핀/);
});

test('잘못된 ref와 없는 부품 연결을 저장 전에 거절', () => {
  const state = fromCircuit(record);
  state.instances[0].ref = 'P.bad';
  assert.throws(() => toCircuitDraft(state), /ref/);
  const next = fromCircuit(record);
  next.wires.push({ from: 'missing.P', to: 'U.P' });
  assert.throws(() => toCircuitDraft(next), /없는 부품/);
});

test('버전 충돌은 오류로 반환하며 재시도나 자동 덮어쓰기를 하지 않음', async () => {
  let calls = 0;
  const api = new CircuitApi(async (path, options) => {
    calls++;
    assert.equal(options.headers['X-API-Key'], 'test-only-key');
    return { status: 409, body: { detail: { code: 'VERSION_CONFLICT' } } };
  }, 'test-only-key');
  await assert.rejects(api.call('/circuits/circuit', 'PUT', { expected_version: 1 }), /VERSION_CONFLICT/);
  assert.equal(calls, 1);
});

test('MCP 회로 참조와 기존 미르 배선 응답을 각각 해석', () => {
  const result = parseReply('저장 완료\n```json\n{"type":"circuit_reference","circuit_id":"saved-id"}\n```');
  assert.equal(result.circuit.circuit_id, 'saved-id');
  assert.equal(result.wiring, undefined);
  const old = parseReply('```json\n{"type":"wiring","parts":[],"connections":[]}\n```');
  assert.equal(old.wiring.type, 'wiring');
});

test('에이전트가 회로 전체 레코드를 반환해도 회로 ID를 인식', () => {
  const result = parseReply(JSON.stringify(record));
  assert.equal(result.circuit.id, record.id);
});
