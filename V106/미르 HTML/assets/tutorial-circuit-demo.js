// A small local demonstration; it never changes the user's circuit or GPIO.
export function circuitDemo(step) {
  const pair = {
    3: { a: [71, 33], b: [103, 33], path: 'M71 33H103', caption: '① GPIO26 클릭 → ② 저항 핀 클릭' },
    4: { a: [147, 33], b: [194, 33], path: 'M147 33H194', caption: '① 저항의 남은 핀 클릭 → ② LED A(+) 클릭' },
    5: { a: [216, 33], b: [40, 57], path: 'M216 33H278V78H40V57', caption: '① LED K(−) 클릭 → ② 보드 GND 클릭' }
  }[step];
  const caption = pair?.caption || (step === 6 ? '가상 전원: OFF를 누르면 ON으로 바뀌어요' : step === 8 ? 'GPIO26을 LOW로 바꾸면 LED가 꺼져요' : step === 9 ? 'GPIO26 → 저항 → LED → GND, 한 바퀴 완성!' : 'GPIO26을 HIGH로 바꾸면 LED가 켜져요');
  const controls = step >= 6 && step < 9;
  const cursor = pair ? `<g class="circuit-demo-cursor" style="--from-x:${pair.a[0]}px;--from-y:${pair.a[1]}px;--to-x:${pair.b[0]}px;--to-y:${pair.b[1]}px"><path d="M0 0L3 15L7 10L12 10Z" fill="var(--surface,white)" stroke="currentColor" stroke-width="1.5"/></g>` : '';
  const endpoints = pair ? [pair.a, pair.b].map(([x,y], i) => `<g><circle class="circuit-demo-tap tap-${i}" cx="${x}" cy="${y}" r="7"/><text x="${x}" y="${y-11}" font-size="10" text-anchor="middle">${i+1}</text></g>`).join('') : '';
  return `<svg viewBox="0 0 300 104" role="img" aria-label="${caption}">
    <g fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="12" width="64" height="45" rx="7"/><path d="M71 33H103M147 33H194M216 33H278V78H40V57" opacity=".35"/><rect x="103" y="26" width="44" height="14" rx="4"/><path d="M194 33V25a11 11 0 0 1 22 0v8Z"/></g>
    <g fill="currentColor" font-size="10" text-anchor="middle"><text x="39" y="29">ESP32</text><text x="39" y="45">GPIO26</text><text x="125" y="18">220Ω</text><text x="205" y="53">LED</text><text x="109" y="93">GND</text></g>
    ${pair ? `<path class="circuit-demo-link" d="${pair.path}" fill="none" stroke="currentColor" stroke-width="3"/>${endpoints}${cursor}` : ''}
    ${controls ? `<g class="circuit-demo-control"><rect x="84" y="53" width="91" height="19" rx="6" fill="var(--surface,white)" stroke="currentColor"/><text x="129" y="66" text-anchor="middle" font-size="10" fill="currentColor">${step===6?'전원 OFF → ON':step===8?'HIGH → LOW':'LOW → HIGH'}</text><circle class="circuit-demo-press" cx="165" cy="65" r="8" fill="none" stroke="currentColor"/></g>` : ''}
    ${!pair && step !== 6 ? `<path class="circuit-demo-light ${step===8?'demo-turn-off':''}" d="M194 33V25a11 11 0 0 1 22 0v8Z" fill="var(--primary)" stroke="currentColor"/><g class="circuit-demo-light ${step===8?'demo-turn-off':''}" stroke="currentColor" stroke-width="2"><path d="M205 5V1M224 13L228 9M186 13L182 9"/></g>` : ''}
  </svg><p class="circuit-demo-caption">${caption}</p>`;
}
