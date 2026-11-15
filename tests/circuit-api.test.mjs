import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutPart, separateParts } from '../renderer/canvas.js';
import { simulate, circuitDiagnostics } from '../renderer/sim.js';

const source = readFileSync(new URL('../renderer/circuit-api.js', import.meta.url), 'utf8');
const { fromCircuit, toCircuitDraft, CircuitApi, definitionToPart } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const agentSource = readFileSync(new URL('../renderer/agent.js', import.meta.url), 'utf8');
const { parseReply } = await import('data:text/javascript;base64,' + Buffer.from(agentSource).toString('base64'));
const record = {
  id: 'circuit', version: 2, name: '센서 회로', requirements: '원래 요구사항',
  component_instances: ['P', 'S', 'U'].map((id) => ({ instance_id: id, component_definition_id: 'part-' + id })),
  nets: [{ net_id: 'power', connected_pin_refs: ['P', 'S', 'U'].map((id) => ({ instance_id: id, pin_id: 'VCC' })) }],
  layout: [{ instance_id: 'S', x: 150, y: 200, rotation: 90 }]
};
const netSignatures = (nets) => nets.map((n) => n.connected_pin_refs.map((p) => `${p.instance_id}.${p.pin_id}`).sort().join('|')).sort();

test('DB 보드의 양방향 GPIO가 HIGH/LOW를 구동하고 입력 전용 핀은 보존된다', () => {
  for (const category of ['board', 'controller']) {
    const board = definitionToPart({
      id: 'db-board', model: 'DB board', category, manufacturer: 'test',
      verification_status: 'unverified', source_references: [], pins: [
        { id: 'GPIO25', label: 'GPIO25', direction: 'bidirectional', output_voltage: 3.3 },
        { id: 'GPIO34', label: 'GPIO34', direction: 'input' },
        { id: 'GPIO26', label: 'GPIO26', direction: 'bidirectional' }
      ]
    });
    assert.equal(board.behavior.kind, 'board');
    assert.equal(board.pins[0].type, 'gpio');
    assert.equal(board.pins[1].type, 'input');
    const state = { instances: [{ ref: 'U1', part: board.id }], wires: [],
      defs: new Map([[board.id, board]]) };
    for (const [mode, expected] of [['HIGH', 3.3], ['LOW', 0]]) {
      const result = simulate({ ...state, gpio: { 'U1.GPIO25': mode, 'U1.GPIO34': mode, 'U1.GPIO26': 'HIGH' } });
      assert.equal(result.netByPin['U1.GPIO25'].voltage, expected);
      assert.equal(result.netByPin['U1.GPIO34'].voltage, null);
      assert.equal(result.netByPin['U1.GPIO26'].voltage, null);
    }
  }
});

test('기존 보드 초안의 디지털 범위로 가상 HIGH를 구동해 직렬 저항과 LED를 켠다', () => {
  const pin = { label: 'D4', direction: 'bidirectional', signal_type: 'digital', voltage_min: 0, voltage_max: 5 };
  const board = definitionToPart({
    id: 'draft-board', model: 'DB board', category: 'board', manufacturer: 'test',
    is_draft: true, verification_status: 'unverified', source_references: [], pins: [
      { id: 'D4', ...pin }, { id: 'GND', label: 'GND', direction: 'ground' },
      { id: 'UNKNOWN', ...pin, voltage_max: null }, { id: 'LIMIT', ...pin, voltage_max: 12 },
    ]
  });
  const load = (id) => JSON.parse(readFileSync(new URL(`../parts/${id}.json`, import.meta.url), 'utf8'));
  const defs = new Map([[board.id, board], ['resistor-220', load('resistor-220')], ['led-red', load('led-red')]]);
  const instances = [{ ref: 'U1', part: board.id }, { ref: 'R1', part: 'resistor-220' }, { ref: 'D1', part: 'led-red' }];
  const wires = [{ from: 'U1.D4', to: 'R1.P1' }, { from: 'R1.P2', to: 'D1.A' }, { from: 'D1.K', to: 'U1.GND' }];
  for (const mode of ['HIGH', 'LOW']) {
    const result = simulate({ defs, instances, wires, gpio: { 'U1.D4': mode, 'U1.UNKNOWN': 'HIGH', 'U1.LIMIT': 'HIGH' } });
    assert.equal(result.netByPin['U1.D4'].voltage, mode === 'HIGH' ? 5 : 0);
    assert.equal(!!result.parts.D1.lit, mode === 'HIGH');
    assert.equal(result.netByPin['U1.UNKNOWN'].voltage, null);
    assert.equal(result.netByPin['U1.LIMIT'].voltage, null);
  }
});

test('전압이 이름에 명시된 DB 보드 전원 핀은 LED를 구동하고 전압 미확인 핀은 떠 있다', () => {
  const board = definitionToPart({
    id: 'r4-draft', model: 'UNO R4 Minima', category: 'board', manufacturer: 'Arduino',
    verification_status: 'unverified', is_draft: true, source_references: [], pins: [
      { id: '5V', label: '+5V', direction: 'power_out' },
      { id: '3V3', label: '+3V3', direction: 'power_out' },
      { id: 'GND', label: 'GND', direction: 'ground' },
      { id: 'IOREF', label: 'IOREF', direction: 'power_out' },
      { id: 'VIN', label: 'VIN', direction: 'power_in' }
    ]
  });
  const load = (id) => JSON.parse(readFileSync(new URL(`../parts/${id}.json`, import.meta.url), 'utf8'));
  const defs = new Map([[board.id, board], ['resistor-220', load('resistor-220')], ['led-red', load('led-red')]]);
  const instances = [{ ref: 'U1', part: board.id }, { ref: 'R1', part: 'resistor-220' }, { ref: 'D1', part: 'led-red' }];
  const ground = { from: 'D1.K', to: 'U1.GND' };
  const direct = simulate({ defs, instances, wires: [{ from: 'U1.5V', to: 'D1.A' }, ground] });
  assert.equal(direct.netByPin['U1.5V'].voltage, 5);
  assert.equal(direct.netByPin['U1.3V3'].voltage, 3.3);
  assert.equal(direct.netByPin['U1.IOREF'].voltage, null);
  assert.equal(direct.netByPin['U1.VIN'].voltage, null);
  assert.equal(direct.parts.D1.burnt, true);
  const limited = simulate({ defs, instances, wires: [{ from: 'U1.5V', to: 'R1.P1' }, { from: 'R1.P2', to: 'D1.A' }, ground] });
  assert.equal(limited.parts.D1.lit, true);
  assert.equal(limited.parts.D1.burnt, false);
});

test('가상 전원 진단은 DB 누락과 5V에서 3.3V 입력으로의 과전압을 따로 전달한다', () => {
  const toPart = (id, pins) => definitionToPart({
    id, model: id, category: 'board', manufacturer: 'Test', is_draft: true, source_references: [], pins
  });
  const supply = toPart('supply', [{ id: '5V', label: '+5V', direction: 'power_out' }]);
  const sensor = toPart('sensor', [
    { id: 'VCC', label: 'VCC', direction: 'power_in', signal_type: 'power', voltage_max: 3.3 },
    { id: 'GND', label: 'GND', direction: 'ground', required: true }
  ]);
  const state = { defs: new Map([['supply', supply], ['sensor', sensor]]), instances: [
    { ref: 'U1', part: 'supply' }, { ref: 'S1', part: 'sensor' }
  ], wires: [{ from: 'U1.5V', to: 'S1.VCC' }] };
  const before = circuitDiagnostics(state, simulate(state));
  assert.deepEqual(before.map(({ code, component_id, pin_id }) => [code, component_id, pin_id]), [
    ['OVERVOLTAGE', 'sensor', 'VCC'],
    ['OUTPUT_VOLTAGE_MISSING', 'supply', '5V'],
    ['REQUIRED_PIN_UNCONNECTED', 'sensor', 'GND']
  ]);
  assert.match(before[0].message, /5V.*3.3V/);
  delete supply.pins[0].voltageFromLabel;
  assert.deepEqual(circuitDiagnostics(state, simulate(state)).map(({ code }) => code),
    ['OVERVOLTAGE', 'REQUIRED_PIN_UNCONNECTED']);
});

test('긴 핀 설명이 보드 폭을 늘리지 않고 겹치는 DB 배치만 이동한다', () => {
  const board = { name: 'ESP32 DevKitC', behavior: { kind: 'board' }, pins: [
    { id: 'GND', label: 'J2-1 GND (Ground)', side: 'left' },
    { id: 'GPIO0', label: 'J3-15 IO0 (STRAPPING: boot mode select, lengthy datasheet note)', side: 'right' }
  ] };
  const resistor = { name: 'Resistor', pins: [] };
  const defs = new Map([['board', board], ['resistor', resistor]]);
  const { w, h } = layoutPart(board);
  assert.ok(w < 300);
  assert.match(board.pins[1].label, /STRAPPING/);
  const anchored = { ref: 'U1', part: 'board', x: 0, y: 0 };
  const incoming = [
    { ref: 'R1', part: 'resistor', x: 100, y: 20 },
    { ref: 'R2', part: 'resistor', x: 100, y: 20 },
    { ref: 'R3', part: 'resistor', x: 600, y: 400 }
  ];
  separateParts(incoming, defs, [anchored]);
  assert.deepEqual([anchored.x, anchored.y], [0, 0]);
  assert.deepEqual([incoming[2].x, incoming[2].y], [600, 400]);
  const boxes = [{ ...anchored, w, h }, ...incoming.map((part) => ({ ...part, ...layoutPart(resistor) }))];
  for (const [index, a] of boxes.entries()) {
    for (const b of boxes.slice(index + 1)) {
      assert.ok(a.x + a.w + 64 <= b.x || b.x + b.w + 64 <= a.x ||
        a.y + a.h + 64 <= b.y || b.y + b.h + 64 <= a.y, `${a.ref} / ${b.ref}`);
    }
  }
});

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
