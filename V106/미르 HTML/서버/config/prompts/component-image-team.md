# 미르 부품 기본 그림 디자인 양식

사용자가 2026-10-28에 제공한 최신 양식을 기준으로 한다.
그림은 renderer/art.js가 SVG 요소로 그리고, 색과 글꼴은 renderer/styles.css의 재료 클래스로 정한다.
이전 GitHub 양식은 component-image-team-v1.md에 보존했다.

## 1. 공통 규칙

### 크기와 배치 (renderer/canvas.js의 layoutPart)
- 핀 간격 18px, 위쪽 제목 영역 30px, 아래 여백 10px.
- 핀은 왼쪽·오른쪽 가장자리에 세로로 놓고, 위·아래 핀은 가로로 같은 간격을 두고 놓는다.
- 최소 폭은 보드 170px, 그 밖의 부품 110px. 핀 이름과 부품 이름 길이에 따라 폭이 늘어난다.
- 몸체 상자는 모서리가 둥근(8px) 사각형이고 표시용 color로 칠한다.
- 그림은 핀 좌표를 기준으로 그린다. 저장 후 핀 목록을 바꾸면 사양을 다시 조회하고 재제작한다.

### 두 가지 유형
| 유형 | 해당 부품 | 모양 |
|---|---|---|
| PCB형 | 보드, 센서, 모듈, 릴레이, OLED | 색 있는 기판 + 흰 실크 테두리 + 네 귀퉁이 나사 구멍 + 금색 패드 |
| BARE형 | LED, 저항, 다이오드, 버튼, 밸브, 어댑터 | 바탕 투명, 리드나 전선으로 핀에 바로 연결 |

### 글자
- 고정폭 글꼴. 기본 9px, 칩 이름 12px 굵게, 작은 표기 8px.
- 기본 글자색은 밝은 회색, 금속 위에서는 어두운 글자.
- 부품 제목과 핀 이름은 앱이 표시한다. 그림에는 중복 작성하지 않는다.
- 그림 안에는 확인된 칩 이름·모델명·정격을 text로 작성할 수 있다.

## 2. 재료 색
| 재료 | 색 | 용도 | SVG 클래스 |
|---|---|---|---|
| 금 | #C9A43A | 패드, 구멍 테두리, 안테나 | pad / antenna |
| 실크 | 흰색 35% 투명 | PCB 안쪽 테두리 | silk |
| 핀 헤더 | #151B23 | 보드 양옆 헤더 | header |
| 금속 / 어두운 금속 | #C8D0DA / #96A1B0 | 실드, USB/LAN, 나사 | shield / metal / metal-dark |
| IC | #232B36 | RAM, 레귤레이터, 칩 | ic |
| 흰 플라스틱 | #F7F9FB | DHT22 하우징 | housing |
| 릴레이 / 단자대 | #4E97DA / #155EA3 | 릴레이 상자, 나사 단자 | relay-box / terminal |
| 소자 다리 | #96A1B0, 굵기 2.5 | LED·저항·다이오드 리드 | lead |
| 저항 몸체 | #D8C29A | 베이지 몸체 | resistor-body |
| 구리 / 황동 | #B87333 / #C8A04A | 코일 띠, 밸브·배관 | coil-band / brass / pipe |
| 전선 + / - | #C6423C / #151B23 | 밸브·어댑터 케이블 | cable cable-red / cable cable-black |

저항 색띠: 검정 #1A1A1A, 갈색 #7B4A23, 빨강 #D0312D, 주황 #F07F13, 노랑 #F2C200,
초록 #2E9E4F, 파랑 #2563EB, 보라 #7C3AED, 회색 #8A8A8A, 흰색 #F5F5F5, 금 #C9A43A.
behavior.ohms가 있으면 앱이 저항값으로 색띠를 계산한다. 저항값을 임의로 만들지 않는다.

## 3. 부품별 그림
| 부품 | 기판색 | 그림 구성 |
|---|---|---|
| ESP32 DevKitC | #1d3557 남색 | 양옆 헤더, 은색 실드 ESP32 / WROOM-32, 지그재그 안테나, EN·BOOT, 아래 USB |
| Raspberry Pi 4 | #7a1f3d 자주 | 양옆 헤더, 은색 BCM2711, RAM, 아래 LAN 1개 + USB 2개 |
| BME280 | #5b2a86 보라 | PCB, 은색 정사각 센서 칩, 아래 칩 이름 |
| DHT22 | #e9edf2 흰색 | PCB, 흰 하우징, 격자 구멍 |
| SSD1306 OLED | #0b132b 남색 | PCB, 전원에 따라 내용이 표시되는 화면 |
| 5V 릴레이 | #1565c0 파랑 | PCB, 파란 SRD-05VDC 상자, 오른쪽 나사 단자대 |
| LED | 투명 | 리드 2개 + 반구 돔. 꺼지면 35%, 켜지면 100% + 빛 번짐 |
| 저항 220Ω / 10kΩ | 투명 | 리드, 둥근 베이지 몸체, 색띠 4줄 |
| 다이오드 1N4007 | 투명 | 리드, 검은 몸체, 캐소드 쪽 흰 띠 |
| 택트 스위치 | 투명 | 리드, 어두운 사각 몸체, 둥근 캡(누르면 주황) |
| 12V 솔레노이드 밸브 | 투명 | 빨강·검정 전선, DC 12V 코일, 구리 띠, 황동 밸브·배관(켜지면 파랑) |
| 12V 어댑터 | 투명 | 빨강·검정 전선, 검은 12V ⎓ 2A 몸체, 전원 표시등(켜지면 초록) |

기존 기본 그림은 look이 있으면 우선 사용하고, 없으면 behavior.kind와 id로 고른다.
맞는 그림이 없으면 module(PCB + 작은 칩)을 그린다. 새 생성물은 presentation.kind/color로 외형을 정한다.
예시 모델·정격은 해당 부품만의 표기다. 다른 부품에 복사하지 않는다.

## 4. 상태와 테마
- 선택: 파란 테두리 3px. BARE는 파란 점선.
- AI 수정안: 초록 점선, 85% 불투명도.
- 블랙 모드: 82% 밝기.
- 핀 테두리: 전원 빨강, GND 검정, NC 회색 점선.
- 배선: 전원 빨강, GND 검정(블랙 모드 밝은 회색), SDA 파랑, SCL 주황, 신호 초록.
- 생성 SVG의 led-dome/tact-cap/pipe는 기존 시뮬레이션 lit/pressed/on 상태를 반영한다.
- state-on/state-off/state-powered/state-unpowered는 기존 결과에 따라 표시·숨김한다.
- resistor-band 4개는 기존 behavior.ohms로 색을 계산한다. 값이 없으면 생성 SVG의 정적 색을 유지한다.
- 이미지 제작은 전기 사양이나 시뮬레이션 behavior를 자동 등록하지 않는다.

## 5. AI에게 줄 요청문 (자동 API용)
GetComponentImageSpec의 layout, presentation, allowed_classes를 사용해 한 부품의 SVG를 직접 작성한다.
width/height/viewBox는 반환값과 정확히 맞춘다. presentation은 SaveComponentSvg에 그대로 넣는다.
PCB의 바탕·실크·나사 구멍·금 패드는 서버가 추가하므로 세부 몸체만 그린다.
BARE는 바탕을 칠하지 않고 리드/전선을 layout의 핀 좌표에 잇는다.
제목 30px와 하단 상태 표시 자리를 확보한다.
허용 태그는 svg,g,rect,circle,ellipse,line,polyline,polygon,path,text다.
몸체 글자는 art-text(9px), art-text strong(12px 굵게), art-text tiny(8px)를 사용한다.
밝은 금속 위에는 dark, 투명 부품의 테마 대응 글자는 on-canvas를 추가한다.
한 text는 최대 80자, 폰트는 monospace, 크기는 8/9/12px다.
예: <text x="80" y="60" text-anchor="middle" class="art-text strong dark">ESP32</text>
좌표는 실제 크기에 맞춰 바꾼다. 핀 이름과 부품 제목은 그림에 중복 작성하지 않는다.
script/style/image/use/외부 URL/웹폰트/필터/그라데이션/애니메이션 코드는 넣지 않는다.
확인하지 않은 핀·정격·극성을 만들거나 이미지를 전기 검증 근거로 쓰지 않는다.
