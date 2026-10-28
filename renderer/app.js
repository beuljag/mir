import { WiringCanvas, layoutPart } from './canvas.js';
import { drawArt, lookOf, BARE } from './art.js';
import { simulate, splitKey } from './sim.js';
import { defFor, cleanProps, editableKind, LED_COLORS, RESISTOR_PRESETS, formatOhms, parseOhms } from './props.js';
import {
  buildCatalog, wiringSnapshot, buildRecommendRequest, buildChatRequest,
  buildDiagnoseRequest, buildPartRequest, parseReply, demoReply
} from './agent.js';

const $ = (id) => document.getElementById(id);
const api = window.api;

const CATEGORY = {
  board: '보드', sensor: '센서', display: '디스플레이', output: '출력', input: '입력',
  module: '모듈', actuator: '구동기', power: '전원', passive: '수동 소자'
};
const PIN_TYPE = {
  power_out: '전원 출력', power_in: '전원 입력', gnd: 'GND', gpio: '입출력(GPIO)', input: '입력',
  output: '출력', passive: '단자', contact: '릴레이 접점', nc: '사용 금지'
};
const state = {
  defs: new Map(),
  instances: [],
  wires: [],
  title: '',
  power: false,
  gpio: {},
  pressed: new Set(),
  history: [],
  future: [],
  settings: { mode: 'demo' },
  pendingProposal: null,
  busy: false
};

// ---------- 툴팁 ----------
const tooltipEl = $('tooltip');
const tooltip = {
  showPin(key, e) {
    const [ref, pid] = splitKey(key);
    const inst = state.instances.find((i) => i.ref === ref);
    const def = defFor(state.defs, inst);
    const pin = def?.pins.find((p) => p.id === pid);
    if (!pin) return;
    const conns = state.wires.filter((w) => w.from === key || w.to === key).map((w) => (w.from === key ? w.to : w.from));
    let html = `<b>${ref}.${pin.label || pin.id}</b> <span class="dim">(${pin.id})</span><br><span class="dim">${def.name}</span><br>종류: ${PIN_TYPE[pin.type] || pin.type}`;
    if (pin.voltage != null) html += `<br>${pin.type === 'power_out' ? '출력 전압' : '로직 전압'}: ${pin.voltage}${typeof pin.voltage === 'number' ? 'V' : ' 전압을 따름'}`;
    if (pin.minVoltage != null || pin.maxVoltage != null) {
      html += `<br>허용 범위: ${pin.minVoltage != null ? pin.minVoltage + 'V' : ''} ~ ${pin.maxVoltage != null ? pin.maxVoltage + 'V' : ''}`;
    }
    if (pin.functions?.length) html += `<br>기능: ${pin.functions.join(', ')}`;
    if (pin.note) html += `<br><span class="warn">※ ${pin.note}</span>`;
    html += `<br>연결: ${conns.length ? conns.join(', ') : '없음'}`;
    if (state.power && canvas.sim) {
      const net = canvas.sim.netByPin[key];
      const v = net?.voltage;
      html += `<div class="meter">🔌 멀티미터: <span class="v">${v == null ? '측정 안 됨(떠 있음)' : v.toFixed(2) + ' V'}</span>`;
      if (net?.kind === 'gnd') html += ' (GND)';
      if (net?.via) html += `<br>${net.via}`;
      if (net?.short) html += '<br><span class="err">⚡ 서로 다른 전원이 한 선에 직접 연결됨 (불꽃)</span>';
      const src = net?.sources?.filter((s) => s.strength !== 'pullup').map((s) => s.label);
      if (src?.length) html += `<br>공급원: ${src.join(', ')}`;
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
    let html = `<b>${w.from} ↔ ${w.to}</b><br>${w.origin === 'ai' ? 'AI 추천 배선' : '직접 연결한 배선'}`;
    if (w.note) html += `<br>${escapeHtml(w.note)}`;
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
    const x = Math.min(e.clientX + 16, window.innerWidth - tooltipEl.offsetWidth - 8);
    const y = Math.min(e.clientY + 16, window.innerHeight - tooltipEl.offsetHeight - 8);
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  },
  hide() { tooltipEl.classList.add('hidden'); }
};

// ---------- 캔버스 ----------
const canvas = new WiringCanvas($('canvas'), {
  getDefs: () => state.defs,
  onChange: () => { syncFromCanvas(); pushHistory(); refresh(); },
  onSelect: (sel) => showSelection(sel),
  onPartClick: (ref) => {
    // 가상 전원이 켜져 있을 때 버튼을 클릭하면 눌림/떼기
    const inst = state.instances.find((i) => i.ref === ref);
    const def = defFor(state.defs, inst);
    if (state.power && def?.behavior?.kind === 'button') {
      state.pressed.has(ref) ? state.pressed.delete(ref) : state.pressed.add(ref);
      refresh();
      return true;
    }
    return false;
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

function pushHistory() {
  const s = snapshotState();
  if (state.history[state.history.length - 1] === s) return;
  state.history.push(s);
  if (state.history.length > 100) state.history.shift();
  state.future = [];
}

function restore(s) {
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

function refresh() {
  canvas.sim = state.power ? runSim() : null;
  canvas.render();
  $('emptyHint').classList.toggle('hidden', state.instances.length > 0 || !!canvas.preview);
  $('stageTitle').textContent = state.title;
  renderGpioPanel();
}

// ---------- 부품함 ----------
let paletteCat = 'all';
const paletteCollapsed = new Set((() => { try { return JSON.parse(localStorage.getItem('mir-palette-collapsed') || '[]'); } catch { return []; } })());

async function loadParts() {
  const { parts, errors } = await api.listParts();
  state.defs = new Map(parts.map((p) => [p.id, p]));
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
  item.onclick = () => addPart(d.id);
  item.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addPart(d.id); } };
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
  const key = `${d.id}|${d.imageData ? 'img' : 'art'}`;
  if (thumbCache.has(key)) return thumbCache.get(key).cloneNode(true);
  const NS = 'http://www.w3.org/2000/svg';
  const { w, h, pos, top } = layoutPart(d);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `-8 -8 ${w + 16} ${h + 16}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const g = document.createElementNS(NS, 'g');
  svg.appendChild(g);
  const bare = BARE.has(lookOf(d)) && !d.imageData;
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
  const id = e.dataTransfer.getData('application/x-mir-part');
  if (!id) return;
  e.preventDefault();
  addPart(id, canvas.toWorld(e));
});

// ---------- 선택 정보 ----------
function showSelection(sel) {
  const box = $('selInfo');
  if (!sel) return box.classList.add('hidden');
  box.classList.remove('hidden');
  if (sel.type === 'part') {
    const inst = state.instances.find((i) => i.ref === sel.ref);
    const def = defFor(state.defs, inst);
    if (!def) return box.classList.add('hidden');
    box.innerHTML = `<h4>${inst.ref} · ${escapeHtml(def.name)}</h4>
      <div>${escapeHtml(def.description || '')}</div>
      ${inst.label ? `<div class="muted">역할: ${escapeHtml(inst.label)}</div>` : ''}
      ${def.sources?.length ? `<div class="muted">근거: ${escapeHtml(def.sources.join(', '))}</div>` : ''}
      ${propsEditorHtml(inst, def)}
      <div class="row"><button id="selDelete">부품 삭제</button></div>`;
    bindPropsEditor(inst, def, sel);
  } else {
    const w = state.wires.find((x) => x.id === sel.id);
    if (!w) return box.classList.add('hidden');
    box.innerHTML = `<h4>${w.from} ↔ ${w.to}</h4>
      <div>${w.origin === 'ai' ? 'AI 추천 배선' : '직접 연결한 배선'}</div>
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
    colY[c] = Math.max(colY[c], i.y + layoutPart(def).h + 50);
  }
  for (const i of instances) {
    if (i.x != null) continue;
    const def = state.defs.get(i.part);
    const c = COLUMN[def?.category] ?? 1;
    const h = def ? layoutPart(def).h : 40;
    i.x = c * 320 + (c === 0 ? 0 : 40);
    i.y = colY[c];
    colY[c] += h + 50;
  }
}

// 에이전트가 보낸 배선을 검사해서 이 프로그램이 그릴 수 있는 형태로 바꾼다.
function normalizeWiring(wiring) {
  const warnings = [];
  const parts = [];
  for (const p of wiring.parts || []) {
    if (!p.ref || !p.part) continue;
    if (!state.defs.has(p.part)) { warnings.push(`부품함에 없는 부품: ${p.part} (${p.ref}) — 부품 JSON을 추가해야 그릴 수 있어요`); continue; }
    parts.push({ ref: String(p.ref), part: p.part, label: p.label, props: cleanProps(state.defs.get(p.part), p.props) });
  }
  const conns = [];
  for (const c of wiring.connections || []) {
    const ok = [c.from, c.to].every((k) => {
      if (typeof k !== 'string' || !k.includes('.')) return false;
      const [ref, pid] = splitKey(k);
      const p = parts.find((x) => x.ref === ref);
      return p && state.defs.get(p.part).pins.some((pin) => pin.id === pid);
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
  if (addedParts.length) desc.push(`<span class="add">+ 부품 ${addedParts.map((p) => p.ref).join(', ')}</span>`);
  if (changedProps.length) desc.push(`<span class="add">값 변경 ${changedProps.map((p) => p.ref).join(', ')}</span>`);
  if (removedParts.length) desc.push(`<span class="del">− 부품 ${removedParts.map((p) => p.ref).join(', ')}</span>`);
  $('previewText').innerHTML = `<b>AI 수정안 미리보기</b> — ${desc.join(' · ')}<br><span class="muted">초록 점선=추가, 빨간 점선=삭제. 적용하기 전에 확인하세요.</span>`;
  $('previewBar').classList.remove('hidden');
  refresh();
}

function applyProposal({ parts, conns, title, addedParts = [] }) {
  const keep = new Map(state.instances.map((i) => [`${i.ref}|${i.part}`, i]));
  const placed = new Map(addedParts.map((p) => [`${p.ref}|${p.part}`, p]));
  const instances = parts.map((p) => {
    const old = keep.get(`${p.ref}|${p.part}`) || placed.get(`${p.ref}|${p.part}`);
    return { ref: p.ref, part: p.part, label: p.label, x: old?.x, y: old?.y, ...((p.props || old?.props) ? { props: p.props || old.props } : {}) };
  });
  placeNew(instances, instances.filter((i) => i.x != null));
  state.instances = instances;
  state.wires = conns.map((c, n) => ({ id: `a${Date.now().toString(36)}${n}`, from: c.from, to: c.to, note: c.note, origin: 'ai' }));
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

function addMessage(role, text, extra) {
  const m = document.createElement('div');
  m.className = `msg ${role}`;
  m.innerHTML = role === 'agent' ? renderMarkdown(text) : escapeHtml(text);
  if (extra) m.appendChild(extra);
  $('messages').appendChild(m);
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
  card.querySelector('[data-act="draw"]').onclick = () => proposeWiring(wiring);
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

async function askAgent(message, { shown, ctx = {} } = {}) {
  if (state.busy) return;
  state.busy = true;
  $('btnSend').disabled = true;
  if (shown) addMessage('user', shown);
  const typing = addMessage('agent', '에이전트가 생각하는 중…');
  typing.classList.add('typing');
  try {
    let reply;
    const res = await api.sendToAgent(message, buildCatalog(state.defs));
    if (res.demo) {
      await new Promise((r) => setTimeout(r, 500));
      reply = demoReply(message, ctx);
    } else {
      reply = res.reply;
    }
    typing.remove();
    const { text, wiring, part } = parseReply(reply);
    const extra = wiring ? wiringCard(wiring) : part ? partCard(part) : null;
    addMessage('agent', text || (wiring ? '배선을 제안합니다.' : '(빈 응답)'), extra);
    if (wiring) proposeWiring(wiring);
  } catch (e) {
    typing.remove();
    addMessage('system', `에이전트 호출 실패: ${e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}\n⚙ 설정에서 연결 정보를 확인하세요.`);
  } finally {
    state.busy = false;
    $('btnSend').disabled = false;
  }
}

function sendChat() {
  const text = $('chatInput').value.trim();
  if (!text) return;
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
  if (!state.instances.length) {
    addMessage('system', '먼저 배선을 만들어 주세요.');
    return;
  }
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
  const pill = $('connPill');
  const on = state.settings.mode !== 'demo';
  pill.textContent = on ? 'Copilot Studio 연결' : '데모 모드';
  pill.className = on ? 'badge b-ok' : 'badge b-mute';
}

function openSettings() {
  const s = state.settings;
  document.querySelectorAll('input[name="mode"]').forEach((r) => { r.checked = r.value === s.mode; });
  $('inSecret').value = '';
  $('inSecret').placeholder = s.hasSecret ? '저장된 키 있음 (바꿀 때만 입력)' : 'Direct Line 비밀 키 붙여 넣기';
  $('inToken').value = s.tokenEndpoint || '';
  $('testResult').textContent = '';
  updateSettingsFields();
  $('settingsModal').classList.remove('hidden');
}

function updateSettingsFields() {
  const mode = document.querySelector('input[name="mode"]:checked')?.value;
  $('fieldSecret').classList.toggle('hidden', mode !== 'secret');
  $('fieldToken').classList.toggle('hidden', mode !== 'token');
}

async function saveSettings() {
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'demo';
  await api.setSettings({ mode, secret: $('inSecret').value.trim(), tokenEndpoint: $('inToken').value.trim() });
  await loadSettings();
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
document.querySelectorAll('[data-example]').forEach((b) => {
  b.onclick = () => { $('chatInput').value = b.dataset.example; sendChat(); };
});
$('partSearch').oninput = renderPalette;

$('btnPreviewApply').onclick = () => state.pendingProposal && applyProposal(state.pendingProposal);
$('btnPreviewCancel').onclick = () => { clearPreview(); refresh(); };

$('btnDiagnose').onclick = requestDiagnosis;

$('btnNew').onclick = () => {
  if (state.instances.length && !confirm('지금 배선을 지우고 새로 시작할까요?')) return;
  state.instances = []; state.wires = []; state.title = ''; state.gpio = {};
  clearPreview(); syncToCanvas(); pushHistory(); setPower(false);
  api.resetAgent();
  $('messages').replaceChildren();
  greet();
};
$('btnSave').onclick = () => api.saveProject({ format: 'mir-wiring/1', title: state.title, instances: state.instances, wires: state.wires });
$('btnOpen').onclick = async () => {
  const d = await api.openProject();
  if (!d) return;
  state.instances = d.instances || []; state.wires = d.wires || []; state.title = d.title || '';
  clearPreview(); syncToCanvas(); pushHistory(); refresh(); canvas.fit();
};

$('btnImportPart').onclick = async () => {
  const r = await api.importParts();
  if (r.added.length) addMessage('system', `부품 추가됨: ${r.added.join(', ')}`);
  if (r.errors.length) addMessage('system', `부품 추가 실패\n${r.errors.join('\n')}`);
  await loadParts();
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
$('btnPartAsk').onclick = () => {
  const text = $('partSource').value.trim();
  if (!text) return;
  $('partModal').classList.add('hidden');
  $('partSource').value = '';
  askAgent(buildPartRequest(text), { shown: '데이터시트 내용으로 새 부품을 만들어줘' });
};

$('btnSettings').onclick = openSettings;
$('btnSettingsCancel').onclick = () => $('settingsModal').classList.add('hidden');
$('btnSettingsSave').onclick = async () => { await saveSettings(); $('settingsModal').classList.add('hidden'); };
document.querySelectorAll('input[name="mode"]').forEach((r) => { r.onchange = updateSettingsFields; });
$('linkConnectGuide').onclick = (e) => { e.preventDefault(); api.openDoc('Copilot-Studio-연결-안내.md'); };
$('btnTest').onclick = async () => {
  const t = $('testResult');
  t.className = 'test-result';
  t.textContent = '저장 후 연결을 시험하는 중…';
  try {
    await saveSettings();
    t.textContent = await api.testAgent();
    t.classList.add('ok');
  } catch (e) {
    t.textContent = `실패: ${e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}`;
    t.classList.add('bad');
  }
};

window.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (typing) return;
  if (e.key === 'Delete' || e.key === 'Backspace') canvas.deleteSelected();
  if (e.key === 'Escape') { canvas.cancelPending(); canvas.select(null); }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
});

// ---------- 양쪽 패널 너비 조절 ----------
const PANEL_LIMITS = { left: [180, 420, 248], right: [300, 680, 392] };

function setPanelWidth(side, px) {
  const [min, max] = PANEL_LIMITS[side];
  const v = Math.round(Math.min(max, Math.max(min, px)));
  document.querySelector('.layout').style.setProperty(`--${side}-w`, `${v}px`);
  return v;
}

function initResizers() {
  for (const side of ['left', 'right']) {
    try {
      const saved = Number(localStorage.getItem(`mir-panel-${side}`));
      if (saved) setPanelWidth(side, saved);
    } catch { /* 저장된 값 없이 기본 너비 */ }
  }
  document.querySelectorAll('.resizer').forEach((bar) => {
    const side = bar.dataset.side;
    bar.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const panel = side === 'left' ? document.querySelector('.palette') : document.querySelector('.side');
      const startX = e.clientX;
      const startW = panel.getBoundingClientRect().width;
      bar.classList.add('dragging');
      document.body.classList.add('resizing');
      const move = (ev) => {
        const dx = ev.clientX - startX;
        const v = setPanelWidth(side, side === 'left' ? startW + dx : startW - dx);
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
  $('btnTheme').textContent = currentTheme() === 'dark' ? '☀ 화이트 모드' : '☾ 블랙 모드';
}

$('btnTheme').onclick = () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('mir-theme', next); } catch { /* 저장 못 해도 이번 실행에는 적용 */ }
  applyTheme(next);
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
try { applyTheme(localStorage.getItem('mir-theme')); } catch { applyTheme(); }

function greet() {
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

(async function init() {
  await loadSettings();
  await loadParts();
  pushHistory();
  initResizers();
  applyAppIcon();
  greet();
})();
