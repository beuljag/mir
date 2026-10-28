// Copilot Studio 에이전트와 주고받는 메시지 형식.
// 에이전트 쪽 지침은 docs/Copilot-Studio-지침.md 에 있다.

export const FORMAT_REMINDER = `[응답 형식] 설명은 자유롭게 쓰되, 배선을 제안할 때는 마지막에 \`\`\`json 코드블록 하나로
{"type":"wiring","title":"...","parts":[{"ref":"U1","part":"부품id","label":"역할"}],"connections":[{"from":"U1.핀id","to":"R1.핀id","note":"이유"}],"steps":["..."],"warnings":["..."],"code":"아두이노/파이썬 코드"}
를 넣어 주세요. 부품id와 핀id는 [부품 목록]에 있는 것만 쓰고, 수정안일 때도 전체 배선을 다시 보내 주세요.`;

export function buildCatalog(defs) {
  const lines = ['[부품 목록] 형식: 부품id | 이름 | 핀id:종류:전압(허용범위)[기능]'];
  for (const d of defs.values()) {
    const pins = d.pins.map((p) => {
      let s = `${p.id}:${p.type}`;
      if (p.voltage != null) s += `:${p.voltage}${typeof p.voltage === 'number' ? 'V' : ''}`;
      if (p.minVoltage != null || p.maxVoltage != null) s += `(${p.minVoltage ?? ''}~${p.maxVoltage ?? ''}V)`;
      const fns = (p.functions || []).filter((f) => f !== 'GPIO');
      if (fns.length) s += `[${fns.join('/')}]`;
      if (p.note) s += `{${p.note}}`;
      return s;
    });
    lines.push(`${d.id} | ${d.name} | ${pins.join(', ')}`);
  }
  return lines.join('\n');
}

export function wiringSnapshot(state, defs) {
  return {
    type: 'wiring',
    title: state.title || '',
    parts: state.instances.map((i) => ({ ref: i.ref, part: i.part, ...(i.label ? { label: i.label } : {}) })),
    connections: state.wires.map((w) => ({ from: w.from, to: w.to, ...(w.note ? { note: w.note } : {}) }))
  };
}

export function buildRecommendRequest(goal) {
  return `[요청 종류: 배선 추천]\n사용자 목표: ${goal}\n\n${FORMAT_REMINDER}`;
}

export function buildChatRequest(text, snapshot) {
  if (!snapshot) return text;
  return `${text}\n\n[현재 배선]\n\`\`\`json\n${JSON.stringify(snapshot)}\n\`\`\`\n\n${FORMAT_REMINDER}`;
}

export function buildDiagnoseRequest({ snapshot, checklist, measurements, memo }) {
  const judged = checklist.map((c) => `- ${c.title}: ${c.status}${c.memo ? ` (학생 메모: ${c.memo})` : ''}`).join('\n');
  return `[요청 종류: 오류 진단]
학생이 2D 가상환경에서 직접 테스트했습니다. 측정값과 학생 설명을 보고 문제의 원인이 배선·코드·부품 중 어디인지 짚고, 수정안을 제시해 주세요.
${judged ? `\n[학생 판정]\n${judged}\n` : ''}${memo ? `\n[학생 설명]\n${memo}\n` : ''}
[가상 전원 측정값]
${measurements || '(가상 전원을 켜지 않음)'}

[현재 배선]
\`\`\`json
${JSON.stringify(snapshot)}
\`\`\`

${FORMAT_REMINDER}`;
}

export function buildPartRequest(text) {
  return `[요청 종류: 부품 등록]
아래 데이터시트/도면 내용을 보고 이 프로그램의 부품 JSON을 만들어 주세요.
형식: \`\`\`json {"type":"part","id":"영문소문자-하이픈","name":"...","category":"sensor|display|output|input|module|actuator|power|passive|board","description":"...","behavior":{"kind":"sensor|i2c-device|led|resistor|button|relay|load|supply|diode|board", ...},"pins":[{"id":"VCC","label":"VCC","side":"left|right|top|bottom","type":"power_out|power_in|gnd|gpio|input|output|passive|contact|nc","voltage":3.3,"minVoltage":3.3,"maxVoltage":5.5,"functions":["..."],"note":"..."}],"sources":["근거 문서"]} \`\`\`
확인되지 않은 값은 넣지 말고 note에 "확인 필요"라고 적어 주세요.

[자료]
${text}`;
}

// 응답에서 ```json 블록(또는 맨 JSON)을 찾아 해석한다.
export function parseReply(text) {
  const blocks = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/g;
  let m;
  let plain = text;
  while ((m = re.exec(text))) {
    try {
      const obj = JSON.parse(m[1]);
      blocks.push(obj);
      plain = plain.replace(m[0], '');
    } catch { /* 코드 블록은 그대로 둔다 */ }
  }
  if (!blocks.length) {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s >= 0 && e > s) {
      try {
        blocks.push(JSON.parse(text.slice(s, e + 1)));
        plain = text.slice(0, s) + text.slice(e + 1);
      } catch { /* 일반 텍스트 */ }
    }
  }
  const wiring = blocks.find((b) => b && (b.type === 'wiring' || Array.isArray(b.connections)));
  const part = blocks.find((b) => b && (b.type === 'part' || (Array.isArray(b.pins) && b.id)));
  return { text: plain.trim(), wiring, part };
}

// ---------- 데모 모드 (에이전트 연결 전 체험용) ----------
const DEMOS = [
  {
    match: /밸브|솔레노이드|valve|펌프|외부 ?전[원력]/i,
    reply: `ESP32의 GPIO는 3.3V·수십 mA밖에 못 내기 때문에 12V 밸브를 직접 켤 수 없습니다. **릴레이 모듈**로 12V 회로를 따로 스위칭하는 구성을 추천합니다.

1. 릴레이 모듈 전원은 ESP32의 5V(USB) 핀에서, 제어 신호(IN)는 GPIO23에서 받습니다.
2. 12V 어댑터 + → 릴레이 COM, 릴레이 NO → 밸브 +, 밸브 - → 어댑터 GND 로 12V 회로를 만듭니다.
3. 밸브 코일 양단에 1N4007 다이오드를 **띠(K)가 + 쪽**이 되도록 병렬로 붙여 역기전력을 흡수합니다.`,
    wiring: {
      type: 'wiring', title: 'ESP32로 12V 솔레노이드 밸브 제어',
      parts: [
        { ref: 'U1', part: 'esp32-devkitc', label: '제어 보드' },
        { ref: 'K1', part: 'relay-module-5v', label: '스위치' },
        { ref: 'PS1', part: 'dc-12v-adapter', label: '외부 전원' },
        { ref: 'V1', part: 'solenoid-valve-12v', label: '밸브' },
        { ref: 'D1', part: 'diode-1n4007', label: '역기전력 보호' }
      ],
      connections: [
        { from: 'U1.5V', to: 'K1.VCC', note: '릴레이 코일 전원 5V' },
        { from: 'U1.GND2', to: 'K1.GND', note: '공통 GND' },
        { from: 'U1.GPIO23', to: 'K1.IN', note: '제어 신호(3.3V HIGH = 켜짐)' },
        { from: 'PS1.V+', to: 'K1.COM', note: '12V를 릴레이 공통 단자로' },
        { from: 'K1.NO', to: 'V1.V+', note: '릴레이가 붙으면 밸브에 12V' },
        { from: 'V1.V-', to: 'PS1.GND', note: '밸브 복귀선' },
        { from: 'D1.K', to: 'V1.V+', note: '다이오드 띠(K)는 + 쪽' },
        { from: 'D1.A', to: 'V1.V-', note: '다이오드 A는 - 쪽' }
      ],
      steps: ['USB를 뽑은 상태에서 배선합니다.', '12V 어댑터는 마지막에 연결합니다.', '코드 업로드 후 GPIO23을 HIGH로 만들어 밸브가 열리는지 확인합니다.'],
      warnings: ['릴레이 모듈이 LOW 트리거 제품이면 코드의 HIGH/LOW를 반대로 바꿔야 합니다.', '12V 선이 ESP32 핀에 닿지 않도록 주의하세요.'],
      code: `const int VALVE = 23;\nvoid setup() {\n  pinMode(VALVE, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(VALVE, HIGH); // 밸브 열림\n  delay(3000);\n  digitalWrite(VALVE, LOW);  // 밸브 닫힘\n  delay(3000);\n}`
    }
  },
  {
    match: /온도|습도|화면|oled|디스플레이|dht/i,
    reply: `DHT22로 온습도를 읽어 OLED에 띄우는 구성입니다.

- DHT22는 **3.3V**로 전원을 주어야 데이터선(OUT)도 3.3V가 되어 ESP32 핀이 안전합니다.
- OLED는 I2C라서 SDA→GPIO21, SCL→GPIO22(ESP32 기본 I2C 핀)에 연결합니다.`,
    wiring: {
      type: 'wiring', title: '온습도를 읽어 OLED에 표시',
      parts: [
        { ref: 'U1', part: 'esp32-devkitc', label: '제어 보드' },
        { ref: 'S1', part: 'dht22-module', label: '온습도 센서' },
        { ref: 'DS1', part: 'ssd1306-oled', label: '화면' }
      ],
      connections: [
        { from: 'U1.3V3', to: 'S1.VCC', note: '센서 전원 3.3V' },
        { from: 'U1.GND1', to: 'S1.GND' },
        { from: 'U1.GPIO4', to: 'S1.DATA', note: '데이터선' },
        { from: 'U1.3V3', to: 'DS1.VCC', note: 'OLED 전원' },
        { from: 'U1.GND2', to: 'DS1.GND' },
        { from: 'U1.GPIO21', to: 'DS1.SDA', note: 'I2C SDA' },
        { from: 'U1.GPIO22', to: 'DS1.SCL', note: 'I2C SCL' }
      ],
      steps: ['DHT sensor library, Adafruit SSD1306 라이브러리를 설치합니다.'],
      warnings: ['DHT22를 5V로 쓰면 데이터선이 5V가 되어 ESP32에 무리가 갑니다.'],
      code: `#include <DHT.h>\n#include <Adafruit_SSD1306.h>\nDHT dht(4, DHT22);\nAdafruit_SSD1306 oled(128, 64, &Wire);\nvoid setup() {\n  dht.begin();\n  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);\n}\nvoid loop() {\n  float t = dht.readTemperature(), h = dht.readHumidity();\n  oled.clearDisplay(); oled.setTextColor(WHITE); oled.setTextSize(2);\n  oled.setCursor(0, 10); oled.printf("%.1fC\\n%.0f%%", t, h);\n  oled.display(); delay(2000);\n}`
    }
  },
  {
    match: /라즈베리|raspberry|파이/i,
    reply: `라즈베리파이 GPIO17에 LED를 연결하는 기본 구성입니다. GPIO는 3.3V이고 5V를 견디지 못하니 5V 핀은 쓰지 않습니다.`,
    wiring: {
      type: 'wiring', title: '라즈베리파이 LED 깜빡이기',
      parts: [
        { ref: 'U1', part: 'raspberry-pi-4' },
        { ref: 'R1', part: 'resistor-220', label: '전류 제한' },
        { ref: 'LED1', part: 'led-red' }
      ],
      connections: [
        { from: 'U1.GPIO17', to: 'R1.P1' },
        { from: 'R1.P2', to: 'LED1.A', note: '긴 다리' },
        { from: 'LED1.K', to: 'U1.GND_9', note: '짧은 다리' }
      ],
      code: `from gpiozero import LED\nfrom time import sleep\nled = LED(17)\nwhile True:\n    led.toggle(); sleep(0.5)`
    }
  },
  {
    match: /led|엘이디|불빛|깜빡/i,
    reply: `ESP32 GPIO26 → 220Ω 저항 → LED → GND 로 연결합니다. 저항이 없으면 LED와 GPIO에 과전류가 흐릅니다.`,
    wiring: {
      type: 'wiring', title: 'ESP32 LED 깜빡이기',
      parts: [
        { ref: 'U1', part: 'esp32-devkitc' },
        { ref: 'R1', part: 'resistor-220', label: '전류 제한' },
        { ref: 'LED1', part: 'led-red' }
      ],
      connections: [
        { from: 'U1.GPIO26', to: 'R1.P1' },
        { from: 'R1.P2', to: 'LED1.A', note: '긴 다리' },
        { from: 'LED1.K', to: 'U1.GND1', note: '짧은 다리' }
      ],
      code: `void setup() { pinMode(26, OUTPUT); }\nvoid loop() { digitalWrite(26, !digitalRead(26)); delay(500); }`
    }
  }
];

export function demoReply(message, ctx) {
  if (message.startsWith('[요청 종류: 오류 진단]')) return demoDiagnose(ctx);
  if (message.startsWith('[요청 종류: 부품 등록]')) {
    return '데모 모드에서는 부품 등록을 할 수 없습니다. 설정에서 Copilot Studio 에이전트를 연결하면 데이터시트 내용으로 부품 JSON을 만들어 드립니다.';
  }
  const goal = message.split('\n\n[현재 배선]')[0];
  const d = DEMOS.find((x) => x.match.test(goal));
  if (!d) {
    return `(데모 모드) 지금은 Copilot Studio 에이전트에 연결되어 있지 않아 정해진 예시만 답할 수 있습니다.
"ESP32로 외부 전원으로 밸브 켜기", "온도를 읽어서 화면에 띄우기", "LED 깜빡이기", "라즈베리파이 LED" 처럼 물어보세요.
오른쪽 위 ⚙ 설정에서 에이전트를 연결하면 무엇이든 물어볼 수 있습니다.`;
  }
  return `${d.reply}\n\n\`\`\`json\n${JSON.stringify(d.wiring, null, 2)}\n\`\`\``;
}

// 데모용 진단: 학생이 "문제"로 판정한 항목을 바탕으로 측정값을 짚어 준다.
function demoDiagnose({ problems }) {
  if (!problems.length) {
    return '(데모 모드) 학생 판정에서 문제 항목이 없습니다. 실제 진단은 Copilot Studio 에이전트를 연결하면 받을 수 있습니다.';
  }
  return `(데모 모드) 다음 지점을 확인해 보세요. 연결된 에이전트는 원인(배선/코드/부품)과 수정 배선을 함께 제안합니다.\n\n${problems.map((p) => `- ${p}`).join('\n')}`;
}
