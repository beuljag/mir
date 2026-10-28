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

// 4색 띠: 앞 두 자리 + 곱하는 수(10의 몇 제곱, 1Ω~9.9Ω은 금색=×0.1) + 오차(금색)
const BAND = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'gray', 'white'];
export const BAND_HEX = {
  black: '#1a1a1a', brown: '#7b4a23', red: '#d0312d', orange: '#f07f13', yellow: '#f2c200',
  green: '#2e9e4f', blue: '#2563eb', violet: '#7c3aed', gray: '#8a8a8a', white: '#f5f5f5', gold: '#c9a43a'
};
export function resistorBands(ohms) {
  if (!(ohms >= 1)) return ['black', 'black', 'black', 'gold'];
  let exp = Math.max(-1, Math.floor(Math.log10(ohms)) - 1);
  let v = Math.round(ohms / 10 ** exp);
  if (v >= 100) { v = Math.round(v / 10); exp++; }
  const digits = String(v).padStart(2, '0');
  return [BAND[+digits[0]], BAND[+digits[1]], exp < 0 ? 'gold' : BAND[exp] || 'white', 'gold'];
}

// ---------- 부품 그림(SVG 파일) 색 바꾸기 ----------
const SVG_PREFIX = 'data:image/svg+xml;base64,';
function editSvg(dataUrl, fn) {
  if (!dataUrl?.startsWith(SVG_PREFIX)) return dataUrl;
  const bin = atob(dataUrl.slice(SVG_PREFIX.length));
  const text = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  const bytes = new TextEncoder().encode(fn(text));
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return SVG_PREFIX + btoa(out);
}

function toHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function toHex([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// LED 그림: 원래 LED 색과 비슷한 색(다리·회색은 그대로)만 새 색으로 옮긴다. 밝고 어두운 차이는 유지.
function recolorLed(svg, fromHex, toHexColor) {
  const [fh, fs, fl] = toHsl(fromHex);
  const [th, ts, tl] = toHsl(toHexColor);
  return svg.replace(/#[0-9a-f]{6}\b/gi, (hex) => {
    const [h, s, l] = toHsl(hex);
    const dh = Math.min(Math.abs(h - fh), 360 - Math.abs(h - fh));
    if (s < 0.3 || dh > 40) return hex;
    return toHex([th, clamp(ts * (s / (fs || 1)), 0, 1), clamp(l + (tl - fl), 0.05, 0.97)]);
  });
}

// 저항 그림: 세로로 긴 좁은 사각형을 색띠로 보고 앞에서부터 새 색띠로 바꾼다.
function recolorBands(svg, ohms) {
  const bands = resistorBands(ohms).map((c) => BAND_HEX[c]);
  let k = 0;
  return svg.replace(/<rect\b[^>]*>/g, (tag) => {
    const num = (a) => parseFloat((tag.match(new RegExp(`\\s${a}="([\\d.]+)"`)) || [])[1]);
    const w = num('width'), h = num('height');
    if (!(w > 0 && h >= w * 2.5) || k >= bands.length) return tag;
    const c = bands[k++];
    return /\sfill="[^"]*"/.test(tag) ? tag.replace(/\sfill="[^"]*"/, ` fill="${c}"`) : tag.replace('<rect', `<rect fill="${c}"`);
  });
}

function recolorImage(base, props) {
  if (!base.imageData) return undefined;
  if (props.color && base.behavior.color) return editSvg(base.imageData, (s) => recolorLed(s, base.behavior.color, props.color));
  if (props.ohms != null) return editSvg(base.imageData, (s) => recolorBands(s, props.ohms));
  return base.imageData;
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
    byKey.set(key, {
      ...base,
      name: displayName(base, inst.props),
      behavior: { ...base.behavior, ...inst.props },
      ...(base.imageData ? { imageData: recolorImage(base, inst.props) } : {})
    });
  }
  return byKey.get(key);
}
