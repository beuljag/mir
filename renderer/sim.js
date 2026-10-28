// 간이 가상 전원 시뮬레이터.
// 실제 회로 해석(SPICE)이 아니라 "어느 선에 몇 V가 걸리는지"와 부품의 눈에 보이는 반응만 계산한다.
// 문제인지 아닌지의 판정은 하지 않는다. 판정은 학생이 가상 전원을 켜고 측정해 보며 직접 한다.

class UnionFind {
  constructor() { this.p = new Map(); }
  find(x) {
    if (!this.p.has(x)) this.p.set(x, x);
    let r = x;
    while (this.p.get(r) !== r) r = this.p.get(r);
    this.p.set(x, r);
    return r;
  }
  union(a, b) { this.p.set(this.find(a), this.find(b)); }
}

export const pinKey = (ref, pin) => `${ref}.${pin}`;

export function splitKey(key) {
  const i = key.indexOf('.');
  return [key.slice(0, i), key.slice(i + 1)];
}

// 핀 voltage가 "VCC"면 그 부품의 behavior.vcc 핀 전압을 따른다.
function resolvePinVoltage(pinDef, ref, def, netVoltage) {
  if (typeof pinDef.voltage === 'number') return pinDef.voltage;
  if (pinDef.voltage === 'VCC' && def.behavior?.vcc) return netVoltage(pinKey(ref, def.behavior.vcc));
  return null;
}

export function simulate({ instances, wires, defs, gpio = {}, pressed = new Set() }) {
  const inst = instances.filter((i) => defs.get(i.part));
  const relayState = {};
  let result = null;

  // 릴레이 접점이 바뀌면 회로가 바뀌므로 안정될 때까지 반복한다.
  for (let iter = 0; iter < 6; iter++) {
    result = solve({ inst, wires, defs, gpio, pressed, relayState });
    let changed = false;
    for (const i of inst) {
      const def = defs.get(i.part);
      if (def.behavior?.kind !== 'relay') continue;
      const on = result.parts[i.ref].energized;
      if ((relayState[i.ref] || false) !== on) { relayState[i.ref] = on; changed = true; }
    }
    if (!changed) break;
  }
  return result;
}

function solve({ inst, wires, defs, gpio, pressed, relayState }) {
  const uf = new UnionFind();
  const allPins = [];
  for (const i of inst) {
    const def = defs.get(i.part);
    for (const p of def.pins) { const k = pinKey(i.ref, p.id); uf.find(k); allPins.push([k, i, def, p]); }
    for (const group of def.internalNets || []) {
      for (let n = 1; n < group.length; n++) uf.union(pinKey(i.ref, group[0]), pinKey(i.ref, group[n]));
    }
    const b = def.behavior || {};
    if (b.kind === 'button' && pressed.has(i.ref)) uf.union(pinKey(i.ref, b.a), pinKey(i.ref, b.b));
    if (b.kind === 'relay') {
      const target = relayState[i.ref] ? b.no : b.nc;
      uf.union(pinKey(i.ref, b.com), pinKey(i.ref, target));
    }
  }
  for (const w of wires) {
    if (uf.p.has(w.from) && uf.p.has(w.to)) uf.union(w.from, w.to);
  }

  // 네트별 공급원 수집
  const nets = new Map();
  const net = (k) => {
    const id = uf.find(k);
    if (!nets.has(id)) nets.set(id, { id, pins: [], sources: [], voltage: null, kind: null, short: false, limited: false });
    return nets.get(id);
  };
  for (const [k] of allPins) net(k).pins.push(k);

  const addSource = (k, v, strength, label) => net(k).sources.push({ v, strength, label, pin: k });

  for (const [k, i, def, p] of allPins) {
    const kind = def.behavior?.kind;
    if (p.type === 'power_out' && (kind === 'board' || kind === 'supply')) addSource(k, p.voltage, 'power', k);
    if (p.type === 'gnd' && (kind === 'board' || kind === 'supply')) addSource(k, 0, 'power', k);
    if (kind === 'board' && (p.type === 'gpio') && gpio[k]) {
      addSource(k, gpio[k] === 'HIGH' ? p.voltage : 0, 'drive', `${k} ${gpio[k]}`);
    }
  }

  const finalize = () => {
    for (const n of nets.values()) {
      const strong = n.sources.filter((s) => s.strength !== 'pullup');
      const pool = strong.length ? strong : n.sources;
      const volts = [...new Set(pool.map((s) => s.v))];
      n.short = strong.length > 1 && volts.length > 1;
      n.voltage = volts.length ? Math.max(...volts) : n.voltage;
      if (n.sources.some((s) => s.strength === 'power' && s.v === 0) && !n.short) n.kind = 'gnd';
      else if (n.voltage != null) n.kind = n.sources.some((s) => s.strength === 'power') ? 'power' : 'signal';
    }
  };

  // GND는 다른 부품의 gnd 핀이 같은 네트일 때만 기준이 된다.
  finalize();
  const netOf = (k) => net(k);
  const vOf = (k) => net(k).voltage;
  const isGround = (k) => net(k).kind === 'gnd' || (net(k).voltage === 0 && net(k).sources.length > 0);

  // 전원이 들어온 센서/모듈의 풀업 출력을 공급원으로 추가
  const parts = {};
  for (const i of inst) {
    const def = defs.get(i.part);
    const b = def.behavior || {};
    if (b.kind === 'sensor' || b.kind === 'i2c-device') {
      const vcc = vOf(pinKey(i.ref, b.vcc));
      const vccPin = def.pins.find((p) => p.id === b.vcc);
      const powered = vcc != null && vcc >= (vccPin?.minVoltage ?? 0.1) && isGround(pinKey(i.ref, b.gnd));
      parts[i.ref] = { powered, vcc };
      if (powered) {
        for (const p of def.pins) {
          if (p.voltage === 'VCC' || (typeof p.voltage === 'number' && p.type === 'output')) {
            addSource(pinKey(i.ref, p.id), resolvePinVoltage(p, i.ref, def, vOf), 'pullup', `${i.ref}.${p.id} 풀업`);
          }
        }
      }
    }
  }
  finalize();

  // 저항을 통해 전압이 비어 있는 쪽으로 전달된다(전류 제한됨 표시).
  for (let pass = 0; pass < 6; pass++) {
    for (const i of inst) {
      const def = defs.get(i.part);
      if (def.behavior?.kind !== 'resistor') continue;
      const [a, b] = def.pins.map((p) => net(pinKey(i.ref, p.id)));
      for (const [from, to] of [[a, b], [b, a]]) {
        if (from.voltage != null && to.voltage == null && !to.sources.length) {
          to.voltage = from.voltage;
          to.limited = true;
          to.kind = from.kind === 'gnd' ? 'gnd' : 'signal';
          to.via = `${i.ref}(${def.behavior.ohms}Ω) 경유`;
        }
      }
    }
  }

  // 부품별 상태
  for (const i of inst) {
    const def = defs.get(i.part);
    const b = def.behavior || {};
    const st = parts[i.ref] || {};
    if (b.kind === 'board' || b.kind === 'supply') st.powered = true;
    if (b.kind === 'led' || b.kind === 'diode') {
      const A = net(pinKey(i.ref, b.anode));
      const K = net(pinKey(i.ref, b.cathode));
      const forward = A.voltage != null && K.voltage != null ? A.voltage - K.voltage : null;
      const limited = A.limited || K.limited;
      if (b.kind === 'led') {
        st.lit = forward != null && forward >= (b.forwardVoltage || 2) * 0.9;
        st.burnt = st.lit && !limited && forward > (b.forwardVoltage || 2) + 0.3;
      } else {
        // 다이오드가 전원 두 레일 사이에 정방향으로 직결되면 사실상 단락이다.
        st.conducting = forward != null && forward > 0.6;
        st.shorting = st.conducting && !limited && A.kind === 'power' && K.kind === 'gnd';
      }
    }
    if (b.kind === 'relay') {
      const vcc = vOf(pinKey(i.ref, b.vcc));
      const vin = vOf(pinKey(i.ref, b.in));
      const vccPin = def.pins.find((p) => p.id === b.vcc);
      st.powered = vcc != null && vcc >= (vccPin?.minVoltage ?? 4) * 0.8 && isGround(pinKey(i.ref, b.gnd));
      const trig = b.trigger === 'low' ? vin != null && vin < 0.8 : vin != null && vin >= (b.minTrigger ?? 2.5);
      st.energized = st.powered && trig;
    }
    if (b.kind === 'load') {
      const vp = vOf(pinKey(i.ref, b.plus));
      const vm = vOf(pinKey(i.ref, b.minus));
      const diff = vp != null && vm != null ? vp - vm : null;
      st.voltage = diff;
      st.on = diff != null && diff >= (b.ratedVoltage || 5) * 0.75;
      st.weak = diff != null && diff > 0.5 && !st.on;
      st.reversed = diff != null && diff < -0.5;
    }
    if (b.kind === 'i2c-device' && st.powered) {
      const busOk = (pin, fn) => net(pinKey(i.ref, pin)).pins.some((k) => {
        const [r, pid] = splitKey(k);
        const d = defs.get(inst.find((x) => x.ref === r)?.part);
        if (d?.behavior?.kind !== 'board') return false;
        return (d.pins.find((p) => p.id === pid)?.functions || []).some((f) => f.includes(fn));
      });
      st.linked = busOk(b.sda, 'SDA') && busOk(b.scl, 'SCL');
    }
    if (b.kind === 'button') st.pressed = pressed.has(i.ref);
    parts[i.ref] = st;
  }

  const netByPin = {};
  for (const [k] of allPins) netByPin[k] = net(k);
  return { netByPin, nets: [...nets.values()], parts };
}
