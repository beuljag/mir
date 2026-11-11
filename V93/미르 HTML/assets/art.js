// 부품 2D 그림. 핀 좌표(layoutPart)에 맞춰 코드로 그려서, 핀 개수나 크기가 바뀌어도 그림이 어긋나지 않는다.
// 부품 JSON에 "image"(SVG/PNG 파일)가 있으면 그 그림을 대신 쓴다. → docs/부품-그림-제작-안내.md

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  parent.appendChild(e);
  return e;
};
const text = (parent, x, y, s, cls, anchor = 'middle') => {
  el('text', { x, y, 'text-anchor': anchor, class: cls }, parent).textContent = s;
};

// 그림 종류 고르기: JSON의 "look"이 있으면 우선, 없으면 behavior와 id로 추정
export function lookOf(def) {
  if (def.look) return def.look;
  const kind = def.behavior?.kind;
  const id = def.id;
  if (kind === 'board') return /raspberry|rpi/.test(id) ? 'rpi' : /esp32/.test(id) ? 'esp32' : 'board';
  if (kind === 'led' || kind === 'resistor' || kind === 'diode' || kind === 'button' || kind === 'relay') return kind;
  if (kind === 'load') return 'valve';
  if (kind === 'supply') return 'adapter';
  if (kind === 'i2c-device') return def.behavior.display ? 'oled' : 'chip-module';
  if (kind === 'sensor') return /dht/.test(id) ? 'dht' : 'module';
  return 'module';
}

// 몸체 상자 없이 부품만 그리는 종류 (LED, 저항처럼 PCB가 없는 소자)
export const BARE = new Set(['led', 'resistor', 'diode', 'button', 'valve', 'adapter']);

export function isBareArt(def) {
  return Array.isArray(def.imageNodes) ? def.imagePresentation?.kind === 'bare' : BARE.has(lookOf(def)) && !def.imageData;
}

// 핀 이름표를 안쪽으로 얼마나 더 밀지 (단자대 같은 그림과 겹치지 않게)
export function labelInset(look) {
  return look === 'relay' ? { left: 0, right: -20 } : { left: 0, right: 0 };
}

/**
 * @returns {void}
 * ctx: { w, h, top, pos, st, def }
 */
export function drawArt(g, ctx) {
  const { def } = ctx;
  if (Array.isArray(def.imageNodes) && drawGeneratedArt(g, ctx)) return;
  if (def.imageData) return drawImage(g, ctx);
  const look = lookOf(def);
  const art = el('g', { class: `art art-${look}` }, g);
  (DRAW[look] || DRAW.module)(art, ctx);
}

const GENERATED_TAGS = new Set(['g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text']);
const GENERATED_ATTRS = new Set(['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2',
  'points', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity',
  'stroke-opacity', 'transform', 'fill-rule', 'class', 'text-anchor', 'font-family', 'font-size', 'font-weight']);

function drawGeneratedArt(g, ctx) {
  const { def, st = {}, power = false } = ctx;
  let count = 0;
  const valid = (node, depth = 0) => {
    if (++count > 1200 || depth > 36 || !GENERATED_TAGS.has(node?.tag) || !Array.isArray(node.children)) return false;
    if (typeof node.text !== 'string' || (node.tag === 'text' ? node.text.length > 80 || node.children.length : node.text.trim())) return false;
    for (const [key, value] of Object.entries(node.attrs || {})) {
      if (!GENERATED_ATTRS.has(key) || typeof value !== 'string' || value.length > 40000 || /[<>]|url\s*\(|javascript:|https?:/i.test(value)) return false;
    }
    return node.children.every((child) => valid(child, depth + 1));
  };
  if (!def.imageNodes.every((node) => valid(node))) return false;
  const art = el('g', { class: 'art art-generated' }, g);
  const active = power && !!(st.on || st.lit || st.energized || st.pressed);
  const powered = power && !!(st.powered || st.on || st.lit || st.energized);
  let band = 0;
  const bands = Number.isFinite(def.behavior?.ohms) && def.behavior.ohms > 0 ? resistorBands(def.behavior.ohms) : null;
  const append = (node, parent) => {
    const attrs = { ...node.attrs };
    const classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
    if ((classes.has('state-on') && !active) || (classes.has('state-off') && active)
      || (classes.has('state-powered') && !powered) || (classes.has('state-unpowered') && powered)) return;
    if (classes.has('led-dome') && power && st.lit) classes.add('lit');
    if (classes.has('pipe') && power && st.on) classes.add('flow');
    if (classes.has('tact-cap') && st.pressed) classes.add('pressed');
    if (classes.has('resistor-band') && bands && band < 4) {
      for (const cls of classes) if (cls.startsWith('band-')) classes.delete(cls);
      classes.add('band-' + bands[band++]);
    }
    if (classes.size) attrs.class = [...classes].join(' ');
    const element = el(node.tag, attrs, parent);
    if (node.tag === 'text') element.textContent = node.text;
    for (const child of node.children) append(child, element);
  };
  for (const node of def.imageNodes) append(node, art);
  return true;
}

function drawImage(g, { w, h, def }) {
  el('image', { href: def.imageData, x: 0, y: 0, width: w, height: h, preserveAspectRatio: def.imageFit || 'none', class: 'art-image' }, g);
}

// ---------- 공통 조각 ----------
function pcbDetails(g, { w, h }) {
  el('rect', { x: 4, y: 4, width: w - 8, height: h - 8, rx: 5, class: 'silk' }, g);
  for (const [x, y] of [[9, 9], [w - 9, 9], [9, h - 9], [w - 9, h - 9]]) el('circle', { cx: x, cy: y, r: 3, class: 'hole' }, g);
}

function pads(g, { pos }) {
  for (const p of Object.values(pos)) el('rect', { x: p.x - 5, y: p.y - 5, width: 10, height: 10, rx: 2, class: 'pad' }, g);
}

function headerStrip(g, { pos, h }, side, x) {
  const ys = Object.values(pos).filter((p) => p.side === side).map((p) => p.y);
  if (!ys.length) return;
  el('rect', { x, y: Math.min(...ys) - 9, width: 12, height: Math.max(...ys) - Math.min(...ys) + 18, rx: 2, class: 'header' }, g);
}

function lead(g, x1, y1, x2, y2) {
  el('line', { x1, y1, x2, y2, class: 'lead' }, g);
}

// 2핀 소자: 왼쪽 핀 → 몸체 → 오른쪽 핀을 다리로 잇는다
function twoLeads(g, { pos, w }, bodyHalf) {
  const ps = Object.values(pos);
  const y = ps[0]?.y ?? 39;
  lead(g, 0, y, w / 2 - bodyHalf, y);
  lead(g, w / 2 + bodyHalf, y, w, y);
  return y;
}

const BAND = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'gray', 'white'];
function resistorBands(ohms) {
  let exp = 0;
  let v = Math.round(ohms);
  while (v >= 100) { v = Math.round(v / 10); exp++; }
  const digits = String(v).padStart(2, '0');
  return [BAND[+digits[0]], BAND[+digits[1]], BAND[exp] || 'black', 'gold'];
}

// ---------- 부품별 그림 ----------
const DRAW = {
  esp32(g, ctx) {
    const { w, h } = ctx;
    pcbDetails(g, ctx);
    headerStrip(g, ctx, 'left', -6);
    headerStrip(g, ctx, 'right', w - 6);
    pads(g, ctx);
    // 안테나 + 금속 실드 모듈
    const mx = 54, mw = w - 108;
    el('rect', { x: mx, y: 30, width: mw, height: 140, rx: 3, class: 'module-pcb' }, g);
    el('path', { d: `M${mx + 8} 40 h${mw - 16} v8 h-${mw - 24} v8 h${mw - 24} v8 h-${mw - 16}`, class: 'antenna' }, g);
    el('rect', { x: mx + 4, y: 72, width: mw - 8, height: 92, rx: 2, class: 'shield' }, g);
    text(g, w / 2, 112, 'ESP32', 'art-text strong dark');
    text(g, w / 2, 126, 'WROOM-32', 'art-text dark');
    // 레귤레이터, 버튼, USB
    el('rect', { x: w / 2 - 12, y: h - 120, width: 24, height: 16, rx: 1, class: 'ic' }, g);
    for (const [x, label] of [[mx + 6, 'EN'], [w - mx - 22, 'BOOT']]) {
      el('rect', { x, y: h - 70, width: 16, height: 16, rx: 2, class: 'tact' }, g);
      el('circle', { cx: x + 8, cy: h - 62, r: 4, class: 'tact-cap' }, g);
      text(g, x + 8, h - 46, label, 'art-text tiny');
    }
    el('rect', { x: w / 2 - 14, y: h - 18, width: 28, height: 22, rx: 3, class: 'metal' }, g);
    el('rect', { x: w / 2 - 9, y: h - 4, width: 18, height: 5, rx: 1, class: 'metal-dark' }, g);
  },

  rpi(g, ctx) {
    const { w, h } = ctx;
    pcbDetails(g, ctx);
    headerStrip(g, ctx, 'left', -6);
    headerStrip(g, ctx, 'right', w - 6);
    pads(g, ctx);
    const cx = w / 2;
    el('rect', { x: cx - 26, y: 70, width: 52, height: 52, rx: 3, class: 'metal' }, g);
    text(g, cx, 100, 'BCM2711', 'art-text dark tiny');
    el('rect', { x: cx - 22, y: 140, width: 44, height: 30, rx: 2, class: 'ic' }, g);
    text(g, cx, 159, 'RAM', 'art-text tiny');
    text(g, cx, 210, 'Raspberry Pi 4', 'art-text');
    // 아래쪽 USB·LAN 포트
    const portY = h - 70;
    for (let k = 0; k < 3; k++) el('rect', { x: cx - 30, y: portY - k * 46, width: 60, height: 38, rx: 2, class: k === 0 ? 'metal' : 'metal-dark' }, g);
    text(g, cx, portY + 23, 'LAN', 'art-text dark tiny');
    text(g, cx, portY - 23, 'USB', 'art-text tiny');
    text(g, cx, portY - 69, 'USB', 'art-text tiny');
  },

  board(g, ctx) {
    const { w, h } = ctx;
    pcbDetails(g, ctx);
    pads(g, ctx);
    el('rect', { x: w / 2 - 22, y: h / 2 - 22, width: 44, height: 44, rx: 2, class: 'ic' }, g);
  },

  module(g, ctx) {
    const { w, h } = ctx;
    pcbDetails(g, ctx);
    pads(g, ctx);
    el('rect', { x: w / 2 - 10, y: h / 2 - 2, width: 28, height: 18, rx: 2, class: 'ic' }, g);
  },

  'chip-module'(g, ctx) {
    const { w, h, top } = ctx;
    pcbDetails(g, ctx);
    pads(g, ctx);
    const cx = w / 2 + 16, cy = top + 30 + (h - top - 30) / 2 - 6;
    el('rect', { x: cx - 12, y: cy - 12, width: 24, height: 24, rx: 2, class: 'metal' }, g);
    el('circle', { cx: cx + 6, cy: cy - 6, r: 2, class: 'hole' }, g);
    text(g, cx, cy + 26, def(ctx).name.split(' ')[0], 'art-text tiny');
  },

  oled(g, ctx) {
    pcbDetails(g, ctx);
    pads(g, ctx);
  },

  dht(g, ctx) {
    const { w, h } = ctx;
    pcbDetails(g, ctx);
    pads(g, ctx);
    // 흰 플라스틱 하우징과 격자 구멍
    const x = 56, y = 26, hw = w - 70, hh = h - 44;
    el('rect', { x, y, width: hw, height: hh, rx: 4, class: 'housing' }, g);
    for (let gy = y + 8; gy < y + hh - 6; gy += 7) {
      for (let gx = x + 8; gx < x + hw - 6; gx += 9) el('rect', { x: gx, y: gy, width: 5, height: 3, rx: 1, class: 'grille' }, g);
    }
  },

  relay(g, ctx) {
    const { w, h } = ctx;
    pcbDetails(g, ctx);
    pads(g, ctx);
    // 파란 릴레이 상자
    el('rect', { x: 60, y: 30, width: w - 108, height: h - 44, rx: 3, class: 'relay-box' }, g);
    text(g, 60 + (w - 108) / 2, h / 2 + 4, 'SRD-05VDC', 'art-text tiny');
    // 오른쪽 나사 단자대
    const ys = Object.values(ctx.pos).filter((p) => p.side === 'right').map((p) => p.y);
    if (ys.length) {
      el('rect', { x: w - 22, y: Math.min(...ys) - 9, width: 20, height: Math.max(...ys) - Math.min(...ys) + 18, rx: 2, class: 'terminal' }, g);
      for (const y of ys) {
        el('circle', { cx: w - 12, cy: y, r: 5, class: 'screw' }, g);
        el('line', { x1: w - 15, y1: y - 3, x2: w - 9, y2: y + 3, class: 'screw-slot' }, g);
      }
    }
  },

  led(g, ctx) {
    const { w, st } = ctx;
    const y = twoLeads(g, ctx, 12);
    const color = def(ctx).behavior?.color;
    el('path', { d: `M${w / 2 - 12} ${y + 8} v-10 a12 12 0 0 1 24 0 v10 z`, class: `led-dome ${st.lit ? 'lit' : ''}`, style: color ? `--led:${color}` : null, filter: st.lit ? 'url(#glow)' : null }, g);
    el('rect', { x: w / 2 - 14, y: y + 8, width: 28, height: 4, rx: 1, class: `led-dome rim ${st.lit ? 'lit' : ''}`, style: color ? `--led:${color}` : null }, g);
  },

  resistor(g, ctx) {
    const { w } = ctx;
    const y = twoLeads(g, ctx, 22);
    el('rect', { x: w / 2 - 22, y: y - 7, width: 44, height: 14, rx: 7, class: 'resistor-body' }, g);
    resistorBands(def(ctx).behavior?.ohms || 0).forEach((c, k) => {
      el('rect', { x: w / 2 - 14 + k * 8 + (k === 3 ? 4 : 0), y: y - 7, width: 4, height: 14, class: `band band-${c}` }, g);
    });
  },

  diode(g, ctx) {
    const { w } = ctx;
    const y = twoLeads(g, ctx, 18);
    el('rect', { x: w / 2 - 18, y: y - 6, width: 36, height: 12, rx: 3, class: 'diode-body' }, g);
    el('rect', { x: w / 2 + 8, y: y - 6, width: 5, height: 12, class: 'diode-band' }, g);
  },

  button(g, ctx) {
    const { w, st } = ctx;
    const y = twoLeads(g, ctx, 14);
    el('rect', { x: w / 2 - 14, y: y - 14, width: 28, height: 28, rx: 3, class: 'tact' }, g);
    el('circle', { cx: w / 2, cy: y, r: 8, class: `tact-cap ${st.pressed ? 'pressed' : ''}` }, g);
  },

  valve(g, ctx) {
    const { w, h, pos, st } = ctx;
    // 전선 두 가닥 → 코일
    const ps = Object.values(pos);
    const cx = 44, cw = w - 64;
    ps.forEach((p, k) => el('path', { d: `M0 ${p.y} C24 ${p.y} 24 ${40 + k * 10} ${cx} ${40 + k * 10}`, class: `cable ${k === 0 ? 'cable-red' : 'cable-black'}` }, g));
    el('rect', { x: cx, y: 24, width: cw, height: h - 72, rx: 4, class: 'coil' }, g);
    el('rect', { x: cx, y: 30, width: cw, height: 4, class: 'coil-band' }, g);
    text(g, cx + cw / 2, 24 + (h - 72) / 2 + 6, 'DC 12V', 'art-text tiny');
    // 황동 밸브 몸체와 배관
    el('rect', { x: cx - 8, y: h - 48, width: cw + 16, height: 16, rx: 2, class: 'brass' }, g);
    el('rect', { x: cx + cw + 8, y: h - 45, width: 12, height: 10, class: `pipe ${st.on ? 'flow' : ''}` }, g);
  },

  adapter(g, ctx) {
    const { w, h, pos } = ctx;
    const ps = Object.values(pos);
    const bx = 46, bw = w - 56;
    ps.forEach((p, k) => el('path', { d: `M0 ${p.y} C22 ${p.y} 22 ${h / 2 + (k - 0.5) * 8} ${bx} ${h / 2 + (k - 0.5) * 8}`, class: `cable ${k === 0 ? 'cable-red' : 'cable-black'}` }, g));
    el('rect', { x: bx, y: 24, width: bw, height: h - 48, rx: 6, class: 'brick' }, g);
    text(g, bx + bw / 2, 24 + (h - 48) / 2 + 3, '12V ⎓ 2A', 'art-text');
    el('circle', { cx: bx + bw - 10, cy: 36, r: 3, class: ctx.power ? 'indicator-ok' : 'indicator-off' }, g);
  }
};

const def = (ctx) => ctx.def;
