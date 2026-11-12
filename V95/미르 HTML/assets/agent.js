// Copilot Studio 에이전트와 주고받는 메시지 형식.
// 에이전트 쪽 지침은 docs/Copilot-Studio-지침.md 에 있다.

export const FORMAT_REMINDER = `[응답 형식]
배선 설계를 요청받으면 부품·이미지 등록만으로 작업을 끝내지 마세요. 사용자 목표의 전원·GND·신호 연결까지 설계합니다.
1. 부품id와 핀id는 [부품 목록] 또는 MCP로 생성·조회한 실제 DB 정의만 사용합니다. 부족한 부품은 조사 → CreateComponent → 이미지 제작·적용 후 회로 설계로 계속 진행합니다. 기존 부품의 pins=[]도 미완성 정의입니다. 공식 핀맵을 조사하고 확인된 핀으로 새 request_id의 새 정의를 저장해 사용합니다. 일반 모델명을 특정 버전으로 해석했다면 초안의 모델 가정을 명시합니다.
2. MCP를 사용할 수 있으면 CreateCircuitDraft(수정은 UpdateCircuit)로 component_instances/nets/layout을 실제 저장하고, ValidateCircuit의 상태를 설명합니다. 미검증 초안 표시에는 ApplyCircuitLayout의 allow_unvalidated_draft=true를 사용합니다. 검증 통과를 꾸며내지 않습니다.
3. 마지막에 실제 저장 결과를 JSON 코드블록으로 반환합니다: {"type":"circuit_reference","circuit_id":"저장된 실제 회로 ID","version":실제버전}. 부품 ID나 이미지 ID를 회로 ID로 쓰지 마세요. 미르가 이 ID로 배선 그림을 불러옵니다.
4. MCP로 회로를 저장하지 못했으나 확인된 핀으로 화면용 초안을 만들 수 있으면 기존 형식 {"type":"wiring","title":"...","parts":[{"ref":"U1","part":"부품id","label":"역할"}],"connections":[{"from":"U1.핀id","to":"R1.핀id","note":"이유"}],"steps":["..."],"warnings":["..."],"code":"..."}을 JSON 코드블록으로 반환합니다. LED 색은 parts의 props.color, 저항값은 props.ohms로 유지·변경하고 수정안도 전체 배선을 반환합니다. 이때 DB 저장 완료라고 말하지 마세요.
5.  조사 후보의 unresolved_fields나 agent_extraction_tasks는 검토·추출 항목이지 사용자 필수 입력 목록이 아닙니다. document_sections와 evidence를 읽어 실제 확인할 수 있는 내용을 먼저 추출합니다. 상품명 전체 문자열이 일치하지 않아도 source.title, source_title_identifiers, identifier_matches로 모델을 재확인합니다. 사용자 메시지에 제시된 OUT·VCC·GND 같은 핀 표기는 근거로 반영하고 같은 표기를 다시 나열하라고 묻지 않습니다. 확인된 핀 역할과 아직 확인되지 않은 전원 정격·제품 변형은 별도로 취급합니다. 질문보다 조사를 먼저 합니다. 1) SearchComponents/GetComponentDetails로 DB와 출처를 확인하고, 모델로 찾을 수 있는 핀맵·핀 기능·동작 전압·정격·데이터시트는 검색 에이전트와 웹 검색/ResearchComponent/AnalyzeDatasheet로 직접 조사합니다. 비어 있는 pins나 unresolved_fields를 그대로 사용자에게 채우라고 요구하지 않습니다. 2) 조회한 실제 공식 자료와 작업 결과를 확인해 부품 정의를 보완하고 설계를 계속합니다. 검색 수단이 없거나 실패하면 성공했다고 꾸미지 않습니다. 3) 조사해도 실제 사용할 제품을 특정할 수 없을 때만 최소한의 식별 정보(모델명·제조사·모듈 변형)를 묻습니다. 예: 태양광 패널의 모델명을 알려주세요. 모델을 받으면 Voc와 핀 정보는 다시 직접 조사하고, 공개 자료로 알 수 없는 실제 제품의 값만 추가로 묻습니다. 사용자가 핀 이름·핀 개수·핀 기능을 전부 나열하도록 요구하지 않습니다. 사용자 제작 보드처럼 공식 자료가 없는 경우에만 자료 링크나 핀맵을 요청할 수 있습니다. 4) 이 확인 질문에는 필요한 부품명과 항목만 짧게 쓰고 오류 위치·내부 도구·실패 원인 설명을 붙이지 않습니다. 최종 JSON은 {"type":"clarification","questions":["태양광 패널의 모델명을 알려주세요."]}로 반환합니다. 사양을 추측하거나 확인 전 배선을 확정하지 않습니다. 단순 질문이나 부품 등록만 요청한 경우 불필요한 회로를 만들지 않습니다.
6. 모터와 외부 전원에는 다음 규칙을 우선 적용합니다. 모터는 제품 식별에 필요한 종류와 모델명 중 빠진 항목만 묻습니다. 정격 전압·전류, 기동·스톨 전류, 핀맵과 사용법은 모델로 DB와 제조사 자료를 직접 조사합니다. 확인하지 못한 정격은 미확인으로 남기고, 그 값이 필요한 실제 배선은 확정하지 않습니다. 정격이나 핀 정보를 사용자에게 요구하지 않습니다. 외부 전원이 필요하고 사용자가 종류를 지정하지 않으면 배터리를 기본으로 사용합니다. 파워서플라이 등 다른 전원을 지정하거나 나중에 변경하면 그 선택에 맞춰 설계를 갱신합니다. 일반 외부 전원의 모델명이나 전압별 핀 유무를 묻지 않습니다. 확인된 부하와 드라이버 사양에 맞춰 필요한 출력 전압과 전류 용량을 선정합니다. 파워서플라이는 출력 설정값과 +/− 출력 단자로 표현하고, 기기별 단자 배치나 출력 범위를 확인하지 못하면 필요한 조건만 안내합니다.`;


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
    lines.push(`${d.id} | ${d.name} | ${pins.join(', ')}${d.isDraft ? ' [미검증 설계 부품' + (d.unresolvedFields?.length ? ': ' + d.unresolvedFields.join(', ') : '') + ']' : ''}`);
  }
  return lines.join('\n');
}

export function wiringSnapshot(state, defs) {
  return {
    type: 'wiring',
    title: state.title || '',
    parts: state.instances.map((i) => ({ ref: i.ref, part: i.part, ...(i.label ? { label: i.label } : {}), ...(i.props ? { props: i.props } : {}) })),
    connections: state.wires.map((w) => ({ from: w.from, to: w.to, ...(w.note ? { note: w.note } : {}) }))
  };
}

export function buildRecommendRequest(goal) {
  return `[요청 종류: 배선 추천]\n사용자 목표: ${goal}\n\n${FORMAT_REMINDER}`;
}

export function buildChatRequest(text, snapshot) {
  if (!snapshot) return `${text}\n\n${FORMAT_REMINDER}`;
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
  const circuit = blocks.find((b) => b && (typeof b.circuit_id === 'string' || (typeof b.id === 'string' && Array.isArray(b.component_instances))));
  const clarification = blocks.find((b) => b?.type === 'clarification' && Array.isArray(b.questions)
    && b.questions.length > 0 && b.questions.every((q) => typeof q === 'string' && q.trim()));
  if (clarification) return { text: clarification.questions.map((q) => q.trim()).join('\n'), clarification };
  return { text: plain.trim(), wiring, part, circuit };
}

// ---------- 데모 모드 (에이전트 연결 전 체험용) ----------
const DEMOS = [
  {
    id: 'valve',
    board: 'esp32',
    match: /밸브|솔레노이드|valve|solenoid/i,
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
    id: 'climate',
    board: 'esp32',
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
    id: 'led',
    board: 'raspberry',
    match: /led|엘이디|불빛|깜빡/i,
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
    board: 'esp32',
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

export function getBuiltInWiring(id) {
  return DEMOS.find((example) => example.id === id)?.wiring;
}

export function demoReply(message, ctx = {}) {
  if (message.startsWith('[요청 종류: 오류 진단]')) return demoDiagnose(ctx);
  if (message.startsWith('[요청 종류: 부품 등록]')) {
    return '데모 모드에서는 부품 등록을 할 수 없습니다. 설정에서 Copilot Studio 에이전트를 연결하면 데이터시트 내용으로 부품 JSON을 만들어 드립니다.';
  }
  // 프롬프트의 응답 양식·현재 배선에 들어 있는 예시 단어는 요청으로 해석하지 않는다.
  const goal = message.split(/\[현재 배선\]|\[응답 형식\]/)[0];
  const raspberry = /라즈베리|raspberry|\brpi\b/i.test(goal);
  const esp32 = /esp\s*32/i.test(goal);
  const board = raspberry ? 'raspberry' : 'esp32';
  const prefix = '(데모 모드 · 실제 AI 응답이 아닙니다)';
  if (/펌프|pump/i.test(goal)) {
    const controller = raspberry && !esp32 ? '라즈베리파이' : esp32 && !raspberry ? 'ESP32' : '요청한 보드';
    return `${prefix}\n\n${controller}로 외부 전원을 사용하는 펌프를 켜고 끄려는 요청입니다.\n현재 저장된 데모에는 펌프 회로가 없어 배선을 생성하지 않았습니다.\n\n펌프 모델·정격 전압·정격 전류와 파워서플라이 사양을 준비하고, 에이전트 연결 탭에서 Copilot Studio를 연결해 설계를 요청하세요. 기존 ESP32 밸브 예시로 바꾸지 않습니다.`;
  }
  const unsupportedBoard = /아두이노|arduino|피코|\bpico\b|stm32|micro:bit|마이크로비트/i.test(goal);
  const d = !unsupportedBoard && !(raspberry && esp32)
    ? DEMOS.find((x) => x.board === board && x.match.test(goal)) : undefined;
  if (!d) {
    return `(데모 모드) 지금은 Copilot Studio 에이전트에 연결되어 있지 않아 정해진 예시만 답할 수 있습니다.
"ESP32로 외부 전원으로 밸브 켜기", "온도를 읽어서 화면에 띄우기", "LED 깜빡이기", "라즈베리파이 LED" 처럼 물어보세요.
입력한 보드와 장치를 다른 예시로 바꾸지는 않습니다. 에이전트 연결 탭에서 실제 에이전트를 연결하세요.`;
  }
  return `${prefix}\n\n${d.reply}\n\n\`\`\`json\n${JSON.stringify(d.wiring, null, 2)}\n\`\`\``;
}

// 데모용 진단: 학생이 "문제"로 판정한 항목을 바탕으로 측정값을 짚어 준다.
function demoDiagnose({ problems = [] }) {
  if (!problems.length) {
    return '(데모 모드) 학생 판정에서 문제 항목이 없습니다. 실제 진단은 Copilot Studio 에이전트를 연결하면 받을 수 있습니다.';
  }
  return `(데모 모드) 다음 지점을 확인해 보세요. 연결된 에이전트는 원인(배선/코드/부품)과 수정 배선을 함께 제안합니다.\n\n${problems.map((p) => `- ${p}`).join('\n')}`;
}
