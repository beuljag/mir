// 배치한 부품 하나하나의 값 바꾸기 (LED 색, 저항값).
// 부품 JSON은 그대로 두고, 배치된 부품(instance)의 "props"에 바뀐 값만 저장한다.
//   LED  → props: { "color": "#34c759", "forwardVoltage": 2.2 }
//   저항 → props: { "ohms": 1000 }

export const LED_COLORS = [
  { id: 'red', label: '빨간', hex: '#ff3b30', vf: 2.0 },
  { id: 'orange', label: '주황', hex: '#ff9500', vf: 2.0 },
  { id: 'yellow', label: '노란', hex: '#ffd60a', vf: 2.1 },
  { id: 'green', label: '초록', hex: '#34c759', vf: 2.2 },
  { id: 'blue', label: '파란', hex: '#0a84ff', vf: 3.0 },
  { id: 'white', label: '흰색', hex: '#f2f2f7', vf: 3.0 }
];

// 자주 쓰는 저항값 (E12 일부)
export const RESISTOR_PRESETS = [10, 47, 100, 220, 330, 470, 1000, 2200, 4700, 10000, 47000, 100000, 1000000];

export function formatOhms(ohms) {
  const trim = (n) => String(Number(n.toFixed(2)));
  if (ohms >= 1e6) return `${trim(ohms / 1e6)}MΩ`;
  if (ohms >= 1e3) return `${trim(ohms / 1e3)}kΩ`;
  return `${trim(ohms)}Ω`;
}

// "220", "4.7k", "10kΩ", "1M", "2k2" 같은 글자를 Ω 숫자로. 못 읽으면 null.
export function parseOhms(s) {
  const t = String(s).trim().replace(/\s|Ω|ohms?|옴/gi, '');
  const m = t.match(/^(\d+(?:\.\d+)?)([rkm]?)(\d*)$/i);
  if (!m) return null;
  const mult = { '': 1, r: 1, k: 1e3, m: 1e6 }[m[2].toLowerCase()];
  const num = m[3] ? parseFloat(`${m[1]}.${m[3]}`) : parseFloat(m[1]);
  const v = Math.round(num * mult * 100) / 100;
  return v > 0 && v <= 1e8 ? v : null;
}

export function editableKind(def) {
  const k = def?.behavior?.kind;
  return k === 'led' || k === 'resistor' ? k : null;
}

// AI 응답이나 파일에서 온 props를 받아도 되는 값만 남긴다.
export function cleanProps(def, props) {
  if (!props || typeof props !== 'object') return undefined;
  const kind = editableKind(def);
  const out = {};
  if (kind === 'led') {
    const named = LED_COLORS.find((c) => c.id === props.color || c.label === props.color);
    if (named) { out.color = named.hex; out.forwardVoltage = named.vf; }
    else if (/^#[0-9a-f]{6}$/i.test(props.color || '')) out.color = props.color.toLowerCase();
    const vf = Number(props.forwardVoltage);
    if (vf > 0 && vf < 10) out.forwardVoltage = vf;
  } else if (kind === 'resistor') {
    const ohms = typeof props.ohms === 'number' ? props.ohms : parseOhms(props.ohms ?? '');
    if (ohms > 0) out.ohms = ohms;
  }
  return Object.keys(out).length ? out : undefined;
}

function displayName(base, props) {
  const kind = editableKind(base);
  if (kind === 'resistor' && props.ohms != null) return `저항 ${formatOhms(props.ohms)}`;
  if (kind === 'led' && props.color) {
    const c = LED_COLORS.find((x) => x.hex === props.color);
    return `${c ? `${c.label} LED` : 'LED (직접 고른 색)'}${/5mm/.test(base.name) ? ' (5mm)' : ''}`;
  }
  return base.name;
}

// 배치된 부품에 맞는 부품 정의. props가 없으면 원래 정의를 그대로 돌려준다.
const cache = new WeakMap();
export function defFor(defs, inst) {
  const base = inst && defs.get(inst.part);
  if (!base || !inst.props || !editableKind(base)) return base;
  const key = JSON.stringify(inst.props);
  let byKey = cache.get(base);
  if (!byKey) cache.set(base, (byKey = new Map()));
  if (!byKey.has(key)) {
    byKey.set(key, { ...base, name: displayName(base, inst.props), behavior: { ...base.behavior, ...inst.props } });
  }
  return byKey.get(key);
}
