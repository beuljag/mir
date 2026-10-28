// 2D 가상 실습 화면 (SVG). 부품 배치, 배선 그리기/삭제, 핀 정보, 가상 전원 표시를 담당한다.
import { pinKey, splitKey } from './sim.js';
import { drawArt, lookOf, BARE, labelInset } from './art.js';

const NS = 'http://www.w3.org/2000/svg';
const PIN_GAP = 18;
const HEADER = 30;
const PAD = 10;

const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

// 부품의 크기와 각 핀 좌표(부품 기준)를 계산한다.
export function layoutPart(def) {
  if (def._layout) return def._layout;
  const by = { left: [], right: [], top: [], bottom: [] };
  for (const p of def.pins) (by[p.side] || by.left).push(p);
  const isBoard = def.behavior?.kind === 'board';
  const maxLabel = (arr) => Math.max(0, ...arr.map((p) => (p.label || p.id).length));
  const sideW = Math.max(maxLabel(by.left), maxLabel(by.right)) * 7 + 14;
  const titleW = def.name.length * 7.5 + 64;
  const topW = Math.max(by.top.length, by.bottom.length) * 44 + 20;
  const w = Math.max(isBoard ? 170 : 110, (by.left.length && by.right.length ? sideW * 2 + 30 : sideW + 50), titleW, topW);
  const rows = Math.max(by.left.length, by.right.length, 1);
  const extraTop = by.top.length ? 18 : 0;
  const h = HEADER + extraTop + rows * PIN_GAP + PAD + (by.bottom.length ? 18 : 0) + (isBoard ? 0 : 18);
  const pos = {};
  by.left.forEach((p, i) => { pos[p.id] = { x: 0, y: HEADER + extraTop + i * PIN_GAP + PIN_GAP / 2, side: 'left', def: p }; });
  by.right.forEach((p, i) => { pos[p.id] = { x: w, y: HEADER + extraTop + i * PIN_GAP + PIN_GAP / 2, side: 'right', def: p }; });
  const spread = (arr, y, side) => arr.forEach((p, i) => {
    pos[p.id] = { x: (w / (arr.length + 1)) * (i + 1), y, side, def: p };
  });
  spread(by.top, 0, 'top');
  spread(by.bottom, h, 'bottom');
  def._layout = { w, h, pos, top: extraTop };
  return def._layout;
}

const DIR = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

export function wireColor(fromPin, toPin) {
  const types = [fromPin?.type, toPin?.type];
  const fns = [...(fromPin?.functions || []), ...(toPin?.functions || [])].join(' ');
  if (types.includes('gnd')) return 'var(--wire-gnd)';
  if (types.includes('power_out') || types.includes('power_in')) return 'var(--wire-power)';
  if (types.includes('contact')) return 'var(--wire-contact)';
  if (/SDA/.test(fns)) return 'var(--wire-sda)';
  if (/SCL/.test(fns)) return 'var(--wire-scl)';
  return 'var(--wire-signal)';
}

export class WiringCanvas {
  constructor(svg, { getDefs, onChange, onSelect, onPartClick, tooltip }) {
    this.svg = svg;
    this.getDefs = getDefs;
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.onPartClick = onPartClick;
    this.tooltip = tooltip;
    this.view = { x: -40, y: -40, k: 1 };
    this.instances = [];
    this.wires = [];
    this.preview = null;
    this.sim = null;
    this.selected = null;
    this.pending = null;
    this.mouse = { x: 0, y: 0 };
    this.defsLayer = el('defs', {}, svg);
    this.defsLayer.innerHTML = `
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" style="fill:var(--grid)"/>
      </pattern>
      <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>`;
    this.root = el('g', {}, svg);
    this.bg = el('rect', { x: -5000, y: -5000, width: 10000, height: 10000, fill: 'url(#grid)' }, this.root);
    this.wireLayer = el('g', {}, this.root);
    this.partLayer = el('g', {}, this.root);
    this.overLayer = el('g', {}, this.root);
    this.bindEvents();
    this.applyView();
  }

  defOf(ref) {
    const i = this.instances.find((x) => x.ref === ref);
    return i && this.getDefs().get(i.part);
  }

  pinPos(key) {
    const [ref, pid] = splitKey(key);
    const i = this.instances.find((x) => x.ref === ref);
    const def = i && this.getDefs().get(i.part);
    if (!def) return null;
    const p = layoutPart(def).pos[pid];
    return p && { x: i.x + p.x, y: i.y + p.y, side: p.side, def: p.def };
  }

  applyView() {
    this.root.setAttribute('transform', `translate(${-this.view.x * this.view.k} ${-this.view.y * this.view.k}) scale(${this.view.k})`);
  }

  toWorld(evt) {
    const r = this.svg.getBoundingClientRect();
    return { x: (evt.clientX - r.left) / this.view.k + this.view.x, y: (evt.clientY - r.top) / this.view.k + this.view.y };
  }

  fit() {
    if (!this.instances.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const i of this.instances) {
      const def = this.getDefs().get(i.part);
      if (!def) continue;
      const { w, h } = layoutPart(def);
      x0 = Math.min(x0, i.x - 60); y0 = Math.min(y0, i.y - 40);
      x1 = Math.max(x1, i.x + w + 60); y1 = Math.max(y1, i.y + h + 40);
    }
    const r = this.svg.getBoundingClientRect();
    const k = Math.min(1.4, Math.max(0.3, Math.min(r.width / (x1 - x0), r.height / (y1 - y0))));
    this.view = { k, x: x0 - (r.width / k - (x1 - x0)) / 2, y: y0 - (r.height / k - (y1 - y0)) / 2 };
    this.applyView();
  }

  zoom(f, cx, cy) {
    const r = this.svg.getBoundingClientRect();
    cx ??= r.width / 2; cy ??= r.height / 2;
    const wx = cx / this.view.k + this.view.x;
    const wy = cy / this.view.k + this.view.y;
    this.view.k = Math.min(3, Math.max(0.25, this.view.k * f));
    this.view.x = wx - cx / this.view.k;
    this.view.y = wy - cy / this.view.k;
    this.applyView();
  }

  bindEvents() {
    let drag = null;
    this.svg.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const t = e.target.closest('[data-kind]');
      const kind = t?.dataset.kind;
      if (kind === 'pin') return;
      if (kind === 'part') {
        const ref = t.dataset.ref;
        const inst = this.instances.find((i) => i.ref === ref);
        const w = this.toWorld(e);
        drag = { type: 'part', inst, dx: w.x - inst.x, dy: w.y - inst.y, moved: false };
        return;
      }
      if (kind === 'wire') return;
      drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y, moved: false };
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse = this.toWorld(e);
      if (this.pending) this.drawOverlay();
      if (!drag) return;
      if (drag.type === 'pan') {
        this.view.x = drag.vx - (e.clientX - drag.sx) / this.view.k;
        this.view.y = drag.vy - (e.clientY - drag.sy) / this.view.k;
        drag.moved = true;
        this.applyView();
      } else {
        const w = this.toWorld(e);
        drag.inst.x = Math.round((w.x - drag.dx) / 10) * 10;
        drag.inst.y = Math.round((w.y - drag.dy) / 10) * 10;
        drag.moved = true;
        this.render();
      }
    });
    window.addEventListener('mouseup', () => {
      if (drag?.type === 'part') {
        if (drag.moved) this.onChange('move');
        else this.handlePartClick(drag.inst.ref);
      }
      if (drag?.type === 'pan' && !drag.moved) {
        this.select(null);
        this.cancelPending();
      }
      drag = null;
    });
    this.svg.addEventListener('click', (e) => {
      const t = e.target.closest('[data-kind]');
      if (!t) return;
      if (t.dataset.kind === 'pin') this.handlePinClick(t.dataset.key);
      if (t.dataset.kind === 'wire') this.select({ type: 'wire', id: t.dataset.id });
    });
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = this.svg.getBoundingClientRect();
      this.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    this.svg.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-kind]');
      if (t?.dataset.kind === 'pin') this.tooltip.showPin(t.dataset.key, e);
      else if (t?.dataset.kind === 'wire') this.tooltip.showWire(t.dataset.id, e);
      else this.tooltip.hide();
    });
    this.svg.addEventListener('mousemove', (e) => this.tooltip.move(e));
    this.svg.addEventListener('mouseleave', () => this.tooltip.hide());
  }

  handlePartClick(ref) {
    if (this.onPartClick(ref)) return;
    this.select({ type: 'part', ref });
  }

  handlePinClick(key) {
    const pos = this.pinPos(key);
    if (pos?.def.type === 'nc' && !this.pending) {
      // 사용 금지 핀도 연결은 허용한다(학생이 판정해야 하므로). 정보만 남긴다.
    }
    if (!this.pending) {
      this.pending = key;
      this.drawOverlay();
      return;
    }
    if (this.pending === key) return this.cancelPending();
    const exists = this.wires.some((w) => (w.from === this.pending && w.to === key) || (w.from === key && w.to === this.pending));
    if (!exists) {
      this.wires.push({ id: `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, from: this.pending, to: key, origin: 'user' });
      this.onChange('wire');
    }
    this.pending = null;
    this.render();
  }

  cancelPending() {
    this.pending = null;
    this.drawOverlay();
  }

  select(sel) {
    this.selected = sel;
    this.render();
    this.onSelect(sel);
  }

  deleteSelected() {
    const s = this.selected;
    if (!s) return false;
    if (s.type === 'wire') this.wires = this.wires.filter((w) => w.id !== s.id);
    if (s.type === 'part') {
      this.instances = this.instances.filter((i) => i.ref !== s.ref);
      this.wires = this.wires.filter((w) => !w.from.startsWith(s.ref + '.') && !w.to.startsWith(s.ref + '.'));
    }
    this.selected = null;
    this.onSelect(null);
    this.onChange('delete');
    this.render();
    return true;
  }

  wirePath(a, b) {
    const [dx1, dy1] = DIR[a.side] || [1, 0];
    const [dx2, dy2] = DIR[b.side] || [-1, 0];
    const d = Math.min(120, Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) / 3));
    return `M${a.x} ${a.y} C${a.x + dx1 * d} ${a.y + dy1 * d} ${b.x + dx2 * d} ${b.y + dy2 * d} ${b.x} ${b.y}`;
  }

  drawOverlay() {
    this.overLayer.replaceChildren();
    if (!this.pending) return;
    const a = this.pinPos(this.pending);
    if (!a) return;
    el('path', { d: this.wirePath(a, { ...this.mouse, side: 'none' }), class: 'wire-rubber' }, this.overLayer);
    el('circle', { cx: a.x, cy: a.y, r: 7, class: 'pin-pending' }, this.overLayer);
  }

  netColor(net) {
    if (!net) return null;
    if (net.short) return 'var(--volt-short)';
    if (net.kind === 'gnd') return 'var(--volt-gnd)';
    if (net.voltage == null) return 'var(--volt-float)';
    if (net.voltage >= 9) return 'var(--volt-high)';
    if (net.voltage >= 4.5) return 'var(--volt-5)';
    if (net.voltage >= 2.5) return 'var(--volt-3)';
    if (net.voltage > 0) return 'var(--volt-low)';
    return 'var(--volt-gnd)';
  }

  render() {
    const defs = this.getDefs();
    const power = !!this.sim;
    this.wireLayer.replaceChildren();
    this.partLayer.replaceChildren();

    // 배선: 바탕색 테두리(케이싱) 위에 실선을 그리고, 전원이 흐르면 그 위로 밝은 펄스만 움직인다.
    // 끝이 연결된 핀은 선 색으로 채워서 꽂힌 것처럼 보이게 한다.
    const pinColor = {};
    const drawWire = (w, cls) => {
      const a = this.pinPos(w.from);
      const b = this.pinPos(w.to);
      if (!a || !b) return;
      const net = power ? this.sim.netByPin[w.from] : null;
      const color = power ? this.netColor(net) : wireColor(a.def, b.def);
      const sel = this.selected?.type === 'wire' && this.selected.id === w.id;
      const d = this.wirePath(a, b);
      if (!cls) { pinColor[w.from] = color; pinColor[w.to] = color; }
      el('path', { d, class: 'wire-hit', 'data-kind': 'wire', 'data-id': w.id }, this.wireLayer);
      el('path', { d, class: `wire-casing ${cls || ''}` }, this.wireLayer);
      const p = el('path', {
        d, style: `stroke:${color}`, class: `wire ${cls || ''} ${sel ? 'selected' : ''} ${net?.short ? 'short' : ''}`,
        'data-kind': 'wire', 'data-id': w.id
      }, this.wireLayer);
      if (w.origin === 'ai') p.classList.add('ai');
      if (power && net?.voltage > 0 && !net.short && !cls) el('path', { d, class: 'wire-pulse' }, this.wireLayer);
    };
    for (const w of this.wires) drawWire(w, this.preview?.removed.has(w.id) ? 'removed' : '');
    if (this.preview) for (const w of this.preview.added) drawWire(w, 'added');

    // 부품
    const shown = [...this.instances, ...(this.preview?.addedParts || [])];
    for (const i of shown) {
      const def = defs.get(i.part);
      const isPreview = this.preview?.addedParts?.includes(i);
      const g = el('g', { transform: `translate(${i.x} ${i.y})`, 'data-kind': isPreview ? null : 'part', 'data-ref': i.ref }, this.partLayer);
      if (!def) {
        el('rect', { width: 140, height: 40, rx: 6, class: 'part-missing' }, g);
        el('text', { x: 8, y: 24, class: 'part-title dark' }, g).textContent = `${i.ref}: 없는 부품 ${i.part}`;
        continue;
      }
      const { w, h, pos, top } = layoutPart(def);
      const st = this.sim?.parts[i.ref] || {};
      const sel = this.selected?.type === 'part' && this.selected.ref === i.ref;
      const look = lookOf(def);
      const bare = BARE.has(look) && !def.imageData;
      // 맨 소자(LED·저항 등)는 캔버스 바탕 위에 그리므로 글자색을 화면 테마에 맞춘다
      const light = bare ? null : isLight(def.color);
      const tone = bare ? 'on-canvas' : light ? 'dark' : '';
      el('rect', {
        width: w, height: h, rx: 8, style: bare ? null : def.imageData ? 'fill:transparent' : `fill:${def.color || 'var(--slate-600)'}`,
        class: `part-body ${bare ? 'bare' : ''} ${sel ? 'selected' : ''} ${isPreview ? 'added' : ''}`
      }, g);
      drawArt(g, { w, h, top, pos, st, def, power });
      const title = el('text', { x: w / 2, y: (bare ? 14 : 19) + top, class: `part-title ${tone}`, 'text-anchor': 'middle' }, g);
      title.textContent = `${i.ref} · ${shortName(def.name, w)}`;
      if (i.label) el('text', { x: w / 2, y: -6, class: 'part-label', 'text-anchor': 'middle' }, g).textContent = i.label;

      this.drawBehavior(g, def, st, w, h, tone, power);
      const inset = labelInset(look);

      for (const [pid, p] of Object.entries(pos)) {
        const key = pinKey(i.ref, pid);
        const used = this.wires.some((x) => x.from === key || x.to === key);
        const net = power ? this.sim.netByPin[key] : null;
        const tx = p.side === 'left' ? 10 + inset.left : p.side === 'right' ? -10 + inset.right : 0;
        const ty = bare && (p.side === 'left' || p.side === 'right') ? 20 : p.side === 'top' ? 18 : p.side === 'bottom' ? -8 : 4;
        const anchor = p.side === 'left' ? 'start' : p.side === 'right' ? 'end' : 'middle';
        el('text', { x: p.x + tx, y: p.y + ty, 'text-anchor': anchor, class: `pin-label ${tone} ${p.def.type === 'nc' ? 'nc' : ''}` }, g).textContent = p.def.label || pid;
        // 보이는 핀은 작게, 클릭 영역은 넉넉하게 (입문자도 정확히 누를 수 있도록)
        el('circle', { cx: p.x, cy: p.y, r: 9, class: 'pin-hit', 'data-kind': 'pin', 'data-key': key }, g);
        const c = el('circle', {
          cx: p.x, cy: p.y, r: 5, class: `pin pin-${p.def.type} ${used ? 'used' : ''} ${this.pending === key ? 'pending' : ''}`
        }, g);
        if (pinColor[key]) c.style.fill = pinColor[key];
        else if (power && net) c.style.fill = this.netColor(net);
      }
    }
    this.drawOverlay();
  }

  drawBehavior(g, def, st, w, h, tone, power) {
    const b = def.behavior || {};
    const cx = w / 2;
    const cy = h - 16;
    const txt = (s, cls = '') => {
      const t = el('text', { x: cx, y: h - 8, 'text-anchor': 'middle', class: `part-state ${tone} ${cls}` }, g);
      t.textContent = s;
    };
    if (b.kind === 'led') {
      if (st.burnt) txt('⚠ 과전류로 탐', 'danger');
    } else if (b.kind === 'relay') {
      if (power) txt(st.energized ? '딸깍! COM↔NO' : st.powered ? '대기 COM↔NC' : '전원 없음', st.energized ? 'ok' : '');
      el('circle', { cx: 14, cy: h - 12, r: 4, class: st.powered ? 'indicator-power' : 'indicator-off' }, g);
    } else if (b.kind === 'load') {
      if (power) {
        const s = st.on ? `${b.label || '부하'} ${b.onText || 'ON'} (${st.voltage.toFixed(1)}V)`
          : st.reversed ? `역방향 ${st.voltage.toFixed(1)}V` : st.weak ? `전압 부족 ${st.voltage.toFixed(1)}V` : `${b.label || '부하'} ${b.offText || 'OFF'}`;
        txt(s, st.on ? 'ok' : '');
      }
      if (st.on) el('rect', { x: 36, y: 20, width: w - 44, height: h - 44, rx: 6, class: 'load-on' }, g);
    } else if (b.kind === 'i2c-device' && b.display) {
      const sx = 14, sy = 34 + layoutPart(def).top, sw = w - 28, sh = Math.max(26, h - 52 - layoutPart(def).top);
      el('rect', { x: sx, y: sy, width: sw, height: sh, rx: 3, class: 'oled-screen' }, g);
      if (st.powered && st.linked) {
        const t = el('text', { x: sx + sw / 2, y: sy + sh / 2 + 4, 'text-anchor': 'middle', class: 'oled-text' }, g);
        t.textContent = '24.5°C 51%';
      } else if (st.powered) {
        el('text', { x: sx + sw / 2, y: sy + sh / 2 + 4, 'text-anchor': 'middle', class: 'oled-text dim' }, g).textContent = '신호 없음';
      }
    } else if (b.kind === 'sensor' || b.kind === 'i2c-device') {
      el('circle', { cx: w - 14, cy: h - 12, r: 4, class: st.powered ? 'indicator-ok' : 'indicator-off' }, g);
      if (power) txt(st.powered ? (b.kind === 'i2c-device' ? (st.linked ? '통신 중' : '전원 ON') : '측정 중') : '전원 없음', st.powered ? 'ok' : '');
    } else if (b.kind === 'button') {
      if (power) txt(st.pressed ? '눌림 (클릭해 떼기)' : '클릭해 누르기');
    } else if (b.kind === 'diode') {
      if (st.shorting) txt('⚠ 단락! 과열', 'danger');
    } else if (b.kind === 'resistor') {
      txt(`${b.ohms >= 1000 ? b.ohms / 1000 + 'k' : b.ohms}Ω`);
    } else if (b.kind === 'supply' && power) {
      txt('전원 공급 중', 'ok');
    } else if (b.kind === 'board' && power) {
      el('circle', { cx: w - 14, cy: 14, r: 4, class: 'indicator-power', filter: 'url(#glow)' }, g);
    }
  }
}

function shortName(name, w) {
  const max = Math.floor((w - 40) / 7.5);
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

function isLight(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return false;
  const n = parseInt(hex.slice(1, 7), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}
