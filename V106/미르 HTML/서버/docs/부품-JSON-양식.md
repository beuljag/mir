# 부품 JSON 양식

부품 하나 = JSON 파일 하나입니다. 부품함의 **⋯ → 부품 양식 파일 저장**으로 빈 양식을 받아 채운 뒤,
**+ 파일** 버튼으로 추가하면 부품함과 AI 추천에 바로 쓰입니다.
(추가한 파일은 `내 부품 폴더`에 복사됩니다. 같은 id면 기본 부품보다 우선합니다.)

## 기본 구조

```json
{
  "id": "my-sensor",
  "name": "내 센서 모듈",
  "category": "sensor",
  "description": "핵심 사양 요약",
  "color": "#2a9d8f",
  "behavior": { "kind": "sensor", "vcc": "VCC", "gnd": "GND", "signal": "OUT" },
  "pins": [
    { "id": "VCC", "label": "VCC", "side": "left", "type": "power_in", "minVoltage": 3.3, "maxVoltage": 5.5, "functions": ["전원"] },
    { "id": "GND", "label": "GND", "side": "left", "type": "gnd" },
    { "id": "OUT", "label": "OUT", "side": "left", "type": "output", "voltage": "VCC", "functions": ["디지털 출력"] }
  ],
  "internalNets": [],
  "sources": ["제조사 데이터시트"]
}
```

## 항목 설명

| 항목 | 필수 | 설명 |
|---|---|---|
| `id` | ✔ | 영문 소문자·숫자·하이픈. AI가 이 id로 부품을 부릅니다 |
| `name` | ✔ | 화면에 보이는 이름 |
| `category` | | board, sensor, display, output, input, module, actuator, power, passive |
| `pins` | ✔ | 핀 목록 (아래) |
| `behavior` | | 가상 전원에서 어떻게 반응할지 (아래) |
| `internalNets` | | 부품 안에서 서로 이어진 핀. 예: `[["GND1","GND2"]]` |
| `logicVoltage` | | 보드의 로직 전압 |
| `sources` | | 근거 자료 (데이터시트 이름/링크) |

### 핀

| 항목 | 설명 |
|---|---|
| `id` | 핀 이름(부품 안에서 중복 금지). 배선은 `U1.GPIO23`처럼 `ref.id`로 씁니다 |
| `label` | 화면 표시 이름 |
| `side` | left / right / top / bottom |
| `type` | `power_out` 전원 출력 · `power_in` 전원 입력 · `gnd` · `gpio` 입출력 · `input` · `output` · `passive` 단자 · `contact` 릴레이 접점 · `nc` 사용 금지 |
| `voltage` | 출력/로직 전압(숫자) 또는 `"VCC"`(전원 핀 전압을 따름) |
| `minVoltage` / `maxVoltage` | 허용 전압 범위 — 학생이 측정값과 비교하는 기준 |
| `functions` | 기능 목록. `I2C SDA`, `I2C SCL`, `UART TX` 처럼 쓰면 AI와 색 구분에 쓰입니다 |
| `note` | 주의 사항 (스트래핑 핀 등) |

### behavior.kind

| kind | 추가 항목 | 가상 전원에서의 반응 |
|---|---|---|
| `board` | | USB 전원으로 항상 켜짐. power_out/gnd 핀이 전원이 되고, GPIO는 패널에서 HIGH/LOW 설정 |
| `supply` | | power_out 핀이 전원 |
| `sensor` | vcc, gnd, signal | VCC가 들어오면 측정 중 표시, `voltage:"VCC"` 출력 핀이 VCC 전압이 됨 |
| `i2c-device` | vcc, gnd, sda, scl, display(선택) | 전원 + 보드 SDA/SCL 연결 시 통신 중(화면이면 글자 표시) |
| `led` | anode, cathode, color, forwardVoltage | 순방향 전압이 걸리면 켜짐, 저항 없으면 과전류 표시 |
| `resistor` | ohms | 한쪽 전압을 다른 쪽으로 전달(전류 제한) |
| `button` | a, b | 가상 전원 ON에서 클릭하면 눌림 |
| `relay` | vcc, gnd, in, com, no, nc, trigger(high/low), minTrigger | 코일 전원 + IN 신호면 COM↔NO, 아니면 COM↔NC |
| `load` | plus, minus, ratedVoltage, label, onText, offText | 정격의 75% 이상 걸리면 동작 (모터·밸브·부저) |
| `diode` | anode, cathode | 전원 두 레일 사이 정방향 직결이면 단락 표시 |

> 이 시뮬레이션은 "어느 선에 몇 V가 걸리는지"를 보여 주는 간이 모델입니다. 실제 전류·타이밍은 계산하지 않습니다.
