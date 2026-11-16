import { confirmAction } from './confirm-dialog.js';
// 2D 가상 실습 화면 (SVG). 부품 배치, 배선 그리기/삭제, 핀 정보, 가상 전원 표시를 담당한다.
import { pinKey, splitKey } from './sim.js';
import { drawArt, lookOf, BARE, isBareArt, labelInset } from './art.js';
import { routeWire, routeWires, pointsToPath, softAlignedPath } from './wire-router.js';
import { defFor } from './props.js';

function selectionBounds(start, end) {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

const NS = 'http://www.w3.org/2000/svg';
const PIN_GAP = 18;
const HEADER = 30;
const PAD = 10;
const PART_GAP = 64;

function pinCaption(pin, limit = 18) {
  const label = pin.label || pin.id;
  const name = label.split(/\s+\(/, 1)[0] || label;
  return name.length > limit ? name.slice(0, limit - 1) + '…' : name;
}

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
  const maxLabel = (arr) => Math.max(0, ...arr.map((p) => pinCaption(p).length));
  const sideW = Math.max(maxLabel(by.left), maxLabel(by.right)) * 7 + 14;
  const titleW = Math.min(def.name.length, 32) * 7.5 + 64;
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

export function rotationDegrees(angle = 0) {
  return ((angle % 360) + 360) % 360;
}

function partGeometry(instance, def) {
  const { w, h } = def ? layoutPart(def) : { w: 140, h: 40 };
  const angle = rotationDegrees(instance.rotation);
  const radians = angle * Math.PI / 180;
  const cos = Math.round(Math.cos(radians) * 1e12) / 1e12;
  const sin = Math.round(Math.sin(radians) * 1e12) / 1e12;
  return { w, h, angle, cos, sin };
}

export function partBounds(instance, def) {
  const { w, h, cos, sin } = partGeometry(instance, def);
  const width = Math.abs(w * cos) + Math.abs(h * sin);
  const height = Math.abs(w * sin) + Math.abs(h * cos);
  return { x: instance.x + (w - width) / 2, y: instance.y + (h - height) / 2, w: width, h: height };
}

const pinSides = ['right', 'bottom', 'left', 'top'];

// Keep placed parts anchored and move only incoming parts that collide.
export function separateParts(instances, defs, anchored = [], { gap = PART_GAP, preservePlaced = false } = {}) {
  const bounds = (i) => partBounds(i, defFor(defs, i));
  const occupied = anchored.map(bounds);
  const overlaps = (a, b) =>
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap &&
    a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
  const boxes = instances.map(bounds);
  for (const [index, instance] of instances.entries()) {
    const box = boxes[index];
    if (!occupied.some((part) => overlaps(box, part))) {
      occupied.push(box);
      continue;
    }
    const obstacles = preservePlaced ? occupied.concat(boxes.slice(index + 1)) : occupied;
    const clearAlong = (axis, size) => {
      const candidate = { ...box };
      let blockers = obstacles.filter((part) => overlaps(candidate, part));
      while (blockers.length) {
        candidate[axis] = Math.max(...blockers.map((part) => part[axis] + part[size] + gap));
        blockers = obstacles.filter((part) => overlaps(candidate, part));
      }
      return candidate[axis];
    };
    const right = clearAlong('x', 'w');
    const down = clearAlong('y', 'h');
    if (right - box.x < down - box.y) {
      instance.x += right - box.x;
      box.x = right;
    } else {
      instance.y += down - box.y;
      box.y = down;
    }
    occupied.push(box);
  }
}

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
  constructor(svg, { getDefs, onChange, onSelect, onPartClick, onPartDoubleClick, tooltip }) {
    this.svg = svg;
    this.getDefs = getDefs;
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.onPartClick = onPartClick;
    this.onPartDoubleClick = onPartDoubleClick;
    this.tooltip = tooltip;
    this.view = { x: -40, y: -40, k: 1 };
    this.instances = [];
    this.wires = [];
    this.preview = null;
    this.sim = null;
    this.selected = null;
    this.pending = null;
    this.mouse = { x: 0, y: 0 };
    this.routeCacheKey = null;
    this.wireStyle = "curve";
    this.routingPaths = new Map();
    this.routingObstacles = [];
    this.routeWarnings = new Set();
    this.drawnParts = new Map();
    this.drawnWires = new Map();
    this.drawnInstances = new Map();
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
    return i && defFor(this.getDefs(), i);
  }

  pinPos(key, instances = this.instances) {
    const [ref, pid] = splitKey(key);
    const i = instances instanceof Map ? instances.get(ref) : instances.find(x => x.ref === ref);
    const def = i && defFor(this.getDefs(), i);
    if (!def) return null;
    const p = layoutPart(def).pos[pid];
    if (!p) return null;
    const { w, h, angle, cos, sin } = partGeometry(i, def);
    const dx = (p.x - w / 2) * (i.mirrored ? -1 : 1), dy = p.y - h / 2;
    const originalSide = pinSides.indexOf(p.side);
    const sideIndex = i.mirrored && originalSide >= 0 && originalSide % 2 === 0
      ? (originalSide + 2) % 4 : originalSide;
    const side = sideIndex < 0 ? p.side : pinSides[(sideIndex + Math.round(angle / 90)) % 4];
    return { x: i.x + w / 2 + dx * cos - dy * sin, y: i.y + h / 2 + dx * sin + dy * cos,
      side, owner: ref, def: p.def };
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
      const def = defFor(this.getDefs(), i);
      if (!def) continue;
      const { x, y, w, h } = partBounds(i, def);
      x0 = Math.min(x0, x - 60); y0 = Math.min(y0, y - 40);
      x1 = Math.max(x1, x + w + 60); y1 = Math.max(y1, y + h + 40);
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
    let dragFrame = null;
    let lastPartClick = null;
    let armedMarquee = false;
    this.svg.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const target = e.target.closest('[data-kind]');
      const kind = target?.dataset.kind;
      const selectArea = !kind && (e.shiftKey || e.detail === 2 || armedMarquee);
      armedMarquee = false;
      if (kind !== 'part') lastPartClick = null;
      if (kind === 'pin' || kind === 'wire') return;
      if (kind === 'part') {
        const ref = target.dataset.ref;
        const inst = this.instances.find((i) => i.ref === ref);
        if (!inst) return;
        const group = this.selected?.type === 'group' && this.selected.refs.has(ref);
        const members = group ? this.instances.filter(i => this.selected.refs.has(i.ref)) : [inst];
        this.draggingPart = ref;
        drag = { type: 'part', inst, sx: e.clientX, sy: e.clientY,
          members: members.map(i => ({ inst: i, x: i.x, y: i.y })), moved: false, snapX: 0, snapY: 0 };
      } else if (selectArea) {
        this.cancelPending();
        const start = this.toWorld(e);
        const rect = el('rect', { class: 'part-marquee' }, this.overLayer);
        drag = { type: 'marquee', start, end: start, rect, armedByDoubleClick: e.detail === 2, moved: false };
        this.svg.classList.add('selecting-area');
      } else {
        drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y, moved: false };
      }
    });
    const placeDragMembers = (moving) => {
      for (const member of moving.members) {
        member.inst.x = member.x + moving.snapX;
        member.inst.y = member.y + moving.snapY;
      }
    };
    window.addEventListener('mousemove', (e) => {
      if (!drag || drag.type === 'marquee' || this.pending) this.mouse = this.toWorld(e);
      if (this.pending && drag?.type !== 'part') this.drawOverlay();
      if (!drag) return;
      if (e.buttons === 0) { finishDrag(true); return; }
      if (drag.type === 'marquee') {
        drag.end = this.mouse;
        const { x, y, width, height } = selectionBounds(drag.start, drag.end);
        for (const [key, value] of Object.entries({ x, y, width, height })) drag.rect.setAttribute(key, value);
        drag.moved ||= Math.max(width, height) * this.view.k >= 4;
        return;
      }
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      drag.moved ||= Math.hypot(dx, dy) >= 4;
      if (!drag.moved) return;
      if (drag.type === 'pan') {
        this.view.x = drag.vx - dx / this.view.k;
        this.view.y = drag.vy - dy / this.view.k;
        this.svg.classList.add('panning');
        this.applyView();
        return;
      }
      const snapX = Math.round(dx / this.view.k / 10) * 10;
      const snapY = Math.round(dy / this.view.k / 10) * 10;
      if (snapX === drag.snapX && snapY === drag.snapY && !this.pending) return;
      drag.snapX = snapX;
      drag.snapY = snapY;
      if (!this.svg.classList.contains('part-drag-active')) {
        this.svg.classList.add('part-drag-active');
        this.tooltip.hide();
      }
      if (dragFrame === null) {
        dragFrame = requestAnimationFrame(() => {
          dragFrame = null;
          placeDragMembers(drag);
          this.renderDrag(drag.members);
        });
      }
    });
    const finishDrag = (interrupted = false) => {
      if (dragFrame !== null) { cancelAnimationFrame(dragFrame); dragFrame = null; }
      const finished = drag;
      drag = null;
      this.draggingPart = null;
      if (interrupted) { armedMarquee = false; lastPartClick = null; }
      if (!finished) return;
      this.svg.classList.remove('panning', 'selecting-area', 'part-drag-active');
      if (finished.type === 'part') {
        if (finished.moved) {
          placeDragMembers(finished);
          lastPartClick = null;
          this.onChange('move');
        } else if (!interrupted) {
          const ref = finished.inst.ref, now = performance.now();
          const repeat = lastPartClick?.inst === finished.inst && now - lastPartClick.time < 450 &&
            Math.hypot(finished.sx - lastPartClick.x, finished.sy - lastPartClick.y) < 6;
          lastPartClick = repeat ? null : { inst: finished.inst, time: now, x: finished.sx, y: finished.sy };
          if (repeat && this.onPartDoubleClick) this.onPartDoubleClick(ref);
          else this.handlePartClick(ref);
        }
      } else if (finished.type === 'marquee') {
        finished.rect.remove();
        if (interrupted) return;
        if (!finished.moved) {
          armedMarquee = finished.armedByDoubleClick;
          return;
        }
        const box = selectionBounds(finished.start, finished.end);
        const refs = new Set();
        for (const inst of this.instances) {
          const def = defFor(this.getDefs(), inst);
          const { x, y, w, h } = partBounds(inst, def);
          if (x < box.x + box.width && x + w > box.x && y < box.y + box.height && y + h > box.y) refs.add(inst.ref);
        }
        this.select(refs.size === 1 ? { type: 'part', ref: [...refs][0] } : refs.size ? { type: 'group', refs } : null);
      } else if (!finished.moved && !interrupted) {
        this.cancelPending();
        this.select(null);
      }
    };
    window.addEventListener('mouseup', (e) => { if (e.button === 0) finishDrag(); });
    window.addEventListener('blur', () => finishDrag(true));
    window.addEventListener('pointercancel', () => finishDrag(true));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') armedMarquee = false; });
    this.svg.addEventListener('click', (e) => {
      const target = e.target.closest('[data-kind]');
      if (target?.dataset.kind === 'pin') this.handlePinClick(target.dataset.key);
      if (target?.dataset.kind === 'wire') this.select({ type: 'wire', id: target.dataset.id });
    });
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = this.svg.getBoundingClientRect();
      this.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    this.svg.addEventListener('mouseover', (e) => {
      if (this.svg.classList.contains('part-drag-active')) return;
      const t = e.target.closest('[data-kind]');
      if (t?.dataset.kind === 'pin') this.tooltip.showPin(t.dataset.key, e);
      else if (t?.dataset.kind === 'wire') this.tooltip.showWire(t.dataset.id, e);
      else if (t?.dataset.kind === 'part') this.tooltip.showPart(t.dataset.ref,e);
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
      this.wires.push({ id: `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, from: this.pending, to: key, origin: 'user', ...(this.selectedWireKind ? {kind:this.selectedWireKind} : {}) });
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

  async deleteSelected() {
    const s = this.selected;
    if (!s) return false;
    const refs = s.type === 'group' ? s.refs : new Set(s.type === 'part' ? [s.ref] : []);
    const message = refs.size
      ? `선택한 부품 ${refs.size}개와 연결된 선을 삭제할까요?`
      : '선택한 선을 삭제할까요?';
    if (!await confirmAction(message, { defaultAction: refs.size ? 'accept' : 'cancel' }) || this.selected !== s) return false;
    if (s.type === 'wire') this.wires = this.wires.filter(w => w.id !== s.id);
    if (refs.size) {
      this.instances = this.instances.filter(inst => !refs.has(inst.ref));
      this.wires = this.wires.filter(w => !refs.has(splitKey(w.from)[0]) && !refs.has(splitKey(w.to)[0]));
    }
    this.selected = null;
    this.onSelect(null);
    this.onChange('delete');
    this.render();
    return true;
  }

  wirePath(a, b) {
    if (this.wireStyle === 'curve') {
      // Preserve upstream's flexible lead shape, rather than rounding an orthogonal route.
      const dirs={left:[-1,0],right:[1,0],top:[0,-1],bottom:[0,1]};
      const [dx1,dy1]=dirs[a.side]||[1,0], [dx2,dy2]=dirs[b.side]||[-1,0];
      const d=Math.min(120,Math.hypot(b.x-a.x,b.y-a.y)/3);
      return `M${a.x} ${a.y} C${a.x+dx1*d} ${a.y+dy1*d} ${b.x+dx2*d} ${b.y+dy2*d} ${b.x} ${b.y}`;
    }
    if (this.draggingPart) return 'M' + a.x + ' ' + a.y + ' L' + b.x + ' ' + b.y;
    const gentle=softAlignedPath(a,b,this.routingObstacles);
    if(gentle)return gentle;
    const result = routeWire(a, b, this.routingObstacles, [], { maxVisited: 2000 });
    return pointsToPath(result.points, this.wireStyle === "curve" ? 10 : 5, this.wireStyle === "curve");
  }

  shadeOverlappingWires() {
    const paths=[...this.wireLayer.querySelectorAll('.wire')].sort((a,b)=>a.dataset.id.localeCompare(b.dataset.id));
    const cells=new Map();let rank=0;
    for(const path of paths){
      const length=path.getTotalLength(),samples=[],step=Math.max(3,length/500),trim=Math.min(8,length*.1);
      for(let t=trim;t<length-trim;t+=step){
        const p=path.getPointAtLength(t),before=path.getPointAtLength(Math.max(0,t-1)),after=path.getPointAtLength(Math.min(length,t+1));
        const dx=after.x-before.x,dy=after.y-before.y,n=Math.hypot(dx,dy)||1;
        const s={p,t,x:Math.floor(p.x/4),y:Math.floor(p.y/4),dx:dx/n,dy:dy/n,overlap:false};
        for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(const q of cells.get(`${s.x+x},${s.y+y}`)||[]){
          if(Math.hypot(p.x-q.p.x,p.y-q.p.y)<3 && Math.abs(s.dx*q.dx+s.dy*q.dy)>.95)s.overlap=true;
        }
        samples.push(s);
      }
      let run=[];
      const flush=()=>{
        if(run.length>=3 && run.at(-1).t-run[0].t>=8){
          const points=run.map(s=>s.p),d=points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');
          const overlay=el('path',{d,class:'wire-overlap-shade',style:`stroke:${path.style.stroke};filter:brightness(${rank%2 ? .82 : 1.18})`},path.parentNode);
          overlay.dataset.wireId=path.dataset.id;path.dataset.overlap='true';rank++;
        }
        run=[];
      };
      for(const s of samples){if(s.overlap)run.push(s);else flush();}flush();
      for(const s of samples){const key=`${s.x},${s.y}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);}
    }
  }

  updateRoutes(instances, wires) {
    const defs = this.getDefs();
    const obstacles = instances.map(i => {
      const { x, y, w, h } = partBounds(i, defFor(defs, i));
      return { id: i.ref, x, y, width: w, height: h };
    });
    const connections = wires.flatMap(w => {
      const start = this.pinPos(w.from, instances), end = this.pinPos(w.to, instances);
      if (!start || !end) return [];
      const point = p => ({ x: p.x, y: p.y, side: p.side, owner: p.owner });
      return [{ id: w.id, start: point(start), end: point(end) }];
    });
    const key = JSON.stringify([obstacles, connections, this.wireStyle]);
    if (key === this.routeCacheKey) return;
    this.routingObstacles = obstacles;
    this.routingPaths = routeWires(connections, obstacles);
    this.routeWarnings = new Set();
    for (const [id, route] of this.routingPaths) {
      route.path = pointsToPath(route.points, this.wireStyle === "curve" ? 10 : 5, this.wireStyle === "curve");
      if(this.wireStyle==='straight') {
        const connection=connections.find(w=>w.id===id);
        if(connection){const gentle=softAlignedPath(connection.start,connection.end,obstacles);if(gentle){route.path=gentle;route.blocked=false;}}
      }
      if (route.blocked) this.routeWarnings.add(id);
    }
    this.routeCacheKey = key;
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

  renderDrag(members) {
    // Keep the SVG art and unrelated routes intact until the drag ends.
    const movingWires = new Set();
    for (const { inst } of members) {
      const part = this.drawnParts.get(inst);
      if (part) part.group.setAttribute('transform', 'translate(' + inst.x + ' ' + inst.y + ')' + part.suffix);
      for (const wire of this.drawnWires.get(inst.ref) || []) movingWires.add(wire);
    }
    const pins = new Map();
    const pin = key => {
      if (!pins.has(key)) pins.set(key, this.pinPos(key, this.drawnInstances));
      return pins.get(key);
    };
    for (const { from, to, paths } of movingWires) {
      const start = pin(from), end = pin(to);
      if (!start || !end) continue;
      const path = this.wirePath(start, end);
      for (const node of paths) node.setAttribute('d', path);
    }
    if (this.pending) this.drawOverlay();
  }

  render() {
    const defs = this.getDefs();
    const power = !!this.sim;
    this.wireLayer.replaceChildren();
    this.partLayer.replaceChildren();
    const shown = [...this.instances, ...(this.preview?.addedParts || [])];
    this.drawnParts.clear();
    this.drawnWires.clear();
    this.drawnInstances = new Map(shown.map(instance => [instance.ref, instance]));
    const usedPins = new Set(this.wires.flatMap(wire => [wire.from, wire.to]));
    if(!this.draggingPart)this.updateRoutes(shown, [...this.wires, ...(this.preview?.added || [])]);

    // 배선: 바탕색 테두리(케이싱) 위에 실선을 그리고, 전원이 흐르면 그 위로 밝은 펄스만 움직인다.
    // 끝이 연결된 핀은 선 색으로 채워서 꽂힌 것처럼 보이게 한다.
    const pinColor = {};
    const drawWire = (w, cls) => {
      const a = this.pinPos(w.from, this.drawnInstances);
      const b = this.pinPos(w.to, this.drawnInstances);
      if (!a || !b) return;
      const net = power ? this.sim.netByPin[w.from] : null;
      const chosen = ['power','gnd','sda','scl','signal','contact'].includes(w.kind) ? `var(--wire-${w.kind})` : null;
      const color = power ? this.netColor(net) : chosen || wireColor(a.def, b.def);
      const sel = this.selected?.type === 'wire' && this.selected.id === w.id;
      const route = this.routingPaths.get(w.id);
      const d = this.draggingPart || this.wireStyle === "curve" ? this.wirePath(a,b) : route?.path || this.wirePath(a, b);
      const focus = this.selected?.type === 'part' ? this.selected.ref : null;
      const dim = focus && !this.preview && !net?.short &&
        splitKey(w.from)[0] !== focus && splitKey(w.to)[0] !== focus;
      const layer = dim ? el('g', { opacity: 0.2 }, this.wireLayer) : this.wireLayer;
      if (!cls) { pinColor[w.from] = color; pinColor[w.to] = color; }
      const hit = el('path', { d, class: 'wire-hit', 'data-kind': 'wire', 'data-id': w.id }, layer);
      const casing = el('path', { d, class: 'wire-casing ' + (cls || ''), 'data-wire-id':w.id }, layer);
      const p = el('path', {
        d, style: `stroke:${color}`, class: `wire ${cls || ''} ${sel ? 'selected' : ''} ${net?.short ? 'short' : ''} ${this.wireStyle !== 'curve' && route?.blocked ? 'routing-blocked' : ''}`,
        'data-kind': 'wire', 'data-id': w.id
      }, layer);
      if (this.wireStyle !== 'curve' && route?.blocked) el('title', {}, p).textContent = '부품이 겹치거나 핀 주변 여백이 부족합니다. 부품을 조금 떨어뜨려 주세요.';
      if (w.origin === 'ai') p.classList.add('ai');
      const paths = [hit, casing, p];
      if (power && net?.voltage > 0 && !net.short && !cls) paths.push(el('path', { d, class: 'wire-pulse' }, layer));
      const record = { from: w.from, to: w.to, paths };
      for (const ref of new Set([a.owner, b.owner])) {
        if (!this.drawnWires.has(ref)) this.drawnWires.set(ref, []);
        this.drawnWires.get(ref).push(record);
      }
    };
    for (const w of this.wires) drawWire(w, this.preview?.removed.has(w.id) ? 'removed' : '');
    if (this.preview) for (const w of this.preview.added) drawWire(w, 'added');

    if(!this.draggingPart)this.shadeOverlappingWires();

    // 부품
    for (const i of shown) {
      const def = defFor(defs, i);
      const isPreview = this.preview?.addedParts?.includes(i);
      const { angle, w: width, h: height } = partGeometry(i, def);
      const rotation = angle ? ` rotate(${angle} ${width / 2} ${height / 2})` : '';
      const mirror = i.mirrored ? ` translate(${width} 0) scale(-1 1)` : '';
      const g = el('g', { transform: `translate(${i.x} ${i.y})${rotation}${mirror}`,
        class: i.mirrored ? 'part-mirrored' : null, 'data-kind': isPreview ? null : 'part', 'data-ref': i.ref }, this.partLayer);
      this.drawnParts.set(i, { group: g, suffix: rotation + mirror });
      if (!def) {
        el('rect', { width: 140, height: 40, rx: 6, class: 'part-missing' }, g);
        el('text', { x: 8, y: 24, class: 'part-title dark' }, g).textContent = `${i.ref}: 없는 부품 ${i.part}`;
        continue;
      }
      const { w, h, pos, top } = layoutPart(def);
      const st = this.sim?.parts[i.ref] || {};
      const sel = this.selected?.type === 'part' && this.selected.ref === i.ref || this.selected?.type === 'group' && this.selected.refs.has(i.ref);
      const look = lookOf(def);
      const bare = isBareArt(def);
      // 맨 소자(LED·저항 등)는 캔버스 바탕 위에 그리므로 글자색을 화면 테마에 맞춘다
      const light = bare ? null : isLight(def.color);
      const tone = bare || def.imageData ? 'on-canvas' : light ? 'dark' : '';
      el('rect', {
        width: w, height: h, rx: 8, style: bare ? null : def.imageData ? 'fill:transparent' : `fill:${def.color || 'var(--slate-600)'}`,
        class: `part-body ${bare ? 'bare' : ''} ${sel ? 'selected' : ''} ${isPreview ? 'added' : ''}`
      }, g);
      drawArt(g, { w, h, top, pos, st, def, power });
      const title = el('text', { x: w / 2, y: (bare ? 14 : 19) + top, class: `part-title ${tone}`, 'text-anchor': 'middle' }, g);
      title.textContent = shortName(`${i.ref} · ${def.name}`, w);
      el('title', {}, g).textContent = `${i.ref} · ${def.name}${i.label ? ` — ${i.label}` : ''}`;
      if (i.label) el('text', { x: w / 2, y: -6, class: 'part-label', 'text-anchor': 'middle' }, g).textContent = shortName(i.label, w);

      this.drawBehavior(g, def, st, w, h, tone, power);
      const inset = labelInset(look);

      for (const [pid, p] of Object.entries(pos)) {
        const key = pinKey(i.ref, pid);
        const used = usedPins.has(key);
        const net = power ? this.sim.netByPin[key] : null;
        const tx = p.side === 'left' ? 10 + inset.left : p.side === 'right' ? -10 + inset.right : 0;
        const ty = bare && (p.side === 'left' || p.side === 'right') ? 20 : p.side === 'top' ? 18 : p.side === 'bottom' ? -8 : 4;
        const anchor = p.side === 'left' ? 'start' : p.side === 'right' ? 'end' : 'middle';
        el('text', { x: p.x + tx, y: p.y + ty, 'text-anchor': anchor, class: `pin-label ${tone} ${p.def.type === 'nc' ? 'nc' : ''}` }, g).textContent = pinCaption(p.def, anchor === 'middle' ? 7 : 18);
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
      // 외부 그림의 화면 영역은 전체 크기 대비 비율로 지정한다.
      const area = def.imageData && def.imageDisplay;
      const sx = area ? area.x * w : 14;
      const sy = area ? area.y * h : 34 + layoutPart(def).top;
      const sw = area ? area.width * w : w - 28;
      const sh = area ? area.height * h : Math.max(26, h - 52 - layoutPart(def).top);
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
