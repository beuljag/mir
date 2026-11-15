// 화면 좌표만 계산하는 직각 배선 라우터. 연결 정보와 전기적 계산은 바꾸지 않는다.
const EPS = 1e-7;
const DIR = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
export const ROUTING_DEFAULTS = Object.freeze({
  clearance: 12, stub: 24, laneGap: 8, bendPenalty: 24,
  overlapPenalty: 3, crossingPenalty: 16, maxVisited: 30000
});
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const same = (a, b) => distance(a, b) < EPS;
const inside = (p, r) => p.x > r.left + EPS && p.x < r.right - EPS && p.y > r.top + EPS && p.y < r.bottom - EPS;

// 경계선 위는 허용하되, 부품의 여백을 포함한 내부를 가로지르면 막는다.
export function segmentBlocked(a, b, boxes) {
  return boxes.some(r => {
    if (Math.abs(a.y - b.y) < EPS) return a.y > r.top + EPS && a.y < r.bottom - EPS
      && Math.max(a.x, b.x) > r.left + EPS && Math.min(a.x, b.x) < r.right - EPS;
    if (Math.abs(a.x - b.x) < EPS) return a.x > r.left + EPS && a.x < r.right - EPS
      && Math.max(a.y, b.y) > r.top + EPS && Math.min(a.y, b.y) < r.bottom - EPS;
    return true;
  });
}

export function simplifyPoints(points) {
  const result = [];
  for (const p of points) {
    if (result.length && same(result[result.length - 1], p)) continue;
    while (result.length >= 2) {
      const a = result[result.length - 2], b = result[result.length - 1];
      const horizontal = Math.abs(a.y - b.y) < EPS && Math.abs(b.y - p.y) < EPS;
      const vertical = Math.abs(a.x - b.x) < EPS && Math.abs(b.x - p.x) < EPS;
      // 되돌아가는 선분은 지우지 않는다. 실패 경로도 실제 모양을 유지한다.
      if (!(horizontal || vertical) || (b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) < -EPS) break;
      result.pop();
    }
    result.push({ x: p.x, y: p.y });
  }
  return result;
}

// 같은 행·열별로 선분을 묶어, 매 탐색 간선마다 기존 선 전체를 훑지 않는다.
function indexSegments(segments) {
  const horizontal = new Map(), vertical = new Map();
  for (const [a, b] of segments) {
    const h = Math.abs(a.y - b.y) < EPS, map = h ? horizontal : vertical;
    const key = h ? a.y : a.x;
    if (!map.has(key)) map.set(key, []);
    const p = h ? a.x : a.y, q = h ? b.x : b.y;
    map.get(key).push([Math.min(p, q), Math.max(p, q)]);
  }
  return { horizontal, vertical, x: [...vertical.keys()].sort((a, b) => a - b), y: [...horizontal.keys()].sort((a, b) => a - b) };
}

function lowerBound(values, target) {
  let lo = 0, hi = values.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (values[mid] < target) lo = mid + 1; else hi = mid; }
  return lo;
}

function congestion(a, b, index, options) {
  let cost = 0;
  const horizontal = Math.abs(a.y - b.y) < EPS;
  const fixed = horizontal ? a.y : a.x, from = horizontal ? a.x : a.y, to = horizontal ? b.x : b.y;
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const parallel = horizontal ? index.horizontal : index.vertical;
  for (const [axis, segments] of parallel) {
    if (Math.abs(axis-fixed) >= options.laneGap-EPS) continue;
    for (const [p,q] of segments) {
      const overlap=Math.max(0,Math.min(hi,q)-Math.max(lo,p));
      if(overlap>EPS) cost += overlap * options.overlapPenalty * 1000;
    }
  }
  const keys = horizontal ? index.x : index.y, perpendicular = horizontal ? index.vertical : index.horizontal;
  for (let i = lowerBound(keys, lo - EPS); i < keys.length && keys[i] <= hi + EPS; i++) {
    for (const [p, q] of perpendicular.get(keys[i])) if (fixed > p + EPS && fixed < q - EPS) cost += options.crossingPenalty * ((Math.abs(keys[i]-lo)<EPS || Math.abs(keys[i]-hi)<EPS) ? .5 : 1);
  }
  return cost;
}

// f 값이 같으면 먼저 넣은 노드를 먼저 꺼내, 같은 입력에 같은 경로를 만든다.
class MinHeap {
  constructor() { this.items = []; this.sequence = 0; }
  push(state, score, g) {
    const item = { state, score, g, order: this.sequence++ }, a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i) {
      const parent = (i - 1) >> 1;
      if (!this.less(item, a[parent])) break;
      a[i] = a[parent]; i = parent;
    }
    a[i] = item;
  }
  less(a, b) { return a.score < b.score || (a.score === b.score && a.order < b.order); }
  pop() {
    const a = this.items, first = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let child = i * 2 + 1;
        if (child + 1 < a.length && this.less(a[child + 1], a[child])) child++;
        if (!this.less(a[child], last)) break;
        a[i] = a[child]; i = child;
      }
      a[i] = last;
    }
    return first;
  }
}

function escapePin(pin, boxes, options) {
  const dir = DIR[pin.side] || [0, 0];
  if (!dir[0] && !dir[1]) return { point: { x: pin.x, y: pin.y }, dir };
  let length = options.stub;
  for (const box of boxes) {
    if (pin.owner != null && box.id === pin.owner) continue;
    if (inside(pin, box)) return null;
    let gap = Infinity;
    if (dir[0] && pin.y > box.top + EPS && pin.y < box.bottom - EPS) {
      if (dir[0] > 0 && box.left >= pin.x) gap = box.left - pin.x;
      if (dir[0] < 0 && box.right <= pin.x) gap = pin.x - box.right;
    }
    if (dir[1] && pin.x > box.left + EPS && pin.x < box.right - EPS) {
      if (dir[1] > 0 && box.top >= pin.y) gap = box.top - pin.y;
      if (dir[1] < 0 && box.bottom <= pin.y) gap = pin.y - box.bottom;
    }
    length = Math.min(length, gap - 1);
  }
  if (length <= options.clearance + EPS) return null;
  return { point: { x: pin.x + dir[0] * length, y: pin.y + dir[1] * length }, dir };
}

function search(start, end, boxes, previous, options, lane) {
  const xs = new Set([start.point.x, end.point.x, (start.point.x + end.point.x) / 2]);
  const ys = new Set([start.point.y, end.point.y, (start.point.y + end.point.y) / 2]);
  for (const b of boxes) {
    xs.add(b.left); xs.add(b.right); xs.add(b.left - lane); xs.add(b.right + lane);
    ys.add(b.top); ys.add(b.bottom); ys.add(b.top - lane); ys.add(b.bottom + lane);
  }
  for(const [axis,segments] of previous.horizontal){ys.add(axis-options.laneGap);ys.add(axis+options.laneGap);for(const [p,q] of segments){xs.add(p-options.laneGap);xs.add(q+options.laneGap);}}
  for(const [axis,segments] of previous.vertical){xs.add(axis-options.laneGap);xs.add(axis+options.laneGap);for(const [p,q] of segments){ys.add(p-options.laneGap);ys.add(q+options.laneGap);}}
  const margin = options.stub + options.laneGap;
  xs.add(Math.min(...xs) - margin); xs.add(Math.max(...xs) + margin);
  ys.add(Math.min(...ys) - margin); ys.add(Math.max(...ys) + margin);
  const x = [...xs].sort((a, b) => a - b), y = [...ys].sort((a, b) => a - b);
  const nx = x.length, count = nx * y.length;
  if (count > 200000 || options.maxVisited <= 0) return null;
  const point = id => ({ x: x[id % nx], y: y[Math.floor(id / nx)] });
  const startId = y.indexOf(start.point.y) * nx + x.indexOf(start.point.x);
  const endId = y.indexOf(end.point.y) * nx + x.indexOf(end.point.x);
  if (boxes.some(b => inside(start.point, b) || inside(end.point, b))) return null;
  const blocked = new Map();
  const isBlocked = id => { if(!blocked.has(id)) blocked.set(id,boxes.some(b=>inside(point(id),b))); return blocked.get(id); };
  const costs = new Float64Array(count * 3); costs.fill(Infinity);
  const parents = new Int32Array(count * 3); parents.fill(-1);
  const heading = start.dir[0] ? 1 : start.dir[1] ? 2 : 0;
  const initial = startId * 3 + heading;
  costs[initial] = 0;
  const queue = new MinHeap(); queue.push(initial, distance(start.point, end.point), 0);
  let visited = 0;
  while (queue.items.length && visited++ < options.maxVisited) {
    const current = queue.pop();
    if (current.g !== costs[current.state]) continue;
    const id = Math.floor(current.state / 3), incoming = current.state % 3;
    if (id === endId) {
      const result = [];
      for (let s = current.state; s !== -1; s = parents[s]) result.push(point(Math.floor(s / 3)));
      return result.reverse();
    }
    const a = point(id), ix = id % nx, iy = Math.floor(id / nx);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      if (ix + dx < 0 || ix + dx >= nx || iy + dy < 0 || iy + dy >= y.length) continue;
      const nextId = (iy + dy) * nx + ix + dx;
      if (isBlocked(nextId)) continue;
      if (id === startId && dx * start.dir[0] + dy * start.dir[1] < 0) continue;
      if (nextId === endId && dx * end.dir[0] + dy * end.dir[1] > 0) continue;
      const b = point(nextId);
      if (segmentBlocked(a, b, boxes)) continue;
      const direction = dx ? 1 : 2, nextState = nextId * 3 + direction;
      const turn = incoming && direction !== incoming ? options.bendPenalty : 0;
      const endHeading = end.dir[0] ? 1 : end.dir[1] ? 2 : 0;
      const lastTurn = nextId === endId && endHeading && endHeading !== direction ? options.bendPenalty : 0;
      const g = current.g + distance(a, b) + turn + lastTurn + congestion(a, b, previous, options);
      if (g >= costs[nextState] - EPS) continue;
      costs[nextState] = g; parents[nextState] = current.state;
      queue.push(nextState, g + distance(b, end.point), g);
    }
  }
  return null;
}

/** start/end: {x,y,side,owner}; obstacles: {id,x,y,width,height}[] */
export function routeWire(start, end, obstacles = [], previous = [], settings = {}) {
  const options = { ...ROUTING_DEFAULTS, ...settings };
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) throw new TypeError('핀 좌표는 유한한 숫자여야 합니다');
  if (same(start, end)) return { points: [{ x: start.x, y: start.y }], blocked: false };
  const occupied = indexSegments(previous);
  const boxes = obstacles.map(b => ({ id: b.id, left: b.x - options.clearance, right: b.x + b.width + options.clearance,
    top: b.y - options.clearance, bottom: b.y + b.height + options.clearance }));
  const da = DIR[start.side] || [0, 0], db = DIR[end.side] || [0, 0];
  const aligned = Math.abs(start.x - end.x) < EPS || Math.abs(start.y - end.y) < EPS;
  const vx = end.x - start.x, vy = end.y - start.y;
  const outward = (!DIR[start.side] || vx * da[0] + vy * da[1] > 0)
    && (!DIR[end.side] || vx * db[0] + vy * db[1] < 0);
  // 서로 마주 보는 같은 행/열의 핀은 불필요한 우회 없이 직선으로 잇는다.
  const directBoxes = boxes.map((b, i) => (start.owner != null && b.id === start.owner) || (end.owner != null && b.id === end.owner)
    ? { ...b, left: obstacles[i].x, right: obstacles[i].x + obstacles[i].width,
      top: obstacles[i].y, bottom: obstacles[i].y + obstacles[i].height } : b);
  if (aligned && outward && !segmentBlocked(start, end, directBoxes) && !congestion(start, end, occupied, options)) {
    return { points: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }], blocked: false };
  }
  const a = escapePin(start, boxes, options), b = escapePin(end, boxes, options);
  if (a && b) {
    const found = search(a, b, boxes, occupied, options, (settings.lane || 0) * options.laneGap);
    if (found) return { points: simplifyPoints([start, ...found, end]), blocked: false };
  }
  // 부품 겹침 등으로 길이 없으면 연결 자체는 유지하고, 호출자가 경고를 표시한다.
  const p = a?.point || { x: start.x + da[0] * options.stub, y: start.y + da[1] * options.stub };
  const q = b?.point || { x: end.x + db[0] * options.stub, y: end.y + db[1] * options.stub };
  const candidates = [[start, p, { x: q.x, y: p.y }, q, end], [start, p, { x: p.x, y: q.y }, q, end]].map(simplifyPoints);
  const score = points => points.slice(1).reduce((sum, next, i) => sum + distance(points[i], next)
    + (segmentBlocked(points[i], next, directBoxes) ? 1000000 : 0), 0);
  candidates.sort((p1, p2) => score(p1) - score(p2));
  return { points: candidates[0], blocked: true };
}

export function routeWires(connections, obstacles, settings = {}) {
  const result = new Map(), occupied = [];
  const ordered = [...connections].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  ordered.forEach((wire, index) => {
    const base = routeWire(wire.start,wire.end,obstacles,[],settings);
    let route = occupied.length ? routeWire(wire.start, wire.end, obstacles, occupied, { ...settings, lane: index % 4 }) : base;
    const length=r=>r.points.slice(1).reduce((sum,p,i)=>sum+distance(r.points[i],p),0);
    // Avoid detours that visually suggest a different connection; retain the valid base route.
    if(!base.blocked && (route.blocked || length(route)>length(base)*1.25+16 || route.points.length>base.points.length+4)) route={...base, shared:true};
    result.set(wire.id, route);
    for (let i = 1; i < route.points.length; i++) occupied.push([route.points[i - 1], route.points[i]]);
  });
  return result;
}

// 직각 경로의 꺾인 곳만 5px 둥글게 한다. 경유점은 늘리지 않는다.
export function pointsToPath(points, radius = 5, cubic = false) {
  const p = simplifyPoints(points);
  if (!p.length) return '';
  let d = `M${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length; i++) {
    if (i === p.length - 1 || radius <= 0) { d += ` L${p[i].x} ${p[i].y}`; continue; }
    const before = p[i - 1], at = p[i], after = p[i + 1];
    const r = Math.min(radius, distance(before, at) / 2, distance(at, after) / 2);
    const a = { x: at.x + Math.sign(before.x - at.x) * r, y: at.y + Math.sign(before.y - at.y) * r };
    const b = { x: at.x + Math.sign(after.x - at.x) * r, y: at.y + Math.sign(after.y - at.y) * r };
    d += cubic ? ` L${a.x} ${a.y} C${a.x+(at.x-a.x)*2/3} ${a.y+(at.y-a.y)*2/3} ${b.x+(at.x-b.x)*2/3} ${b.y+(at.y-b.y)*2/3} ${b.x} ${b.y}` : ` L${a.x} ${a.y} Q${at.x} ${at.y} ${b.x} ${b.y}`;
  }
  return d;
}

// A shallow offset between facing pins should not produce a tiny staircase.
export function softAlignedPath(a,b,obstacles=[]) {
  const dx=b.x-a.x,dy=b.y-a.y;
  const horizontal=(a.side==='right'&&b.side==='left'&&dx>0)||(a.side==='left'&&b.side==='right'&&dx<0);
  const vertical=(a.side==='bottom'&&b.side==='top'&&dy>0)||(a.side==='top'&&b.side==='bottom'&&dy<0);
  if(!(horizontal&&Math.abs(dy)<=12 || vertical&&Math.abs(dx)<=12))return null;
  const c1=horizontal?{x:a.x+dx/3,y:a.y}:{x:a.x,y:a.y+dy/3};
  const c2=horizontal?{x:b.x-dx/3,y:b.y}:{x:b.x,y:b.y-dy/3};
  for(let i=1;i<40;i++){
    const t=i/40,u=1-t,x=u*u*u*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*b.x,y=u*u*u*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*b.y;
    for(const box of obstacles){
      const pad=box.id===a.owner||box.id===b.owner?0:12;
      if(x>box.x-pad+EPS&&x<box.x+box.width+pad-EPS&&y>box.y-pad+EPS&&y<box.y+box.height+pad-EPS)return null;
    }
  }
  return `M${a.x} ${a.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
}
