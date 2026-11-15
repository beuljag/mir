import './project-validation.js';
import { confirmAction } from './confirm-dialog.js';
import { applyAgentResult } from './agent-result.js';
import { runtimeApi, connectRequired } from './web-api.js';
import './appearance.js';
import { initBackendPanel } from './backend-panel.js?v=research-evidence-7';
import { initVerificationPanel } from './verification-panel.js?v=research-evidence-7';
import { WiringCanvas, layoutPart, partBounds, rotationDegrees, separateParts } from './canvas.js';
import { drawArt, isBareArt } from './art.js';
import { simulate, splitKey } from './sim.js';
import { defFor, cleanProps, editableKind, LED_COLORS, RESISTOR_PRESETS, formatOhms, parseOhms } from './props.js';
import {
  buildCatalog, wiringSnapshot, buildRecommendRequest, buildChatRequest,
  buildDiagnoseRequest, buildPartRequest, parseReply, demoReply, getBuiltInWiring
} from './agent.js?v=84';

const $ = (id) => document.getElementById(id);
const api = runtimeApi;

const CATEGORY = {
  board: '보드', sensor: '센서', display: '디스플레이', output: '출력', input: '입력',
  module: '모듈', actuator: '구동기', power: '전원', passive: '수동 소자'
};
const PIN_TYPE = {
  power_out: '전원 출력', power_in: '전원 입력', gnd: 'GND', gpio: '입출력(GPIO)', input: '입력',
  output: '출력', passive: '단자', contact: '릴레이 접점', nc: '사용 금지'
};
let localParts = new Map();
const serverParts = new Map();
let projectParts = new Map();
const state = {
  defs: new Map(),
  instances: [],
  wires: [],
  title: '',
  requirements: '',
  power: false,
  gpio: {},
  pressed: new Set(),
  history: [],
  future: [],
  settings: { mode: 'demo' },
  pendingProposal: null,
  buildingManually: false,
  busy: false
};

function wireOriginLabel(wire) {
  if (wire.origin === 'ai') return 'AI 추천 배선';
  if (wire.origin === 'example') return '내장 예제 배선';
  return '직접 연결한 배선';
}

// ---------- 툴팁 ----------
const tooltipEl = $('tooltip');
const tooltip = {
  showPart(ref,e) {
    const inst=state.instances.find(i=>i.ref===ref);
    const def=inst && defFor(state.defs,inst);
    if(!def)return this.hide();
    tooltipEl.innerHTML=`<b>${escapeHtml(ref)} · ${escapeHtml(def.name)}</b><br>${escapeHtml(def.description||'')}${inst.label?'<br>역할: '+escapeHtml(inst.label):''}<br><span class="dim">두 번 클릭: 부품 속성 · Delete: 삭제</span>`;
    tooltipEl.classList.remove('hidden');this.move(e);
  },
  showPin(key, e) {
    const [ref, pid] = splitKey(key);
    const inst = state.instances.find((i) => i.ref === ref);
    const def = inst && defFor(state.defs, inst);
    const pin = def?.pins.find((p) => p.id === pid);
    if (!pin) return;
    const conns = state.wires.filter((w) => w.from === key || w.to === key).map((w) => (w.from === key ? w.to : w.from));
    let html = `<b>${escapeHtml(ref)}.${escapeHtml(pin.label || pin.id)}</b> <span class="dim">(${escapeHtml(pin.id)})</span><br><span class="dim">${escapeHtml(def.name)}</span><br>종류: ${escapeHtml(PIN_TYPE[pin.type] || pin.type)}`;
    if (pin.voltage != null) html += `<br>${pin.type === 'power_out' ? '출력 전압' : '로직 전압'}: ${escapeHtml(pin.voltage)}${typeof pin.voltage === 'number' ? 'V' : ' 전압을 따름'}`;
    if (pin.minVoltage != null || pin.maxVoltage != null) {
      html += `<br>허용 범위: ${pin.minVoltage != null ? escapeHtml(pin.minVoltage) + 'V' : ''} ~ ${pin.maxVoltage != null ? escapeHtml(pin.maxVoltage) + 'V' : ''}`;
    }
    if (pin.functions?.length) html += `<br>기능: ${escapeHtml(pin.functions.join(', '))}`;
    if (pin.note) html += `<br><span class="warn">※ ${escapeHtml(pin.note)}</span>`;
    html += `<br>연결: ${conns.length ? escapeHtml(conns.join(', ')) : '없음'}`;
    if (state.power && canvas.sim) {
      const net = canvas.sim.netByPin[key];
      const v = net?.voltage;
      html += `<div class="meter">🔌 멀티미터: <span class="v">${v == null ? '측정 안 됨(떠 있음)' : v.toFixed(2) + ' V'}</span>`;
      if (net?.kind === 'gnd') html += ' (GND)';
      if (net?.via) html += `<br>${escapeHtml(net.via)}`;
      if (net?.short) html += '<br><span class="err">⚡ 서로 다른 전원이 한 선에 직접 연결됨 (불꽃)</span>';
      const src = net?.sources?.filter((s) => s.strength !== 'pullup').map((s) => s.label);
      if (src?.length) html += `<br>공급원: ${escapeHtml(src.join(', '))}`;
      html += '</div>';
    } else {
      html += '<div class="meter dim">가상 전원을 켜면 이 핀의 전압을 측정할 수 있어요</div>';
    }
    tooltipEl.innerHTML = html;
    tooltipEl.classList.remove('hidden');
    this.move(e);
  },
  showWire(id, e) {
    const w = state.wires.find((x) => x.id === id);
    if (!w) return;
    let html = `<b>${escapeHtml(w.from)} ↔ ${escapeHtml(w.to)}</b><br>${wireOriginLabel(w)}`;
    if (w.note) html += `<br>${escapeHtml(w.note)}`;
    if (canvas.routeWarnings.has(id)) html += '<br><span class="warn">부품이 겹치거나 핀 주변 여백이 부족해요. 부품을 조금 떨어뜨려 주세요.</span>';
    if (state.power && canvas.sim) {
      const v = canvas.sim.netByPin[w.from]?.voltage;
      html += `<div class="meter">전압: <span class="v">${v == null ? '-' : v.toFixed(2) + ' V'}</span></div>`;
    }
    tooltipEl.innerHTML = html;
    tooltipEl.classList.remove('hidden');
    this.move(e);
  },
  move(e) {
    if (tooltipEl.classList.contains('hidden')) return;
    const gap=12, top=document.querySelector('.stage-toolbar').getBoundingClientRect().bottom+gap;
    const bottom=document.querySelector('.legend').getBoundingClientRect().top-gap;
    const visible = el => el && !el.hidden && getComputedStyle(el).display !== 'none';
    const panels=[$('agentPanel'),$('compactReply'),$('btnChatToggle')].filter(visible).map(el=>el.getBoundingClientRect());
    const width=tooltipEl.offsetWidth,height=tooltipEl.offsetHeight;
    const clamp=(n,min,max)=>Math.max(min,Math.min(n,Math.max(min,max)));
    const candidates=[{x:e.clientX+16,y:e.clientY+16},{x:e.clientX-width-16,y:e.clientY+16}];
    for(const r of panels) candidates.push({x:r.left-width-gap,y:e.clientY+16},{x:e.clientX-width/2,y:r.top-height-gap});
    let best=null;
    for(const p of candidates){
      const x=clamp(p.x,8,innerWidth-width-8),y=clamp(p.y,top,bottom-height);
      const overlap=panels.reduce((sum,r)=>sum+Math.max(0,Math.min(x+width,r.right+gap)-Math.max(x,r.left-gap))*Math.max(0,Math.min(y+height,r.bottom+gap)-Math.max(y,r.top-gap)),0);
      const score=overlap*10000+Math.abs(x-e.clientX)+Math.abs(y-e.clientY);
      if(!best||score<best.score)best={x,y,score};
    }
    tooltipEl.style.left=`${best.x}px`;tooltipEl.style.top=`${best.y}px`;
  },
  hide() { tooltipEl.classList.add('hidden'); }
};

// ---------- 캔버스 ----------
const canvas = new WiringCanvas($('canvas'), {
  getDefs: () => state.defs,
  onChange: () => { syncFromCanvas(); pushHistory(); refresh(); },
  onSelect: (sel) => { showSelection(sel); updateWireDockActions(); },
  onPartClick: (ref) => {
    // 가상 전원이 켜져 있을 때 버튼을 클릭하면 눌림/떼기
    const inst = state.instances.find((i) => i.ref === ref);
    const def = inst && defFor(state.defs, inst);
    if (state.power && def?.behavior?.kind === 'button') {
      state.pressed.has(ref) ? state.pressed.delete(ref) : state.pressed.add(ref);
      refresh();
      return true;
    }
    return false;
  },
  onPartDoubleClick: (ref) => {
    tooltip.hide();
    canvas.select({ type: 'part', ref });
    if (!propertiesDialog.open) propertiesDialog.show();
  },
  tooltip
});

function syncFromCanvas() {
  state.instances = canvas.instances;
  state.wires = canvas.wires;
}

function syncToCanvas() {
  canvas.instances = state.instances;
  canvas.wires = state.wires;
}

function snapshotState() {
  return JSON.stringify({ instances: state.instances, wires: state.wires, title: state.title });
}
let savedSnapshot = snapshotState();
function hasUnsavedChanges() { return snapshotState() !== savedSnapshot; }
window.addEventListener('beforeunload', (event) => {
  if (hasUnsavedChanges()) { event.preventDefault(); event.returnValue = false; }
});

function pushHistory() {
  const s = snapshotState();
  if (state.history[state.history.length - 1] === s) return;
  state.history.push(s);
  if (state.history.length > 100) state.history.shift();
  state.future = [];
}

function clearEditorSelection() {
  canvas.selected=null;canvas.cancelPending();
  $('selInfo').classList.add('hidden');
  document.querySelector('.part-properties-dialog')?.close();
}
function resetProjectHistory(){state.history=[];state.future=[];clearEditorSelection();pushHistory();}
function restore(s) {
  clearEditorSelection();
  const d = JSON.parse(s);
  state.instances = d.instances;
  state.wires = d.wires;
  state.title = d.title || '';
  syncToCanvas();
  refresh();
}

function undo() {
  if (state.history.length < 2) return;
  state.future.push(state.history.pop());
  restore(state.history[state.history.length - 1]);
}

function redo() {
  const s = state.future.pop();
  if (!s) return;
  state.history.push(s);
  restore(s);
}

function runSim() {
  return simulate({ instances: state.instances, wires: state.wires, defs: state.defs, gpio: state.gpio, pressed: state.pressed });
}

function updateWireDockActions() {
  const remove = $('btnDockDeleteWire');
  if (!remove) return;
  remove.disabled = canvas.selected?.type !== 'wire';
  $('btnDockUndo').disabled = state.history.length < 2;
  $('btnDockRedo').disabled = state.future.length === 0;
}

function refresh() {
  updateWireDockActions();
  canvas.sim = state.power ? runSim() : null;
  canvas.render();
  $('emptyHint').classList.toggle('hidden', state.buildingManually || state.instances.length > 0 || !!canvas.preview);
  const projectName = $('frameProjectName');
  if (projectName) projectName.textContent = state.title || '새 프로젝트';
  renderGpioPanel();
}

// ---------- 부품함 ----------
let paletteCat = 'all';
// 부품함은 작업 공간 위에 잠깐 펼치며, 캔버스의 너비와 배선 위치는 바꾸지 않는다.
function setPartsOpen(open, restoreFocus = false) {
  const panel = $('partsPalette');
  const toggle = $('btnPaletteToggle');
  if (open) applyPaletteSize();
  panel.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? '부품함 닫기' : '부품함 열기');
  toggle.title = open ? '부품함 닫기' : '부품함 열기';
  if (open) $('partSearch').focus({ preventScroll: true });
  else {
    $('partMenu').classList.add('hidden');
    if (restoreFocus) toggle.focus({ preventScroll: true });
  }
}
let paletteSize = { width:300, height:560 };
try {
  const saved = JSON.parse(localStorage.getItem('mir-palette-size'));
  if (saved && Number.isFinite(saved.width) && Number.isFinite(saved.height)) paletteSize = saved;
} catch { /* Use the default size when storage is unavailable. */ }
function applyPaletteSize() {
  const stage = document.querySelector('.stage-body');
  const area = stage.getBoundingClientRect();
  const dock = $('partsDock');
  const panel = $('partsPalette');
  const gpio = $('gpioPanel');
  const chat = $('agentPanel').getBoundingClientRect();
  const dockStyle = getComputedStyle(dock);
  const left = parseFloat(dockStyle.left);
  const bottom = parseFloat(dockStyle.bottom);
  const gap = parseFloat(dockStyle.getPropertyValue('--parts-gap'));
  const gpioWidth = parseFloat(dockStyle.getPropertyValue('--gpio-width'));
  const right = Math.min(area.right - 12, compactWorkspace.matches ? area.right : chat.left - 12);
  const dockWidth = Math.max(1, right - area.left - left);
  const dockHeight = Math.max(1, area.height - bottom - Math.max(0,
    document.querySelector('.stage-toolbar').getBoundingClientRect().bottom - area.top) - 10);
  const stacked = state.power && dockWidth < 280 + gpioWidth + gap;
  dock.toggleAttribute('data-stacked', stacked);
  dock.style.width = dockWidth + 'px';
  gpio.style.maxHeight = Math.min(220, dockHeight * (stacked ? 0.35 : 1)) + 'px';
  const maxW = Math.max(1, dockWidth - (state.power && !stacked ? gpioWidth + gap : 0));
  const maxH = Math.max(1, dockHeight - (stacked ? gpio.offsetHeight + gap : 0));
  const width = Math.min(maxW, Math.max(Math.min(280,maxW),paletteSize.width));
  const height = Math.min(maxH, Math.max(Math.min(220,maxH),paletteSize.height));
  panel.style.width = `${width}px`;
  panel.style.height = `${height}px`;
  for (const handle of document.querySelectorAll('[data-palette-resize]')) {
    if (handle.dataset.paletteResize === 'ne') continue;
    const horizontal = handle.dataset.paletteResize === 'e';
    handle.setAttribute('aria-valuemin', horizontal ? Math.min(280,maxW) : Math.min(220,maxH));
    handle.setAttribute('aria-valuemax', horizontal ? maxW : maxH);
    handle.setAttribute('aria-valuenow', horizontal ? width : height);
  }
  return {width,height};
}
function savePaletteSize() {
  try { localStorage.setItem('mir-palette-size',JSON.stringify(paletteSize)); } catch { /* Retain this session's size. */ }
}
for (const handle of document.querySelectorAll('[data-palette-resize]')) {
  let drag = null;
  const edge = handle.dataset.paletteResize;
  handle.addEventListener('pointerdown',e=>{
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const rect = $('partsPalette').getBoundingClientRect();
    drag = {x:e.clientX,y:e.clientY,width:rect.width,height:rect.height};
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add('palette-resizing');
  });
  handle.addEventListener('pointermove',e=>{
    if (!drag) return;
    paletteSize = {width:drag.width+(edge.includes('e')?e.clientX-drag.x:0),height:drag.height+(edge.includes('n')?drag.y-e.clientY:0)};
    paletteSize = applyPaletteSize();
  });
  const finish = ()=>{ if (!drag) return; drag=null;document.body.classList.remove('palette-resizing');savePaletteSize(); };
  handle.addEventListener('pointerup',finish);
  handle.addEventListener('pointercancel',finish);
  handle.addEventListener('lostpointercapture',finish);
  handle.addEventListener('keydown',e=>{
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    const size = applyPaletteSize(), step = e.shiftKey?40:20;
    paletteSize = {width:size.width+(edge.includes('e')?(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0):0),height:size.height+(edge.includes('n')?(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0):0)};
    paletteSize = applyPaletteSize();savePaletteSize();
  });
}


const paletteCollapsed = new Set((() => { try { return JSON.parse(localStorage.getItem('mir-palette-collapsed') || '[]'); } catch { return []; } })());

function partCatalog() {
  return new Map([...localParts, ...serverParts]);
}

function setProjectParts(parts) {
  projectParts = parts;
  state.defs = new Map([...partCatalog(), ...projectParts]);
}

async function loadParts() {
  const { parts, errors } = await api.listParts();
  localParts = new Map(parts.map((part) => [part.id, part]));
  setProjectParts(projectParts);
  renderPalette();
  $('partErrors').innerHTML = errors.map((e) => `⚠ ${escapeHtml(e)}`).join('<br>');
  refresh();
}

function renderPalette() {
  const q = $('partSearch').value.trim().toLowerCase();
  const list = $('partList');
  list.replaceChildren();
  const all = [...state.defs.values()];
  const match = (d) => !q || `${d.id} ${d.name} ${d.description || ''} ${CATEGORY[d.category] || ''} ${partBadges(d).join(' ')} ${d.pins.flatMap((p) => p.functions || []).join(' ')}`.toLowerCase().includes(q);
  const found = all.filter(match);
  renderCategoryChips(found);
  const shown = found.filter((d) => paletteCat === 'all' || d.category === paletteCat);

  if (!shown.length) {
    const empty = document.createElement('div');
    empty.className = 'palette-empty';
    empty.innerHTML = `<p>${q ? `'${escapeHtml(q)}'에 맞는 부품이 없어요.` : '이 분류에 부품이 없어요.'}</p>
      <button class="small" data-act="datasheet">데이터시트로 부품 만들기</button>`;
    empty.querySelector('button').onclick = () => $('partModal').classList.remove('hidden');
    list.appendChild(empty);
    return;
  }

  // 최근 사용 (검색·분류 필터가 없을 때만)
  if (!q && paletteCat === 'all') {
    const recent = loadRecent().map((id) => state.defs.get(id)).filter(Boolean);
    if (recent.length) appendGroup(list, 'recent', '최근 사용', recent);
  }
  const groups = {};
  for (const d of shown) (groups[d.category] ||= []).push(d);
  const order = Object.keys(CATEGORY);
  for (const cat of Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b))) {
    appendGroup(list, cat, CATEGORY[cat] || cat, groups[cat], !!q);
  }
}

function appendGroup(list, key, title, defs, forceOpen = false) {
  const closed = !forceOpen && paletteCollapsed.has(key);
  const head = document.createElement('button');
  head.className = 'cat-head';
  head.setAttribute('aria-expanded', String(!closed));
  head.innerHTML = `<span class="chev">${closed ? '▸' : '▾'}</span><span class="label">${escapeHtml(title)}</span><span class="cat-count">${defs.length}</span>`;
  head.onclick = () => {
    paletteCollapsed.has(key) ? paletteCollapsed.delete(key) : paletteCollapsed.add(key);
    try { localStorage.setItem('mir-palette-collapsed', JSON.stringify([...paletteCollapsed])); } catch { /* 무시 */ }
    renderPalette();
  };
  list.appendChild(head);
  if (closed) return;
  for (const d of defs) list.appendChild(partItem(d));
}

function renderCategoryChips(found) {
  const box = $('partCats');
  box.replaceChildren();
  const counts = {};
  for (const d of found) counts[d.category] = (counts[d.category] || 0) + 1;
  const order = Object.keys(CATEGORY).filter((c) => counts[c]);
  if (paletteCat !== 'all' && !counts[paletteCat]) order.push(paletteCat);
  for (const cat of ['all', ...order]) {
    const b = document.createElement('button');
    b.className = `chip ${paletteCat === cat ? 'on' : ''}`;
    b.textContent = cat === 'all' ? `전체 ${found.length}` : `${CATEGORY[cat] || cat} ${counts[cat] || 0}`;
    b.onclick = () => { paletteCat = cat; renderPalette(); };
    box.appendChild(b);
  }
}

function partItem(d) {
  const item = document.createElement('div');
  item.className = 'part-item';
  item.tabIndex = 0;
  item.draggable = true;
  item.title = `${d.description || d.name}\n클릭하거나 화면으로 끌어다 놓으세요`;
  const thumb = document.createElement('div');
  thumb.className = 'part-thumb';
  thumb.appendChild(partThumb(d));
  const info = document.createElement('div');
  info.className = 'part-info';
  info.innerHTML = `<div class="pn">${escapeHtml(d.name)}${d.source === 'user' ? '<span class="badge b-info">내 부품</span>' : ''}</div>
    <div class="pbadges">${partBadges(d).map((t) => `<span class="pbadge">${escapeHtml(t)}</span>`).join('')}</div>`;
  item.append(thumb, info);
  item.onclick = () => { addPart(d.id); setPartsOpen(false, true); };
  item.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addPart(d.id); setPartsOpen(false, true); } };
  item.ondragstart = (e) => {
    e.dataTransfer.setData('application/x-mir-part', d.id);
    e.dataTransfer.effectAllowed = 'copy';
    item.classList.add('dragging');
  };
  item.ondragend = () => item.classList.remove('dragging');
  return item;
}

// 부품함 미리보기: 캔버스와 같은 그림을 작게 그린다
const thumbCache = new Map();
function partThumb(d) {
  const key = `${d.id}|${d.imageAssetId || (d.imageData ? 'img' : 'art')}`;
  if (thumbCache.has(key)) return thumbCache.get(key).cloneNode(true);
  const NS = 'http://www.w3.org/2000/svg';
  const { w, h, pos, top } = layoutPart(d);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `-8 -8 ${w + 16} ${h + 16}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const g = document.createElementNS(NS, 'g');
  svg.appendChild(g);
  const bare = isBareArt(d);
  const body = document.createElementNS(NS, 'rect');
  body.setAttribute('width', w);
  body.setAttribute('height', h);
  body.setAttribute('rx', 8);
  body.setAttribute('class', `part-body ${bare ? 'bare' : ''}`);
  if (!bare) body.setAttribute('style', d.imageData ? 'fill:transparent' : `fill:${d.color || 'var(--slate-600)'}`);
  g.appendChild(body);
  drawArt(g, { w, h, top, pos, st: {}, def: d, power: false });
  for (const p of Object.values(pos)) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', p.x);
    c.setAttribute('cy', p.y);
    c.setAttribute('r', 5);
    c.setAttribute('class', `pin pin-${p.def.type}`);
    g.appendChild(c);
  }
  thumbCache.set(key, svg);
  return svg.cloneNode(true);
}

// 부품 특징을 짧은 꼬리표로: 전압, 통신 방식, 핀 수
function partBadges(d) {
  const tags = [];
  const kind = d.behavior?.kind;
  if (kind === 'board') {
    if (d.logicVoltage) tags.push(`${d.logicVoltage}V 로직`);
    tags.push(`GPIO ${d.pins.filter((p) => p.type === 'gpio').length}개`);
  } else {
    const pin = d.pins.find((p) => p.type === 'power_in');
    const out = d.pins.find((p) => p.type === 'power_out');
    if (pin && (pin.minVoltage != null || pin.maxVoltage != null)) {
      tags.push(pin.minVoltage != null && pin.maxVoltage != null && pin.minVoltage !== pin.maxVoltage
        ? `${pin.minVoltage}–${pin.maxVoltage}V` : `${pin.maxVoltage ?? pin.minVoltage}V`);
    } else if (out && typeof out.voltage === 'number') tags.push(`${out.voltage}V 출력`);
    if (kind === 'resistor') tags.push(`${d.behavior.ohms >= 1000 ? d.behavior.ohms / 1000 + 'k' : d.behavior.ohms}Ω`);
    if (kind === 'led' && d.behavior.forwardVoltage) tags.push(`Vf ${d.behavior.forwardVoltage}V`);
  }
  const fns = d.pins.flatMap((p) => p.functions || []).join(' ');
  for (const [re, label] of [[/I2C/, 'I2C'], [/SPI/, 'SPI'], [/UART/, 'UART'], [/1-Wire/, '1-Wire'], [/ADC/, 'ADC'], [/PWM/, 'PWM']]) {
    if (re.test(fns) && tags.length < 4) tags.push(label);
  }
  if (kind === 'relay') tags.push('릴레이');
  return tags.slice(0, 4);
}

const RECENT_KEY = 'mir-recent-parts';
function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function rememberRecent(id) {
  const list = [id, ...loadRecent().filter((x) => x !== id)].slice(0, 4);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* 무시 */ }
}

const REF_PREFIX = { board: 'U', sensor: 'S', display: 'DS', output: 'LED', input: 'SW', module: 'M', actuator: 'A', power: 'PS', passive: 'R' };

function nextRef(def) {
  let prefix = REF_PREFIX[def.category] || 'X';
  const kind = def.behavior?.kind;
  if (kind === 'relay') prefix = 'K';
  if (kind === 'diode') prefix = 'D';
  if (kind === 'load') prefix = 'V';
  let n = 1;
  while (state.instances.some((i) => i.ref === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

// at: 끌어다 놓은 위치(캔버스 좌표). 없으면 화면 가운데 근처에 놓는다.
function addPart(partId, at) {
  const def = state.defs.get(partId);
  if (!def) return;
  const ref = nextRef(def);
  const { w, h } = layoutPart(def);
  let x, y;
  if (at) {
    x = at.x - w / 2;
    y = at.y - Math.min(h, 120) / 2;
  } else {
    const r = $('canvas').getBoundingClientRect();
    const k = canvas.view.k;
    x = canvas.view.x + r.width / k / 2 - w / 2 + (Math.random() * 60 - 30);
    y = canvas.view.y + r.height / k / 3 + (Math.random() * 60 - 30);
  }
  state.instances.push({ ref, part: partId, x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 });
  rememberRecent(partId);
  syncToCanvas();
  pushHistory();
  refresh();
  canvas.select({ type: 'part', ref });
  if (!$('partSearch').value) renderPalette();
}

// 부품함에서 끌어다 캔버스에 놓기
const stageBody = document.querySelector('.stage-body');
stageBody.addEventListener('dragover', (e) => {
  if (e.target.closest('.palette')) return;
  if (!e.dataTransfer.types.includes('application/x-mir-part')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  stageBody.classList.add('drop-target');
});
stageBody.addEventListener('dragleave', (e) => {
  if (!stageBody.contains(e.relatedTarget)) stageBody.classList.remove('drop-target');
});
stageBody.addEventListener('drop', (e) => {
  stageBody.classList.remove('drop-target');
  if (e.target.closest('.palette')) return;
  const id = e.dataTransfer.getData('application/x-mir-part');
  if (!id) return;
  e.preventDefault();
  addPart(id, canvas.toWorld(e));
  setPartsOpen(false);
});

const partTransforms = {
  KeyE: { button: 'rotateLeft', degrees: -90 },
  KeyR: { button: 'rotateRight', degrees: 90 },
  KeyT: { button: 'mirrorPart' }
};

function transformPart(action) {
  const selection = canvas.selected;
  if (selection?.type !== 'part' || state.pendingProposal) return false;
  const inst = state.instances.find((item) => item.ref === selection.ref);
  if (!inst) return false;
  if (action.degrees) {
    inst.rotation = rotationDegrees((inst.rotation ?? 0) + action.degrees);
  } else {
    // Reflect horizontally in canvas coordinates, even after the part was rotated.
    inst.rotation = rotationDegrees(-(inst.rotation ?? 0));
    if (inst.mirrored) delete inst.mirrored;
    else inst.mirrored = true;
  }
  const focus = document.activeElement;
  pushHistory();
  refresh();
  showSelection(selection);
  if (focus?.id && !focus.isConnected) $(focus.id)?.focus({ preventScroll: true });
  return true;
}

// ---------- 선택 정보 ----------
function showSelection(sel) {
  const box = $('selInfo');
  if (!sel) return box.classList.add('hidden');
  box.classList.remove('hidden');
  if (sel.type === 'part') {
    const inst = state.instances.find((i) => i.ref === sel.ref);
    const def = inst && defFor(state.defs, inst);
    if (!def) return box.classList.add('hidden');
    box.innerHTML = `<h4>${escapeHtml(inst.ref)} · ${escapeHtml(def.name)}</h4>
      <div>${escapeHtml(def.description || '')}</div>
      ${inst.label ? `<div class="muted">역할: ${escapeHtml(inst.label)}</div>` : ''}
      ${def.sources?.length ? `<div class="muted">근거: ${escapeHtml(def.sources.join(', '))}</div>` : ''}
      ${propsEditorHtml(inst, def)}
      <div class="prop-edit">
        <div class="prop-head">부품 회전 <span class="muted">${rotationDegrees(inst.rotation)}°</span></div>
        <div class="row">
          <button id="rotateLeft" aria-keyshortcuts="E">↶ 왼쪽 90° · E</button>
          <button id="rotateRight" aria-keyshortcuts="R">↷ 오른쪽 90° · R</button>
          <button id="mirrorPart" aria-keyshortcuts="T" aria-pressed="${!!inst.mirrored}">좌우 반전 · T</button>
        </div>
      </div>
      <div class="row"><button id="selDelete">부품 삭제</button></div>`;
    bindPropsEditor(inst, def, sel);
    for (const action of Object.values(partTransforms)) {
      $(action.button).onclick = () => transformPart(action);
    }
  } else {
    const w = state.wires.find((x) => x.id === sel.id);
    if (!w) return box.classList.add('hidden');
    box.innerHTML = `<h4>${escapeHtml(w.from)} ↔ ${escapeHtml(w.to)}</h4>
      <div>${wireOriginLabel(w)}</div>
      ${w.note ? `<div class="muted">${escapeHtml(w.note)}</div>` : ''}
      <div class="row"><button id="selDelete">선 삭제</button></div>`;
  }
  $('selDelete').onclick = () => canvas.deleteSelected();
}

// ---------- 부품 값 바꾸기 (LED 색, 저항값) ----------
function propsEditorHtml(inst, def) {
  const kind = editableKind(def);
  if (!kind) return '';
  const reset = inst.props ? '<button class="ghost small" id="propReset">원래 값으로</button>' : '';
  if (kind === 'led') {
    const cur = def.behavior.color;
    const sw = LED_COLORS.map((c) => `<button class="swatch ${cur === c.hex ? 'on' : ''}" data-color="${c.id}" title="${c.label} (약 ${c.vf}V)" style="--sw:${c.hex}"></button>`).join('');
    return `<div class="prop-edit"><div class="prop-head">LED 색 ${reset}</div>
      <div class="swatches">${sw}<label class="swatch custom" title="직접 고르기"><input type="color" id="propColor" value="${cur || '#ff3b30'}"></label></div>
      <div class="muted">켜지는 전압(순방향 전압) 약 ${def.behavior.forwardVoltage || 2}V</div></div>`;
  }
  const quick = [220, 330, 1000, 10000].map((o) => `<button class="chip ${def.behavior.ohms === o ? 'on' : ''}" data-ohms="${o}">${formatOhms(o)}</button>`).join('');
  return `<div class="prop-edit"><div class="prop-head">저항값 ${reset}</div>
    <div class="prop-row"><input id="propOhms" list="ohmPresets" value="${formatOhms(def.behavior.ohms || 0)}" placeholder="예: 220, 4.7k, 1M"><button id="propOhmsApply">바꾸기</button></div>
    <datalist id="ohmPresets">${RESISTOR_PRESETS.map((o) => `<option value="${formatOhms(o)}">`).join('')}</datalist>
    <div class="chips">${quick}</div>
    <div class="muted" id="propMsg">숫자 뒤에 k(천), M(백만)을 붙일 수 있어요. 색띠는 값에 맞게 바뀝니다.</div></div>`;
}

function bindPropsEditor(inst, def, sel) {
  const kind = editableKind(def);
  if (!kind) return;
  const base = state.defs.get(inst.part);
  const commit = (props) => {
    const clean = cleanProps(base, props);
    if (clean) inst.props = clean; else delete inst.props;
    pushHistory();
    refresh();
    showSelection(sel);
  };
  const box = $('selInfo');
  const reset = $('propReset');
  if (reset) reset.onclick = () => commit(null);
  if (kind === 'led') {
    box.querySelectorAll('.swatch[data-color]').forEach((b) => { b.onclick = () => commit({ color: b.dataset.color }); });
    $('propColor').onchange = (e) => commit({ color: e.target.value });
    return;
  }
  const apply = (v) => {
    const ohms = parseOhms(v);
    if (ohms == null) {
      $('propMsg').textContent = `"${v}"은(는) 저항값으로 읽을 수 없어요. 예: 220, 4.7k, 1M`;
      $('propMsg').classList.add('error');
      return;
    }
    commit({ ohms });
  };
  $('propOhmsApply').onclick = () => apply($('propOhms').value);
  $('propOhms').onkeydown = (e) => { if (e.key === 'Enter') apply(e.target.value); };
  box.querySelectorAll('.chip[data-ohms]').forEach((b) => { b.onclick = () => commit({ ohms: +b.dataset.ohms }); });
}

// ---------- 가상 전원 / GPIO ----------
function setPower(on) {
  state.power = on;
  const b = $('btnPower');
  b.classList.toggle('on', on);
  b.textContent = on ? '가상 전원 ON' : '가상 전원 OFF';
  $('gpioPanel').classList.toggle('hidden', !on);
  if (!on) state.pressed.clear();
  refresh();
  applyPaletteSize();
}

function renderGpioPanel() {
  if (!state.power) return;
  const list = $('gpioList');
  list.replaceChildren();
  const rows = [];
  for (const i of state.instances) {
    const def = state.defs.get(i.part);
    if (def?.behavior?.kind !== 'board') continue;
    for (const p of def.pins) {
      if (p.type !== 'gpio') continue;
      const key = `${i.ref}.${p.id}`;
      if (!state.wires.some((w) => w.from === key || w.to === key)) continue;
      rows.push({ key, label: `${i.ref}.${p.label || p.id}` });
    }
  }
  if (!rows.length) {
    list.innerHTML = '<div class="gpio-empty">선이 연결된 보드 GPIO가 없습니다.</div>';
    return;
  }
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'gpio-row';
    const cur = state.gpio[r.key] || 'IN';
    row.innerHTML = `<span class="gname">${escapeHtml(r.label)}</span><span class="seg">
      ${['IN', 'HIGH', 'LOW'].map((m) => `<button data-m="${m}" class="${cur === m ? 'on' : ''}">${m === 'IN' ? '입력' : m}</button>`).join('')}</span>`;
    row.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.m === 'IN') delete state.gpio[r.key];
        else state.gpio[r.key] = b.dataset.m;
        refresh();
      };
    });
    list.appendChild(row);
  }
}

// ---------- AI 배선 적용 ----------
const COLUMN = { board: 0, sensor: 1, display: 1, input: 1, output: 1, passive: 1, module: 1, actuator: 2, power: 2 };

function placeNew(instances, keepFrom = []) {
  const colY = [40, 40, 40];
  for (const i of keepFrom) {
    const def = state.defs.get(i.part);
    if (!def) continue;
    const c = Math.min(2, Math.max(0, Math.round(i.x / 320)));
    const bounds = partBounds(i, def);
    colY[c] = Math.max(colY[c], bounds.y + bounds.h + 50);
  }
  const incoming = [];
  for (const i of instances) {
    if (i.x != null) continue;
    const def = state.defs.get(i.part);
    const c = COLUMN[def?.category] ?? 1;
    const h = def ? layoutPart(def).h : 40;
    i.x = c * 320 + (c === 0 ? 0 : 40);
    i.y = colY[c];
    colY[c] += h + 50;
    incoming.push(i);
  }
  separateParts(incoming, state.defs, keepFrom);
}

// 에이전트가 보낸 배선을 검사해서 이 프로그램이 그릴 수 있는 형태로 바꾼다.
function normalizeWiring(wiring, defs = state.defs) {
  const warnings = [];
  const parts = [];
  for (const p of wiring.parts || []) {
    if (!p.ref || !p.part) continue;
    if (!defs.has(p.part)) { warnings.push(`부품함에 없는 부품: ${p.part} (${p.ref}) — 부품 JSON을 추가해야 그릴 수 있어요`); continue; }
    parts.push({ ref: String(p.ref), part: p.part, label: p.label, props: cleanProps(defs.get(p.part), p.props) });
  }
  const conns = [];
  for (const c of wiring.connections || []) {
    const ok = [c.from, c.to].every((k) => {
      if (typeof k !== 'string' || !k.includes('.')) return false;
      const [ref, pid] = splitKey(k);
      const p = parts.find((x) => x.ref === ref);
      return p && defs.get(p.part).pins.some((pin) => pin.id === pid);
    });
    if (!ok) { warnings.push(`그릴 수 없는 연결: ${c.from} → ${c.to} (핀 이름 확인 필요)`); continue; }
    conns.push({ from: c.from, to: c.to, note: c.note });
  }
  return { parts, conns, warnings };
}

const connKey = (a, b) => [a, b].sort().join('|');

function proposeWiring(wiring) {
  const { parts, conns, warnings } = normalizeWiring(wiring);
  if (warnings.length) addMessage('system', warnings.join('\n'));
  if (!parts.length) return;

  // 빈 화면이면 바로 그린다.
  if (!state.instances.length) {
    applyProposal({ parts, conns, title: wiring.title });
    return;
  }

  // 이미 배선이 있으면 차이를 보여 주고 사용자 확인을 받는다.
  const cur = new Map(state.wires.map((w) => [connKey(w.from, w.to), w]));
  const next = new Map(conns.map((c) => [connKey(c.from, c.to), c]));
  const removed = new Set([...cur].filter(([k]) => !next.has(k)).map(([, w]) => w.id));
  const added = [...next].filter(([k]) => !cur.has(k)).map(([, c], n) => ({ id: `p${n}`, ...c, origin: 'ai' }));
  const addedParts = parts.filter((p) => !state.instances.some((i) => i.ref === p.ref && i.part === p.part)).map((p) => ({ ...p }));
  const removedParts = state.instances.filter((i) => !parts.some((p) => p.ref === i.ref && p.part === i.part));
  placeNew(addedParts, state.instances);

  const changedProps = parts.filter((p) => p.props && state.instances.some((i) => i.ref === p.ref && i.part === p.part && JSON.stringify(i.props) !== JSON.stringify(p.props)));

  if (!removed.size && !added.length && !addedParts.length && !removedParts.length && !changedProps.length) {
    addMessage('system', '제안된 배선이 현재 배선과 같습니다.');
    return;
  }
  state.pendingProposal = { parts, conns, title: wiring.title, addedParts };
  canvas.preview = { added, removed, addedParts };
  const desc = [];
  if (added.length) desc.push(`<span class="add">+ 선 ${added.length}개</span>`);
  if (removed.size) desc.push(`<span class="del">− 선 ${removed.size}개</span>`);
  if (addedParts.length) desc.push(`<span class="add">+ 부품 ${escapeHtml(addedParts.map((p) => p.ref).join(', '))}</span>`);
  if (changedProps.length) desc.push(`<span class="add">값 변경 ${changedProps.map((p) => p.ref).join(', ')}</span>`);
  if (removedParts.length) desc.push(`<span class="del">− 부품 ${escapeHtml(removedParts.map((p) => p.ref).join(', '))}</span>`);
  $('previewText').innerHTML = `<b>AI 수정안 미리보기</b> — ${desc.join(' · ')}<br><span class="muted">초록 점선=추가, 빨간 점선=삭제. 적용하기 전에 확인하세요.</span>`;
  $('previewBar').classList.remove('hidden');
  refresh();
}

function applyProposal({ parts, conns, title, addedParts = [], origin = 'ai' }) {
  const keep = new Map(state.instances.map((i) => [`${i.ref}|${i.part}`, i]));
  const placed = new Map(addedParts.map((p) => [`${p.ref}|${p.part}`, p]));
  const instances = parts.map((p) => {
    const old = keep.get(`${p.ref}|${p.part}`) || placed.get(`${p.ref}|${p.part}`);
    return { ref: p.ref, part: p.part, label: p.label, x: old?.x, y: old?.y, ...(old?.rotation == null ? {} : { rotation: old.rotation }), ...(old?.mirrored ? { mirrored: true } : {}), ...((p.props || old?.props) ? { props: p.props || old.props } : {}) };
  });
  placeNew(instances, instances.filter((i) => i.x != null));
  state.instances = instances;
  const previousWires=new Map(state.wires.map(w=>[connKey(w.from,w.to),w]));
  state.wires = conns.map((c,n)=>{const old=previousWires.get(connKey(c.from,c.to));return {...(old||{}),id:old?.id||`a${Date.now().toString(36)}${n}`,from:c.from,to:c.to,note:c.note??old?.note,origin:old?.origin||origin};});
  if (title) state.title = title;
  state.gpio = {};
  clearPreview();
  syncToCanvas();
  pushHistory();
  refresh();
  canvas.fit();
}

function clearPreview() {
  canvas.preview = null;
  state.pendingProposal = null;
  $('previewBar').classList.add('hidden');
}

// ---------- 채팅 ----------
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderMarkdown(text) {
  const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g);
  let html = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      html += escapeHtml(parts[i])
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    } else if (i % 3 === 2) {
      html += codeBlock(parts[i]);
    }
  }
  return html.trim();
}

function codeBlock(code) {
  return `<pre><button class="copy small" data-copy="${escapeHtml(code)}">복사</button><code>${escapeHtml(code)}</code></pre>`;
}

function addMessage(role, text, extra, notifyCompact = false) {
  if (state.settings.mode === 'web' && role === 'system') {
    const entry = document.createElement('p'); entry.textContent = text;
    $('webActivity').appendChild(entry);
  }
  const m = document.createElement('div');
  m.className = `msg ${role}`;
  m.innerHTML = role === 'agent' ? renderMarkdown(text) : escapeHtml(text);
  if (extra) m.appendChild(extra);
  $('messages').appendChild(m);
  if (notifyCompact && document.body.classList.contains('chat-collapsed')) showCompactReply(text);
  // Animate only new, visible messages; reopening the panel keeps history still.
  if (!document.body.classList.contains('chat-collapsed') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    m.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 200, easing: 'ease-out' });
  }
  m.querySelectorAll('[data-copy]').forEach((b) => {
    b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy); b.textContent = '복사됨'; };
  });
  $('messages').scrollTop = $('messages').scrollHeight;
  return m;
}

function wiringCard(wiring) {
  const card = document.createElement('div');
  card.className = 'wiring-card';
  const conns = (wiring.connections || []).map((c) => `<div class="conn">${escapeHtml(c.from)} → ${escapeHtml(c.to)}${c.note ? ` <span class="muted">· ${escapeHtml(c.note)}</span>` : ''}</div>`).join('');
  const steps = wiring.steps?.length ? `<div><b>순서</b><ul>${wiring.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>` : '';
  const warns = wiring.warnings?.length ? `<div class="warns"><b>주의</b><ul>${wiring.warnings.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>` : '';
  const code = wiring.code ? `<details><summary>예제 코드</summary>${codeBlock(wiring.code)}</details>` : '';
  card.innerHTML = `<h4>🔌 ${escapeHtml(wiring.title || '배선 제안')}</h4>
    <div class="muted">부품: ${(wiring.parts || []).map((p) => `${escapeHtml(p.ref)}(${escapeHtml(p.part)})`).join(', ')}</div>
    <details open><summary>연결 ${wiring.connections?.length || 0}개</summary>${conns}</details>
    ${steps}${warns}${code}
    <div class="row"><button data-act="draw">2D 화면에 다시 그리기</button></div>`;
  const draw = card.querySelector('[data-act="draw"]');
  draw.dataset.projectAction = '';
  draw.onclick = () => proposeWiring(wiring);
  card.querySelectorAll('[data-copy]').forEach((b) => {
    b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy); b.textContent = '복사됨'; };
  });
  return card;
}

function partCard(part) {
  const card = document.createElement('div');
  card.className = 'wiring-card';
  card.innerHTML = `<h4>🧩 새 부품: ${escapeHtml(part.name || part.id)}</h4>
    <div class="muted">id: ${escapeHtml(part.id)} · 핀 ${part.pins?.length || 0}개</div>
    <div class="conn">${(part.pins || []).map((p) => `${escapeHtml(p.id)}(${escapeHtml(p.type)}${p.voltage != null ? ' ' + escapeHtml(p.voltage) + 'V' : ''})`).join(', ')}</div>
    <div class="warns">데이터시트와 핀 정보를 한 번 더 확인한 뒤 저장하세요.</div>
    <div class="row"><button data-act="save">부품함에 저장</button></div>`;
  card.querySelector('[data-act="save"]').onclick = async (e) => {
    try {
      const { type, ...clean } = part;
      await api.savePart(clean);
      e.target.disabled = true;
      e.target.textContent = '저장됨';
      await loadParts();
    } catch (err) {
      addMessage('system', `부품 저장 실패: ${err.message}`);
    }
  };
  return card;
}

let projectGeneration = 0;
async function askAgent(message, { shown, ctx = {} } = {}) {
  if (state.busy) return;
  const requestGeneration = projectGeneration;
  const isCurrent = () => requestGeneration === projectGeneration;
  state.busy = true;
  $('compactReply').hidden = true;
  $('btnSend').disabled = true;
  if (shown) addMessage('user', shown);
  const typing = addMessage('agent', '에이전트가 생각하는 중…');
  typing.classList.add('typing');
  const waitingSince = Date.now();
  let waitingStage = '요청 준비 중';
  const refreshWaiting = () => { typing.textContent = `${waitingStage} · ${Math.floor((Date.now() - waitingSince) / 1000)}초`; };
  const waitingTimer = setInterval(refreshWaiting, 1000);
  try {
    let reply;
    const res = await api.sendToAgent(message, buildCatalog(state.defs), (progress) => {
      waitingStage = progress.stage === 'opening' ? 'Copilot 대화 연결 중'
        : progress.stage === 'reconnecting' ? 'Microsoft 연결 재확인 중'
        : progress.stage === 'receiving' ? 'Copilot 응답 수신 중' : 'Copilot 응답 대기 중';
      refreshWaiting();
    });
    if (res.demo) {
      typing.textContent = '저장된 데모 예시를 확인하는 중…';
      await new Promise((r) => setTimeout(r, 500));
      reply = demoReply(message, ctx);
    } else {
      reply = res.reply;
    }
    typing.remove();
    if (!isCurrent()) return;
    const { text, wiring, part, circuit, clarification } = parseReply(reply);
    let extra = circuit ? null : wiring ? wiringCard(wiring) : part ? partCard(part) : null;
    if (circuit) {
      extra = document.createElement('button');
      extra.disabled = true;
      extra.dataset.projectAction = '';
      extra.textContent = '에이전트 회로를 DB에서 불러오기';
      extra.onclick = () => backend.openCircuit(circuit.circuit_id || circuit.id, { showPanel: false });
    }
    addMessage('agent', text || (circuit ? '회로 ID가 반환되었습니다. 저장된 배선을 확인합니다.' : wiring ? '배선을 제안합니다.' : '(빈 응답)'), extra, true);
    const applied = await applyAgentResult({ wiring, circuit, clarification }, { backend,
      hasInstances: () => state.instances.length > 0, drawWiring: proposeWiring, isCurrent, isDemo: !!res.demo })
      .finally(() => { if (circuit && isCurrent()) extra.disabled = false; });
    if (!isCurrent()) return;
    if (applied === 'text-only' && !part && message.includes('[요청 종류: 배선 추천]')) {
      addMessage('system', '에이전트 응답에 회로 ID나 배선 데이터가 없어 그림을 만들지 못했습니다. 부품 등록과 배선 설계는 별도 단계입니다. 응답의 확인 질문이나 부족한 사양을 확인해 주세요.');
    }
  } catch (e) {
    typing.remove();
    if (requestGeneration !== projectGeneration) return;
    if (shown && !$('chatInput').value.trim()) $('chatInput').value = shown;
    addMessage('system', `에이전트 호출 실패: ${String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}\n에이전트 연결 탭에서 연결 정보를 확인하세요.`, null, true);
  } finally {
    clearInterval(waitingTimer);
    state.busy = false;
    $('btnSend').disabled = false;
  }
}

function showConnectionSetup() {
  if (state.settings.serverSecretConfigured) return false;
  $('btnSettings').click();
  return true;
}

function sendChat() {
  if (state.busy) return;
  const text = $('chatInput').value.trim();
  if (!text || showConnectionSetup()) return;
  $('chatInput').value = '';
  let message;
  if (!state.instances.length) message = buildRecommendRequest(text);
  else message = buildChatRequest(text, $('attachWiring').checked ? wiringSnapshot(state, state.defs) : null);
  askAgent(message, { shown: text });
}

// ---------- 진단 ----------
// 진단 요청에 붙일 측정값. 판정은 하지 않고 측정 사실만 나열한다.
function measurementReport(sim) {
  const lines = [];
  const used = new Set(state.wires.flatMap((w) => [w.from, w.to]));
  for (const key of used) {
    const net = sim.netByPin[key];
    const [ref, pid] = splitKey(key);
    const inst = state.instances.find((i) => i.ref === ref);
    const pin = state.defs.get(inst?.part)?.pins.find((p) => p.id === pid);
    if (!pin) continue;
    const range = pin.minVoltage != null || pin.maxVoltage != null ? ` (허용 ${pin.minVoltage ?? ''}~${pin.maxVoltage ?? ''}V)` : '';
    lines.push(`- ${key}: ${net?.voltage == null ? '떠 있음' : net.voltage.toFixed(2) + 'V'}${net?.short ? ' [서로 다른 전원 직결]' : ''}${range}`);
  }
  for (const [ref, st] of Object.entries(sim.parts)) {
    const s = [];
    if (st.lit != null) s.push(st.lit ? (st.burnt ? 'LED 켜짐(저항 없이 과전류)' : 'LED 켜짐') : 'LED 꺼짐');
    if (st.energized != null) s.push(st.energized ? '릴레이 동작' : st.powered ? '릴레이 대기' : '릴레이 전원 없음');
    if (st.on != null) s.push(st.on ? '부하 동작' : `부하 정지(${st.voltage == null ? '-' : st.voltage.toFixed(1) + 'V'})`);
    if (st.shorting) s.push('다이오드 정방향 직결');
    if (st.linked != null) s.push(st.linked ? 'I2C 연결됨' : 'I2C 미연결');
    if (s.length) lines.push(`- ${ref}: ${s.join(', ')}`);
  }
  const gpio = Object.entries(state.gpio).map(([k, v]) => `${k}=${v}`).join(', ');
  if (gpio) lines.push(`- 보드 핀 출력 설정: ${gpio}`);
  return lines.join('\n');
}

// 데모 진단용 힌트 (연결된 에이전트가 없을 때만 쓴다)
function demoProblems(sim) {
  const out = [];
  for (const [key, net] of Object.entries(sim.netByPin)) {
    const [ref, pid] = splitKey(key);
    const inst = state.instances.find((i) => i.ref === ref);
    const pin = state.defs.get(inst?.part)?.pins.find((p) => p.id === pid);
    if (!pin || !state.wires.some((w) => w.from === key || w.to === key)) continue;
    if (net.short) out.push(`${key}: 서로 다른 전원이 한 선에 직접 붙어 있습니다(단락). 배선 문제입니다.`);
    else if (pin.maxVoltage != null && net.voltage != null && net.voltage > pin.maxVoltage) out.push(`${key}: ${net.voltage}V가 들어오지만 허용 최대는 ${pin.maxVoltage}V입니다. 전원 전압을 낮추거나 레벨 변환이 필요합니다.`);
    else if (pin.type === 'power_in' && pin.minVoltage != null && net.voltage != null && net.voltage < pin.minVoltage && net.voltage > 0) out.push(`${key}: ${net.voltage}V로는 부족합니다(최소 ${pin.minVoltage}V).`);
  }
  for (const [ref, st] of Object.entries(sim.parts)) {
    if (st.burnt) out.push(`${ref}: LED에 전류 제한 저항이 없습니다.`);
    if (st.shorting) out.push(`${ref}: 다이오드 방향이 반대라 전원을 단락시킵니다. 띠(K)를 + 쪽으로 바꾸세요.`);
    if (st.powered && st.linked === false) out.push(`${ref}: I2C SDA/SCL이 보드의 SDA/SCL 핀에 연결되지 않았습니다.`);
  }
  return [...new Set(out)];
}

// 사람이 가상환경에서 테스트한 뒤, 측정값과 배선을 보내 원인·수정안을 받는다.
// 입력창에 적은 내용(무엇이 이상했는지)이 있으면 함께 보낸다.
async function requestDiagnosis() {
  if (state.busy) return;
  if (!state.instances.length) {
    addMessage('system', '먼저 배선을 만들어 주세요.');
    return;
  }
  if (showConnectionSetup()) return;
  const memo = $('chatInput').value.trim();
  $('chatInput').value = '';
  const sim = runSim();
  const message = buildDiagnoseRequest({
    snapshot: wiringSnapshot(state, state.defs),
    checklist: [],
    measurements: measurementReport(sim),
    memo
  });
  await askAgent(message, {
    shown: memo ? `가상 테스트 결과로 진단해줘: ${memo}` : '가상 테스트 결과로 원인과 수정안을 알려줘.',
    ctx: { problems: demoProblems(sim) }
  });
}

// ---------- 설정 ----------
async function loadSettings() {
  state.settings = await api.getSettings();
  const { apiKeyReady: db, serverSecretConfigured: ai } = state.settings;
  $('connPill').textContent = db ? (ai ? 'Copilot · DB 연결됨' : 'DB 연결됨 · AI 미연결') : 'AI · DB 미연결';
  $('connPill').className = 'badge ' + (db ? (ai ? 'b-ok' : 'b-warn') : 'b-mute');
  $('emptyHint').querySelector('h3').textContent = '무엇을 만들고 싶나요?';
  $('emptyHint').querySelector('p').textContent = '아래 카드를 눌러 예제 회로를 바로 열거나, 부품함에서 직접 시작해 보세요.';
}

window.addEventListener('mir-connection-status', () => void loadSettings());

async function openSettings() {
  if ($('settingsModal').open || connectionAttempt) return;
  const connection = await api.getServerConnection();
  $('serverConnectionMode').value = connection.mode;
  $('inServerUrl').value = connection.url;
  $('inServerKey').value = '';
  $('inServerKey').placeholder = connection.hasKey ? '현재 키 유지' : '서버 관리자에게 받은 키';
  $('testResult').textContent = '';
  $('testResult').className = 'test-result';
  updateSettingsFields();
  if (!$('settingsModal').open) $('settingsModal').showModal();
  $('serverConnectionMode').focus();
}

function updateSettingsFields() {
  const remote = $('serverConnectionMode').value === 'remote';
  $('remoteServerFields').hidden = !remote;
  $('inServerUrl').required = remote;
}

// ---------- 이벤트 ----------
$('btnPower').onclick = () => setPower(!state.power);
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('btnDelete').onclick = () => canvas.deleteSelected();
$('btnZoomIn').onclick = () => canvas.zoom(1.2);
$('btnZoomOut').onclick = () => canvas.zoom(1 / 1.2);
$('btnFit').onclick = () => canvas.fit();
$('btnSend').onclick = sendChat;
$('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat(); }
});
for (const button of document.querySelectorAll('[data-example]')) {
  button.onclick = () => {
    if (state.instances.length || state.pendingProposal) return;
    const wiring = getBuiltInWiring(button.dataset.example);
    if (!wiring) return;
    const { parts, conns, warnings } = normalizeWiring(wiring, localParts);
    if (warnings.length) {
      addMessage('system', `예제를 열지 못했어요.\n${warnings.join('\n')}`, null, true);
      return;
    }
    const definitions = new Map(projectParts);
    for (const part of parts) definitions.set(part.part, localParts.get(part.part));
    setProjectParts(definitions);
    renderPalette();
    projectGeneration++;
    applyProposal({ parts, conns, title: wiring.title, origin: 'example' });
  };
}
$('btnBuildManually').onclick = () => {
  state.buildingManually = true;
  refresh();
  setPartsOpen(true);
};
const manualDialog = $('manualDialog');
const manualFrame = manualDialog.querySelector('iframe');
function updateManualTheme() {
  manualFrame.contentWindow?.postMessage({ type: 'mir-manual-theme', theme: currentTheme() }, '*');
}
manualFrame.addEventListener('load', updateManualTheme);
manualDialog.addEventListener('close', () => {
  manualFrame.contentWindow?.postMessage({ type: 'mir-manual-close' }, '*');
});
$('btnManual').onclick = () => {
  updateManualTheme();
  manualDialog.showModal();
};
$('btnCloseManual').onclick = () => manualDialog.close();
$('partSearch').oninput = renderPalette;
$('btnPaletteToggle').onclick = () => setPartsOpen($('partsPalette').hidden, true);
$('btnPaletteClose').onclick = () => setPartsOpen(false, true);
document.addEventListener('pointerdown', (e) => {
  if ($('partsPalette').hidden || document.querySelector('.modal:not(.hidden)')) return;
  if (!$('partsDock').contains(e.target) && !$('btnPaletteToggle').contains(e.target)) setPartsOpen(false);
});
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || $('partsPalette').hidden || document.querySelector('dialog[open],.modal:not(.hidden)')) return;
  setPartsOpen(false, true);
  e.preventDefault();
  e.stopImmediatePropagation();
});

$('btnPreviewApply').onclick = () => state.pendingProposal && applyProposal(state.pendingProposal);
$('btnPreviewCancel').onclick = () => { clearPreview(); refresh(); };

$('btnDiagnose').onclick = requestDiagnosis;

// Keep chat below the work toolbar, including when font/window sizes change.
function alignAgentBelowToolbar() {
  const bottom = document.querySelector('.stage-toolbar').getBoundingClientRect().bottom;
  document.documentElement.style.setProperty('--agent-top', `${Math.ceil(bottom + 12)}px`);
  const footerTop = document.querySelector('.legend').getBoundingClientRect().top;
  document.documentElement.style.setProperty('--agent-bottom', `${Math.ceil(window.innerHeight - footerTop + 12)}px`);
}
const toolbarObserver = new ResizeObserver(alignAgentBelowToolbar);
toolbarObserver.observe(document.querySelector('.stage-toolbar'));
toolbarObserver.observe(document.querySelector('.topbar'));
toolbarObserver.observe(document.querySelector('.legend'));
window.addEventListener('resize', alignAgentBelowToolbar);
alignAgentBelowToolbar();

function showCompactReply(text) {
  const bubble = $('compactReply');
  $('compactReplyText').textContent = text;
  bubble.hidden = false;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) bubble.animate([{ opacity:0,transform:'translateY(12px)' },{ opacity:1,transform:'translateY(0)' }],{duration:200,easing:'ease-out'});
}
$('btnReplyClose').onclick = () => { $('compactReply').hidden = true; $('chatInput').focus(); };
// Chat controls must not trigger canvas keyboard shortcuts or drag movement.
for (const overlay of [$('agentPanel'), $('compactReply')]) {
  for (const event of ['keydown','mousedown','mousemove','wheel','dblclick']) overlay.addEventListener(event,e=>e.stopPropagation());
}

// Keep the same composer and messages alive while the panel is folded.
const compactWorkspace = matchMedia('(max-width: 900px)');
function setChatCollapsed(collapsed, focus = false) {
  document.body.classList.toggle('chat-collapsed', collapsed);
  if (!collapsed) $('compactReply').hidden = true;
  $('btnChatToggle').setAttribute('aria-expanded', String(!collapsed));
  $('btnChatToggle').textContent = collapsed ? '대화창 펼치기 ↗' : '대화창 접기 ↘';
  $('btnChatToggle').title = collapsed ? '에이전트 대화창 펼치기' : '에이전트 대화창 접기';
  if (focus && (!collapsed || !compactWorkspace.matches)) $('chatInput').focus({ preventScroll: true });
}
$('btnChatToggle').onclick = () => setChatCollapsed(!document.body.classList.contains('chat-collapsed'), true);
compactWorkspace.addEventListener('change', event => setChatCollapsed(event.matches));
if (compactWorkspace.matches) setChatCollapsed(true);


try { canvas.wireStyle = localStorage.getItem('mir-wire-shape-v2') === 'straight' ? 'straight' : 'curve'; } catch {}
function updateWirePreview() {
  const curve = $('wireShapeToggle').checked;
  $('wirePreviewPath').setAttribute('d',curve ? 'M72 50 C146 50 214 114 288 114' : 'M72 50 L174 50 Q180 50 180 56 L180 108 Q180 114 186 114 L288 114');
  $('wirePreviewLabel').textContent=curve?'곡선':'직선';
  $('wirePreviewPath').parentElement.setAttribute('aria-label',curve?'부드럽게 휘어지는 곡선 배선 미리보기':'모서리가 살짝 둥근 직선 배선 미리보기');
}
$('btnWireSettings').onclick = () => { closeProjectMenu(); $('wireShapeToggle').checked=canvas.wireStyle==='curve'; updateWirePreview(); $('wireSettings').showModal(); };
$('btnWireSettingsClose').onclick = () => $('wireSettings').close();
$('wireShapeToggle').onchange=()=>{updateWirePreview();canvas.wireStyle=$('wireShapeToggle').checked?'curve':'straight';try{localStorage.setItem('mir-wire-shape-v2',canvas.wireStyle);}catch{}canvas.render();};
const projectMenu = $('projectMenu');
function closeProjectMenu() { projectMenu.close(); $('btnMenu').setAttribute('aria-expanded', 'false'); $('btnMenu').focus(); }
$('btnMenu').onclick = () => { projectMenu.showModal(); $('btnMenu').setAttribute('aria-expanded', 'true'); };
$('btnMenuClose').onclick = closeProjectMenu;
projectMenu.addEventListener('cancel', e => { e.preventDefault(); closeProjectMenu(); });
projectMenu.addEventListener('click', e => { const r = projectMenu.getBoundingClientRect(); if (e.target === projectMenu && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closeProjectMenu(); });
function resetProjectChat() {
  $('messages').replaceChildren();
  $('compactReply').hidden = true;
  greet();
}

$('btnNew').onclick = async () => {
  if (openingProject) return;
  closeProjectMenu();
  if (hasUnsavedChanges() && !await confirmAction('저장하지 않은 작업이 사라집니다. 새로 시작할까요?')) return;
  await api.newProject?.();
  projectGeneration++;
  state.buildingManually = false;
  state.instances = []; state.wires = []; state.title = ''; state.gpio = {}; state.requirements = '';
  setProjectParts(new Map()); renderPalette();
  backend.reset();
  clearPreview(); syncToCanvas(); resetProjectHistory(); setPower(false);
  savedSnapshot = snapshotState();
  api.resetAgent();
  resetProjectChat();
};
function projectData() {
  const data = { format: 'mir-wiring/1', title: state.title, instances: state.instances, wires: state.wires };
  const definitions = new Set(state.instances.map((instance) => instance.part));
  const embedded = [];
  for (const id of definitions) {
    const part = state.defs.get(id);
    if (!part || (part.source === 'builtin' && part === localParts.get(id))) continue;
    const { source, file, image, _layout, ...portable } = part;
    if (part.imageData && part.imageFit === 'none' && _layout) portable._layout = _layout;
    embedded.push(portable);
  }
  if (embedded.length) data.partDefinitions = embedded;
  return data;
}

async function projectDefinitions(data) {
  const parts = new Map((data.partDefinitions || []).map((part) => {
    // Rebuild the pin references from the validated definitions.
    if (part._layout) {
      const pos = Object.fromEntries(part.pins.map((pin) => [pin.id, { ...part._layout.pos[pin.id], def: pin }]));
      part = { ...part, _layout: { ...part._layout, pos } };
    }
    return [part.id, part];
  }));
  const catalog = partCatalog();
  for (const id of new Set(data.instances.map((instance) => instance.part))) {
    if (parts.has(id) || catalog.has(id)) continue;
    const part = await backend.fetchPart(id);
    if (part) parts.set(id, part);
  }
  window.MirProjectValidation.validateProject(data, new Map([...catalog, ...parts]));
  return parts;
}

let savingProject = false;
async function saveProject(saveAs = false) {
  if (savingProject) return false;
  savingProject = true;
  closeProjectMenu();
  try {
    const generation = projectGeneration;
    const savingSnapshot = snapshotState();
    const data = projectData();
    window.MirProjectValidation.validateProject(data, state.defs);
    const saved = await api.saveProject(data, saveAs);
    if (saved) void refreshRecentProjects();
    if (!saved || generation !== projectGeneration) return false;
    if (saved.saved) savedSnapshot = savingSnapshot;
    addMessage('system', saved.message, null, true);
    return saved.saved;
  }
  catch (err) { addMessage('system', `저장하지 못했어요: ${err.message}`); return false; }
  finally { savingProject = false; }
}
$('btnSave').onclick = () => saveProject();
$('btnSaveAs').onclick = () => saveProject(true);
async function openProject(recentPath) {
  closeProjectMenu();
  if (hasUnsavedChanges() && !await confirmAction('현재 작업을 열려는 파일로 바꿀까요? 저장하지 않은 변경은 사라집니다.')) return;
  let d, definitions;
  try {
    d = await api.openProject(recentPath);
    if (d) {
      window.MirProjectValidation.validateProject(d);
      definitions = await projectDefinitions(d);
      await api.acceptOpenProject?.(d.title);
    }
  } catch (err) { const message = `열지 못했어요: ${err.message}`;
    if (recentPath) $('recentProjectStatus').textContent = message;
    addMessage('system', message, null, true); return; }
  if (!d) return;
  projectGeneration++;
  state.buildingManually = false;
  state.instances = d.instances || []; state.wires = d.wires || []; state.title = d.title || ''; state.requirements = '';
  setProjectParts(definitions); renderPalette();
  backend.reset();
  clearPreview(); syncToCanvas(); resetProjectHistory(); setPower(false); canvas.fit();
  savedSnapshot = snapshotState();
  resetProjectChat();
  void refreshRecentProjects();
  await api.resetAgent();
}
let openingProject = false;
async function requestOpenProject(path) {
  if (openingProject) return;
  openingProject = true;
  try { await openProject(path); } finally { openingProject = false; }
}
$('btnOpen').onclick = () => requestOpenProject();

$('btnImportPart').onclick = async () => {
  try {
  const r = await api.importParts();
  if (r.added.length) addMessage('system', `부품 추가됨: ${r.added.join(', ')}`);
  if (r.errors.length) addMessage('system', `부품 추가 실패\n${r.errors.join('\n')}`);
  await loadParts();
  } catch (e) { addMessage('system', `부품 가져오기 실패: ${e.message}`, null, true); }
};
$('btnPartMenu').onclick = (e) => { e.stopPropagation(); $('partMenu').classList.toggle('hidden'); };
document.addEventListener('click', () => $('partMenu').classList.add('hidden'));
$('partMenu').onclick = async (e) => {
  const act = e.target.dataset.act;
  if (act === 'template') api.savePartTemplate();
  if (act === 'folder') api.openPartsFolder();
  if (act === 'guide') api.openDoc('부품-JSON-양식.md');
  if (act === 'reload') loadParts();
  if (act === 'datasheet') $('partModal').classList.remove('hidden');
};
$('btnPartCancel').onclick = () => $('partModal').classList.add('hidden');
$('partSource').addEventListener('input', () => $('partSource').setCustomValidity(''));
$('btnPartAsk').onclick = () => {
  const text = $('partSource').value.trim();
  if (!text) { $('partSource').setCustomValidity('데이터시트 내용을 입력해 주세요.'); $('partSource').reportValidity(); return; }
  if (state.busy) { $('partSource').setCustomValidity('진행 중인 요청이 끝난 뒤 다시 시도해 주세요.'); $('partSource').reportValidity(); return; }
  $('partSource').setCustomValidity('');
  $('partModal').classList.add('hidden');
  if (showConnectionSetup()) return;
  $('partSource').value = '';
  askAgent(buildPartRequest(text), { shown: '데이터시트 내용으로 새 부품을 만들어줘' });
};

let connectionAttempt = null;
$('btnSettings').onclick = openSettings;
$('btnSettingsCancel').onclick = () => $('settingsModal').close();
$('settingsModal').addEventListener('close', () => {
  $('inServerKey').value = '';
  connectionAttempt?.abort();
});
$('serverConnectionMode').onchange = updateSettingsFields;
$('connectionSettings').onsubmit = async (event) => {
  event.preventDefault();
  const controls = ['btnSettingsSave', 'serverConnectionMode', 'inServerUrl', 'inServerKey'].map($);
  if (controls[0].disabled) return;
  const status = $('testResult');
  if (state.busy || backend.isBusy()) {
    status.className = 'test-result bad';
    status.textContent = '진행 중인 채팅이나 DB 작업이 끝난 뒤 다시 시도해 주세요.';
    return;
  }
  for (const control of controls) control.disabled = true;
  const attempt = new AbortController();
  connectionAttempt = attempt;
  status.className = 'test-result';
  try {
    const result = await connectRequired(
      { mode: $('serverConnectionMode').value, url: $('inServerUrl').value, key: $('inServerKey').value },
      { signal: attempt.signal, progress: text => { status.textContent = text; } }
    );
    $('inServerKey').value = '';
    await loadSettings();
    backend.connectionChanged(result.sameServer);
    void backend.connectAutomatically();
    if (result.aiError) {
      status.classList.add('bad');
      status.textContent = 'DB에 연결됐어요. Copilot AI는 설정을 확인해 주세요. ' + result.aiError;
      $('inServerKey').placeholder = '현재 키 유지';
    } else {
      addMessage('system', 'Copilot AI와 배선 DB를 연결했어요.');
      $('settingsModal').close();
    }
  } catch (error) {
    if (!attempt.signal.aborted) {
      status.classList.add('bad');
      status.textContent = error.message;
    }
  } finally {
    connectionAttempt = null;
    for (const control of controls) control.disabled = false;
  }
};

window.addEventListener('keydown', (e) => {
  if(document.querySelector('dialog[open]:modal,.modal:not(.hidden)'))return;
  const props=document.querySelector('.part-properties-dialog[open]');
  if(e.key==='Escape'&&props){props.close();e.preventDefault();return;}
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (typing || e.isComposing) return;
  const action = partTransforms[e.code];
  if (action && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey && transformPart(action)) e.preventDefault();
  if (e.key === 'Delete' || e.key === 'Backspace') canvas.deleteSelected();
  if (e.key === 'Escape') { canvas.cancelPending(); canvas.select(null); }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
});

// ---------- 떠 있는 AI 채팅창 너비 조절 ----------
const PANEL_LIMITS = { right: [300, 680, 360] };

function setPanelWidth(side, px) {
  const [min, limit] = PANEL_LIMITS[side];
  const max = Math.max(min, Math.min(limit, document.querySelector('.layout').clientWidth - 632));
  const v = Math.round(Math.min(max, Math.max(min, px)));
  document.querySelector('.layout').style.setProperty(`--${side}-w`, `${v}px`);
  document.documentElement.style.setProperty('--agent-width', `${v}px`);
  const bar = document.querySelector(`.resizer[data-side="${side}"]`);
  bar.setAttribute('aria-valuemin', min);
  bar.setAttribute('aria-valuemax', max);
  bar.setAttribute('aria-valuenow', v);
  return v;
}

function initResizers() {
  for (const side of Object.keys(PANEL_LIMITS)) {
    let width = PANEL_LIMITS[side][2];
    try {
      const saved = Number(localStorage.getItem(`mir-panel-${side}`));
      if (saved) width = saved;
    } catch { /* 저장된 값 없이 기본 너비 */ }
    setPanelWidth(side, width);
  }
  window.addEventListener('resize', () => {
    const width = parseFloat(document.querySelector('.layout').style.getPropertyValue('--right-w'));
    setPanelWidth('right', width || PANEL_LIMITS.right[2]);
  });
  document.querySelectorAll('.resizer').forEach((bar) => {
    const side = bar.dataset.side;
    bar.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const panel = document.querySelector('.side');
      const startX = e.clientX;
      const startW = panel.getBoundingClientRect().width;
      bar.classList.add('dragging');
      document.body.classList.add('resizing');
      const move = (ev) => {
        const dx = ev.clientX - startX;
        const v = setPanelWidth(side, startW - dx);
        try { localStorage.setItem(`mir-panel-${side}`, v); } catch { /* 무시 */ }
      };
      const up = () => {
        bar.classList.remove('dragging');
        document.body.classList.remove('resizing');
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
    bar.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const current = document.querySelector('.side').getBoundingClientRect().width;
      const px = e.key === 'Home' ? PANEL_LIMITS[side][0] : e.key === 'End' ? PANEL_LIMITS[side][1]
        : current + (e.key === 'ArrowLeft' ? 20 : -20);
      const v = setPanelWidth(side, px);
      try { localStorage.setItem(`mir-panel-${side}`, v); } catch { /* 무시 */ }
    });
    bar.addEventListener('dblclick', () => {
      setPanelWidth(side, PANEL_LIMITS[side][2]);
      try { localStorage.removeItem(`mir-panel-${side}`); } catch { /* 무시 */ }
    });
  });
}

// ---------- 화이트/블랙 모드 ----------
// 처음에는 Windows 설정을 따르고, 버튼으로 바꾸면 그 선택을 기억한다.
function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set) return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  $('btnTheme').textContent = currentTheme() === 'dark' ? '☀ 라이트 모드로 전환' : '☾ 다크 모드로 전환';
  $('btnTheme').setAttribute('aria-pressed', String(currentTheme() === 'dark'));
  for (const option of document.querySelectorAll('input[name="appTheme"]')) {
    option.checked = option.value === currentTheme();
  }
  updateManualTheme();
}

function chooseTheme(next) {
  try { localStorage.setItem('mir-theme', next); } catch { /* 저장 못 해도 이번 실행에는 적용 */ }
  applyTheme(next);
}
$('btnTheme').onclick = () => chooseTheme(currentTheme() === 'dark' ? 'light' : 'dark');
for (const option of document.querySelectorAll('input[name="appTheme"]')) {
  option.addEventListener('change', () => chooseTheme(option.value));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
try { applyTheme(localStorage.getItem('mir-theme')); } catch { applyTheme(); }

function greet() {
  if (state.settings.mode === 'web') return;
  if (state.settings.mode === 'server') {
    addMessage('system', state.settings.serverSecretConfigured
      ? '연결된 배선 서버를 사용합니다. 오른쪽 채팅창에 설계를 요청하세요. 연결이 안 되면 에이전트 연결 탭에서 연결 정보를 확인하세요.'
      : '예제와 배선 실습은 바로 시작할 수 있어요. AI와 DB를 쓰려면 도움말 → 에이전트 연결 설정을 열어 주세요.');
    return;
  }
  if (state.settings.mode === 'demo') {
    addMessage('system', '현재는 데모 모드입니다. Copilot Studio에 연결되지 않아 저장된 예시만 보여 줍니다. 자유로운 설계 요청은 에이전트 연결 탭에서 실제 에이전트를 연결한 뒤 보내세요.');
    return;
  }
  addMessage('agent', `안녕하세요! 임베디드 배선 가이드 **미르**입니다.
만들고 싶은 것을 말하면 보드·센서의 핀 기능, 전압, 통신 방식을 따져 배선을 추천하고 2D 화면에 그려 드려요.

그다음은 여러분 차례예요. **가상 전원**을 켜고 핀을 측정해 보고, 문제가 있는지 직접 판단해 보세요. 이상한 점을 적고 **진단 요청**을 누르면 원인과 수정안을 알려 드릴게요.`);
}

// build/icon.png가 있으면 상단 로고와 탭 아이콘으로 쓴다. 없으면 ⚡ 그대로.
async function applyAppIcon() {
  const src = await api.getAppIcon?.();
  if (!src) return;
  const img = document.createElement('img');
  img.src = src;
  img.alt = '미르';
  $('logo').replaceChildren(img);
  $('logo').classList.add('has-image');
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = src;
  document.head.appendChild(link);
}

const backend = initBackendPanel({
  getState: () => state,
  getProjectGeneration: () => projectGeneration,
  canReplace: () => !openingProject,
  getCatalog: partCatalog,
  registerParts: (parts) => {
    for (const [id, part] of parts) serverParts.set(id, part);
    setProjectParts(projectParts);
  },
  renderParts: () => { renderPalette(); refresh(); },
  message: (text) => addMessage('system', text),
  replace: (next, parts) => {
    projectGeneration++;
    // Detach the native save target before the next save can be queued.
    void api.newProject?.();
    for (const button of $('messages').querySelectorAll('[data-project-action]')) button.remove();
    setProjectParts(parts);
    Object.assign(state, next); state.gpio = {};
    savedSnapshot = snapshotState();
    clearPreview(); syncToCanvas(); resetProjectHistory();
    separateParts(next.instances, state.defs, [], { gap: 0, preservePlaced: true });
    pushHistory(); setPower(false); canvas.fit();
  }
});

initVerificationPanel({ message: (text) => addMessage('system', text) });

export async function initWorkspace() {
  await loadParts();
  pushHistory();
  for (const button of document.querySelectorAll('[data-example]')) button.disabled = false;
  initResizers();
  await applyAppIcon();
  await loadSettings();
  alignAgentBelowToolbar();
  void refreshRecentProjects();
  greet();
  void backend.connectAutomatically();
}

let closePromptOpen=false;
window.api?.onConfirmClose?.(async()=>{
  if(closePromptOpen)return;
  closePromptOpen=true;
  try {
    const exit=await confirmAction('저장하지 않은 작업이 있어요. 종료할까요?', {title:'미르 종료',cancelLabel:'계속 편집',acceptLabel:'저장하지 않고 종료',extraLabel:'저장 후 종료'});
    if(exit==='save') { const saved=await saveProject(); if(saved && !hasUnsavedChanges()) await window.api.closeConfirmed(); }
    else if(exit===true)await window.api.closeConfirmed();
  } finally {closePromptOpen=false;}
});

const wireDock=document.createElement('div');wireDock.className='wire-dock';wireDock.setAttribute('aria-label','선 종류와 자동 연결');
const choices=document.createElement('div');choices.className='wire-kind-tabs';choices.setAttribute('role','group');choices.setAttribute('aria-label','새로 연결할 선 종류');
const kinds=[['power','전원'],['gnd','GND'],['sda','SDA'],['scl','SCL'],['signal','신호'],['contact','릴레이 접점']];
for(const [kind,label] of kinds){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label+' 선');b.title=label;b.dataset.wireKind=kind;b.setAttribute('aria-pressed','false');b.style.setProperty('--kind-color',`var(--wire-${kind})`);b.innerHTML='<i aria-hidden="true"></i>';b.onclick=()=>{canvas.selectedWireKind=kind;for(const other of choices.children)other.setAttribute('aria-pressed',String(other===b));};choices.append(b);}
const auto=document.createElement('button');auto.id='btnAutoConnect';auto.className='primary';auto.textContent='자동으로 연결';
auto.setAttribute('aria-pressed','false');
auto.onclick=()=>{
 const enable=auto.getAttribute('aria-pressed')!=='true';
 canvas.selectedWireKind=enable?null:'sda';
 for(const b of choices.children)b.setAttribute('aria-pressed',String(!enable && b.dataset.wireKind==='sda'));
 auto.setAttribute('aria-pressed',String(enable));
 auto.textContent=enable?'✓ 자동 연결 켜짐':'자동으로 연결';
};
choices.addEventListener('click',()=>{auto.setAttribute('aria-pressed','false');auto.textContent='자동으로 연결';});
canvas.selectedWireKind='sda';
choices.querySelector('[data-wire-kind="sda"]').setAttribute('aria-pressed','true');
const dockActions = document.createElement('div');
dockActions.className = 'wire-dock-actions';
for (const [id, label, hint, action] of [
  ['btnDockDeleteWire', '선 삭제', '선을 선택한 뒤 삭제', () => {
    if (canvas.selected?.type === 'wire') void canvas.deleteSelected();
  }],
  ['btnDockUndo', '↶', '실행 취소 (Ctrl+Z)', undo],
  ['btnDockRedo', '↷', '다시 실행 (Ctrl+Y)', redo]
]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = id;
  button.textContent = label;
  button.title = hint;
  button.setAttribute('aria-label', id === 'btnDockDeleteWire' ? label : hint);
  button.onclick = action;
  dockActions.append(button);
}
const dockConnection = document.createElement('div');
dockConnection.className = 'wire-dock-connection';
dockConnection.append(choices, auto);
const dockMovement = document.createElement('div');
dockMovement.className = 'wire-dock-actions wire-dock-movement';
const moveTool = document.createElement('button');
moveTool.type = 'button';
moveTool.id = 'btnMoveTool';
moveTool.setAttribute('aria-label', '화면 이동 및 부품 선택');
moveTool.title = '빈 곳 드래그: 화면 이동 · 부품 드래그: 이동 · Shift 또는 빈 곳 더블클릭 후 드래그: 범위 선택';
moveTool.setAttribute('aria-description', moveTool.title);
moveTool.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5v-1a1.5 1.5 0 0 1 3 0V11m0-6a1.5 1.5 0 0 1 3 0v7m0-4a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6 7h-2c-2.2 0-3.6-1-4.8-2.6l-3.4-4.5a1.6 1.6 0 0 1 2.4-2.1L8 13Z"/></svg>';
moveTool.onclick = () => $('canvas').focus({ preventScroll: true });
dockMovement.append(moveTool);
wireDock.append(dockMovement, dockConnection, dockActions);
document.querySelector('.stage-body').append(wireDock);
updateWireDockActions();

const propertiesDialog=document.createElement('dialog');propertiesDialog.className='mir-confirm part-properties-dialog';
const propertiesClose=document.createElement('button');propertiesClose.textContent='닫기';propertiesClose.onclick=()=>propertiesDialog.close();
propertiesDialog.append($('selInfo'),propertiesClose);document.body.append(propertiesDialog);
const propertiesHandle=document.createElement('div');propertiesHandle.className='properties-drag-handle';propertiesHandle.textContent='부품 속성';propertiesHandle.title='드래그해서 이동';
propertiesDialog.prepend(propertiesHandle);
propertiesHandle.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 const rect=propertiesDialog.getBoundingClientRect();const startX=e.clientX,startY=e.clientY;
 propertiesDialog.style.left=`${rect.left}px`;propertiesDialog.style.top=`${rect.top}px`;propertiesDialog.style.right='auto';propertiesDialog.style.bottom='auto';
 propertiesHandle.setPointerCapture(e.pointerId);e.preventDefault();
 const move=event=>{const x=Math.max(0,Math.min(window.innerWidth-propertiesDialog.offsetWidth,rect.left+event.clientX-startX));const y=Math.max(0,Math.min(window.innerHeight-propertiesDialog.offsetHeight,rect.top+event.clientY-startY));propertiesDialog.style.left=`${x}px`;propertiesDialog.style.top=`${y}px`;};
 const end=()=>{propertiesHandle.removeEventListener('pointermove',move);propertiesHandle.removeEventListener('pointerup',end);propertiesHandle.removeEventListener('pointercancel',end);};
 propertiesHandle.addEventListener('pointermove',move);propertiesHandle.addEventListener('pointerup',end);propertiesHandle.addEventListener('pointercancel',end);
});
let outsideCanvasPointer=null;
document.addEventListener('pointerdown',e=>{
 if(!propertiesDialog.open || propertiesDialog.contains(e.target))return;
 if(e.target.closest('#canvas')) {outsideCanvasPointer={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};return;}
 propertiesDialog.close();
},true);
document.addEventListener('pointermove',e=>{
 if(outsideCanvasPointer?.id===e.pointerId && Math.hypot(e.clientX-outsideCanvasPointer.x,e.clientY-outsideCanvasPointer.y)>5)outsideCanvasPointer.moved=true;
},true);
document.addEventListener('pointerup',e=>{
 if(outsideCanvasPointer?.id!==e.pointerId)return;
 if(!outsideCanvasPointer.moved && propertiesDialog.open)propertiesDialog.close();
 outsideCanvasPointer=null;
},true);
document.addEventListener('pointercancel',()=>{outsideCanvasPointer=null;},true);

// Keep editable popups reachable after viewport or popup size changes.
let popupClampFrame=null;
function clampPropertiesDialog(){
  if(!propertiesDialog.open)return;
  const r=propertiesDialog.getBoundingClientRect(),gap=8,top=54;
  const x=Math.max(gap,Math.min(r.left,innerWidth-r.width-gap));
  const y=Math.max(top,Math.min(r.top,innerHeight-r.height-gap));
  propertiesDialog.style.left=`${x}px`;propertiesDialog.style.top=`${y}px`;
  propertiesDialog.style.right='auto';propertiesDialog.style.bottom='auto';
}
function schedulePopupClamp(){if(popupClampFrame!==null)return;popupClampFrame=requestAnimationFrame(()=>{popupClampFrame=null;clampPropertiesDialog();});}
window.addEventListener('resize',schedulePopupClamp);
new ResizeObserver(schedulePopupClamp).observe(propertiesDialog);
new MutationObserver(schedulePopupClamp).observe(propertiesDialog,{attributes:true,attributeFilter:['open']});

// Place tool overlays in the canvas area left of the floating chat panel.
let overlayLayoutFrame=null;
function alignWorkspaceOverlays(){
  const stage=document.querySelector('.stage-body').getBoundingClientRect();
  const toolbar=document.querySelector('.stage-toolbar').getBoundingClientRect();
  const agent=$('agentPanel').getBoundingClientRect();
  const compact = compactWorkspace.matches;
  const right = Math.max(stage.left + 20, Math.min(stage.right - 12, compact ? stage.right : agent.left - 12));
  const available=Math.max(0,right-stage.left-20);
  const paletteEdge = $('btnPaletteToggle').getBoundingClientRect().right + 12;
  const left = Math.min(right, Math.max(stage.left + 12, paletteEdge));
  if (compact) {
    wireDock.style.removeProperty('max-width');
    wireDock.style.removeProperty('left');
  } else {
    wireDock.style.maxWidth = `${right - left}px`;
    const halfDock = wireDock.getBoundingClientRect().width / 2;
    const center = Math.min(Math.max(stage.left + stage.width / 2, left + halfDock), right - halfDock);
    wireDock.style.left = `${center - stage.left}px`;
  }
  applyPaletteSize();
  const chatCollapsed = document.body.classList.contains('chat-collapsed');
  const emptyHint = $('emptyHint');
  emptyHint.style.right = compact || chatCollapsed ? '0px' : (stage.right - right) + 'px';
  const toolbarGap = Math.max(0, toolbar.bottom - stage.top);
  emptyHint.style.top = compact ? (toolbarGap + 40) + 'px' : chatCollapsed ? toolbarGap + 'px' : '';
  const toggleTop = $('btnChatToggle').getBoundingClientRect().top;
  emptyHint.style.bottom = compact ? '78px'
    : chatCollapsed ? Math.max(0, stage.bottom - Math.min(agent.top, toggleTop)) + 'px' : '';
  const preview=$('previewBar');
  preview.style.top=`${toolbar.bottom-stage.top+12}px`;
  preview.style.width=`${Math.max(0,available)}px`;
}
function scheduleOverlayLayout(){if(overlayLayoutFrame!==null)return;overlayLayoutFrame=requestAnimationFrame(()=>{overlayLayoutFrame=null;alignWorkspaceOverlays();});}
const overlaysObserver=new ResizeObserver(scheduleOverlayLayout);
for(const el of [document.querySelector('.stage-body'),document.querySelector('.stage-toolbar'),$('agentPanel'),$('gpioPanel'),wireDock])overlaysObserver.observe(el);
new MutationObserver(scheduleOverlayLayout).observe(document.body,{attributes:true,attributeFilter:['class']});
window.addEventListener('resize',scheduleOverlayLayout);
scheduleOverlayLayout();


async function refreshRecentProjects() {
  const list = $('recentProjects');
  const status = $('recentProjectStatus');
  if (!list || !status) return;
  try {
    const projects = await api.recentProjects?.() ?? [];
    const buttons = projects.map(project => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = project.title;
      button.title = project.path;
      button.onclick = () => requestOpenProject(project.path);
      const row = document.createElement('div');
      row.className = 'recent-project-row';
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'recent-project-more';
      more.textContent = '⋮';
      more.setAttribute('aria-label', `${project.title} 옵션`);
      more.onclick = () => {
        if (!recentProjectMenu.hidden && recentProjectMenuAnchor === more) {
          recentProjectMenu.hidden = true;
          return;
        }
        const rect = more.getBoundingClientRect();
        showRecentProjectMenu(project, rect.right, rect.bottom, more);
      };
      row.oncontextmenu = event => {
        event.preventDefault();
        showRecentProjectMenu(project, event.clientX, event.clientY);
      };
      row.append(button, more);
      return row;
    });
    list.replaceChildren(...buttons);
    status.textContent = buttons.length ? '' : '파일을 열거나 저장하면 여기에 표시돼요.';
  } catch { status.textContent = '최근 프로젝트를 불러오지 못했어요.'; }
}


const canvasContextMenu = document.createElement('div');
canvasContextMenu.className = 'canvas-context-menu';
canvasContextMenu.hidden = true;
const contextDelete = document.createElement('button');
contextDelete.type = 'button';
contextDelete.textContent = '삭제';
canvasContextMenu.append(contextDelete);
document.body.append(canvasContextMenu);
contextDelete.onclick = () => {
  canvasContextMenu.hidden = true;
  void canvas.deleteSelected();
};
$('canvas').addEventListener('contextmenu', event => {
  event.preventDefault();
  const part = event.target.closest('[data-kind="part"]');
  const wire = event.target.closest('[data-kind="wire"]');
  if (wire) canvas.select({ type: 'wire', id: wire.dataset.id });
  else if (part && !(canvas.selected?.type === 'group' && canvas.selected.refs.has(part.dataset.ref))) {
    canvas.select({ type: 'part', ref: part.dataset.ref });
  }
  if (!canvas.selected) return;
  canvasContextMenu.hidden = false;
  canvasContextMenu.style.left = `${Math.min(event.clientX, innerWidth - canvasContextMenu.offsetWidth - 8)}px`;
  canvasContextMenu.style.top = `${Math.min(event.clientY, innerHeight - canvasContextMenu.offsetHeight - 8)}px`;
  contextDelete.focus();
});
document.addEventListener('pointerdown', event => {
  if (!canvasContextMenu.contains(event.target)) canvasContextMenu.hidden = true;
}, true);
canvasContextMenu.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  canvasContextMenu.hidden = true;
  event.stopPropagation();
});
window.addEventListener('blur', () => { canvasContextMenu.hidden = true; });


const recentProjectMenu = document.createElement('div');
recentProjectMenu.className = 'canvas-context-menu';
recentProjectMenu.hidden = true;
document.body.append(recentProjectMenu);
let recentProjectMenuAnchor = null;
function showRecentProjectMenu(project, x, y, anchor = null) {
  recentProjectMenuAnchor = anchor;
  const remove = document.createElement('button');
  remove.textContent = '삭제';
  remove.title = '최근 목록에서 제거';
  remove.onclick = () => {
    recentProjectMenu.hidden = true;
    void updateRecentProject(project, null);
  };
  const rename = document.createElement('button');
  rename.textContent = '이름 변경';
  rename.onclick = () => {
    recentProjectMenu.hidden = true;
    const dialog = document.createElement('dialog');
    dialog.className = 'mir-confirm';
    dialog.innerHTML = '<form method="dialog"><h2>최근 프로젝트 이름 변경</h2><input aria-label="프로젝트 이름" maxlength="120" required><div class="modal-actions"><button class="primary" value="rename">확인</button><button value="cancel" formnovalidate>취소</button></div></form>';
    const input = dialog.querySelector('input');
    input.value = project.title;
    dialog.querySelector('form').onsubmit = event => {
      if (event.submitter?.value !== 'cancel' && !input.value.trim()) event.preventDefault();
    };
    dialog.onclose = () => {
      if (dialog.returnValue === 'rename') void updateRecentProject(project, input.value.trim());
      dialog.remove();
    };
    document.body.append(dialog);
    dialog.showModal();
    input.select();
  };
  recentProjectMenu.replaceChildren(remove, rename);
  recentProjectMenu.hidden = false;
  const width = recentProjectMenu.offsetWidth;
  const height = recentProjectMenu.offsetHeight;
  const left = anchor ? x - width : x;
  const top = anchor && y + height > innerHeight - 8
    ? anchor.getBoundingClientRect().top - height + 1
    : y - Number(Boolean(anchor));
  recentProjectMenu.style.left = `${Math.max(8, Math.min(left, innerWidth - width - 8))}px`;
  recentProjectMenu.style.top = `${Math.max(8, Math.min(top, innerHeight - height - 8))}px`;
  rename.focus();
}
async function updateRecentProject(project, name) {
  try {
    await api.updateRecentProject(project.path, name);
    await refreshRecentProjects();
  } catch (error) { $('recentProjectStatus').textContent = error.message; }
}
document.addEventListener('pointerdown', event => {
  if (!recentProjectMenu.contains(event.target) && !recentProjectMenuAnchor?.contains(event.target)) recentProjectMenu.hidden = true;
}, true);
recentProjectMenu.addEventListener('keydown', event => {
  if (event.key === 'Escape') { recentProjectMenu.hidden = true; event.stopPropagation(); }
});
