import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../renderer/circuit-api.js', import.meta.url), 'utf8');
const { loadComponentImage, loadComponentCatalog, definitionToPart } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const canvasSource = readFileSync(new URL('../renderer/canvas.js', import.meta.url), 'utf8');
const layoutSource = canvasSource.slice(canvasSource.indexOf('export function layoutPart'), canvasSource.indexOf('\nconst DIR'));
const { layoutPart } = await import('data:text/javascript;base64,' + Buffer.from('const PIN_GAP=18, HEADER=30, PAD=10;\n' + layoutSource).toString('base64'));
const artSource = readFileSync(new URL('../renderer/art.js', import.meta.url), 'utf8');
const { drawArt, isBareArt } = await import('data:text/javascript;base64,' + Buffer.from(artSource).toString('base64'));

class SvgNode {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.textContent = ''; }
  setAttribute(key, value) { this.attrs[key] = value; }
  appendChild(node) { this.children.push(node); }
}
const allNodes = (node) => [node, ...node.children.flatMap(allNodes)];

test('서버 SVG 크기와 연결 좌표를 캔버스에서 그대로 사용하며 전기 정보는 유지', async () => {
  const part = { id: 'test-pump', name: '펌프', pins: [
    { id: 'V+', side: 'left', type: 'power_in', maxVoltage: 12 }, { id: 'GND', side: 'left', type: 'gnd' }
  ], _layout: { w: 1, h: 1 } };
  const layout = { width: 150, height: 76, pins: [
    { id: 'V+', x: 0, y: 39, side: 'left' }, { id: 'GND', x: 150, y: 39, side: 'right' }
  ] };
  const updated = await loadComponentImage({ call: async () => ({ image_data: 'data:image/svg+xml;base64,PHN2Zy8+', layout }) }, part);
  const actual = layoutPart(updated);
  assert.equal(actual.w, 150);
  assert.equal(actual.pos.GND.x, 150);
  assert.equal(actual.pos.GND.def.type, 'gnd');
  assert.equal(updated.pins[0].maxVoltage, 12);
  assert.equal(part.pins[1].side, 'left');
});

test('이미지가 없으면 기존 그림을 유지하고 잘못된 핀 집합은 거부', async () => {
  const part = { id: 'test', pins: [{ id: 'P' }] };
  assert.equal(await loadComponentImage({ call: async () => { throw Object.assign(new Error(), { status: 404 }); } }, part), part);
  await assert.rejects(() => loadComponentImage({ call: async () => ({ image_data: 'data:image/svg+xml;base64,AAA', layout: { pins: [] } }) }, part), /핀 목록/);
  await assert.rejects(() => loadComponentImage({ call: async () => ({ image_data: 'https://example.com/image.svg', layout: {} }) }, part), /형식/);
});

test('v2 텍스트는 실제 SVG text로 쓰고 PCB/BARE 표시와 상하 핀 좌표를 유지', async () => {
  const part = { id: 'sensor', name: '센서', pins: [{ id: 'VCC', type: 'power_in' }, { id: 'GND', type: 'gnd' }] };
  const nodes = [{ tag: 'text', attrs: { x: '50', y: '50', class: 'art-text strong dark' }, text: 'CHIP <test>', children: [] }];
  const result = { asset_id: 'style-v2', design_version: 'v2', image_data: 'data:image/svg+xml;base64,AAA',
    presentation: { kind: 'bare', color: '#1d3557' }, art_nodes: nodes,
    layout: { width: 110, height: 112, top: 18, pins: [
      { id: 'VCC', x: 55, y: 0, side: 'top' }, { id: 'GND', x: 55, y: 112, side: 'bottom' }
    ] } };
  const def = await loadComponentImage({ call: async () => result }, part);
  assert.equal(layoutPart(def).top, 18);
  assert.equal(layoutPart(def).pos.GND.y, 112);
  assert.equal(isBareArt(def), true);
  assert.equal(def.color, '#1d3557');
  globalThis.document = { createElementNS: (_ns, tag) => new SvgNode(tag) };
  const root = new SvgNode('g');
  drawArt(root, { w: 110, h: 112, top: 18, pos: layoutPart(def).pos, def, st: {}, power: false });
  const rendered = allNodes(root).find((n) => n.tag === 'text');
  assert.equal(rendered.textContent, 'CHIP <test>');
  assert.equal(rendered.children.length, 0);
  assert.equal(rendered.attrs.class, 'art-text strong dark');
  assert.equal(allNodes(root).some((n) => n.tag === 'image'), false);
});

test('기존 시뮬레이션 상태로 LED·배관·버튼·조건 표시를 갱신', () => {
  globalThis.document = { createElementNS: (_ns, tag) => new SvgNode(tag) };
  const def = { imageNodes: ['led-dome', 'pipe', 'tact-cap', 'state-on', 'state-off'].map((cls) =>
    ({ tag: 'rect', attrs: { class: cls }, text: '', children: [] })), imagePresentation: { kind: 'bare' } };
  const root = new SvgNode('g');
  drawArt(root, { def, st: { lit: true, on: true, pressed: true }, power: true });
  const classes = allNodes(root).map((n) => n.attrs.class);
  assert.ok(classes.includes('led-dome lit'));
  assert.ok(classes.includes('pipe flow'));
  assert.ok(classes.includes('tact-cap pressed'));
  assert.ok(classes.includes('state-on'));
  assert.ok(!classes.includes('state-off'));
});

test('활성 코드와 외부 참조가 담긴 데이터 트리를 DOM에 넣지 않음', () => {
  globalThis.document = { createElementNS: (_ns, tag) => new SvgNode(tag) };
  for (const node of [
    { tag: 'script', attrs: {}, text: '', children: [] },
    { tag: 'text', attrs: { onclick: 'alert(1)' }, text: 'bad', children: [] },
    { tag: 'rect', attrs: { fill: 'url(https://evil.example)' }, text: '', children: [] }
  ]) {
    const root = new SvgNode('g');
    drawArt(root, { def: { imageNodes: [node], imageData: 'data:image/svg+xml;base64,AAA' }, w: 100, h: 100 });
    assert.equal(allNodes(root).some((n) => n.tag === 'script' || n.attrs.onclick), false);
    assert.equal(allNodes(root).some((n) => n.attrs.fill?.includes('evil.example')), false);
  }
});

test('새 부품이 첫 100개 뒤에 있어도 목록을 모두 읽고 미검증 상태와 빈 핀을 표시', async () => {
  const definitions = Array.from({ length: 103 }, (_, i) => ({ id: 'part-' + i, model: '센서 ' + i,
    manufacturer: '미확인', category: 'sensor', pins: [], source_references: [], verification_status: 'unverified',
    is_draft: true, unresolved_fields: ['pinout'] }));
  const parts = await loadComponentCatalog({ call: async (path) => {
    const url = new URL(path, 'http://localhost');
    const start = Number(url.searchParams.get('offset'));
    return definitions.slice(start, start + Number(url.searchParams.get('limit')));
  } });
  assert.equal(parts.length, 103);
  const last = definitionToPart(parts.at(-1));
  assert.equal(last.id, 'part-102');
  assert.equal(last.isDraft, true);
  assert.match(last.description, /미검증 설계 부품/);
  assert.match(last.description, /핀 정보 미확인/);
  assert.deepEqual(last.pins, []);
});
