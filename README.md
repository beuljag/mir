# 미르 (PLAYLABS)

임베디드 입문자를 위한 배선 가이드와 2D 가상 실습 프로그램입니다. 만들고 싶은 회로를 말하면 AI가 배선을 제안하고, 학생은 가상 전원과 GPIO로 직접 확인하며 배웁니다.

2026 충남 직업계고 Microsoft AI 에이전톤 · 아산스마트팩토리마이스터고 PLAYLABS 팀

| 단계 | 누가 | 내용 |
|---|---|---|
| 1. 배선 추천 | **AI** (Copilot Studio 에이전트) | 목표·보드·센서를 말하면 배선을 제안하고 2D 제작대에 그림 |
| 2. 가상 실습 | **사람** | 가상 전원을 켜고 GPIO를 HIGH/LOW로 바꾸며 배선을 직접 편집·확인 |
| 3. 진단과 수정 | **AI·사람** | 이상한 점을 알려 주면 AI가 수정안을 제시하고, 미리보기를 확인한 뒤 적용 |

현재 버전은 **V106**입니다. 저장소에는 `V106/` 폴더 하나만 있습니다.

## 바로 사용하기

| 방법 | 안내 |
|---|---|
| **웹** | [미르 실행하기](https://mir-production-11d1117d.up.railway.app) (PC·모바일 브라우저) |
| **Windows 앱** | [mir-V106.exe 다운로드](V106/EXE/mir-V106.exe) (설치 없이 실행하는 portable EXE, 약 75MB) |
| **HTML 직접 열기** | [`V106/미르 HTML`](V106/미르%20HTML) 폴더 전체를 내려받아 `미르 HTML.html`을 브라우저로 열기 |

- EXE의 SHA-256은 [`V106/EXE/SHA256.txt`](V106/EXE/SHA256.txt)에 있습니다. 코드 서명을 하지 않아 처음 실행할 때 Windows 경고가 뜰 수 있습니다.
- EXE에는 웹과 같은 V106 제작대와 튜토리얼이 들어 있습니다. Python API 서버·KiCad·ngspice는 포함되어 있지 않습니다.
- GitHub **Releases**에는 아직 V93·V95까지만 올라가 있습니다. V106 EXE는 저장소의 `V106/EXE` 폴더에서 받으세요.

## 처음 사용하는 경우: LED 튜토리얼

1. 빈 제작대에서 **LED 튜토리얼 바로 시작**을 누릅니다.
2. 부품함에서 ESP32, 220Ω 저항, LED를 꺼내고 안내에 따라 세 배선을 연결합니다.
3. 가상 전원을 켜고 GPIO26을 HIGH/LOW로 바꾸며 LED를 켜고 끕니다.

튜토리얼은 AI·로그인·API 키 없이 진행됩니다. 자세한 내용은 [튜토리얼 안내](V106/미르%20HTML/docs/V106_TUTORIAL.md)를 참고하세요.

## 사용법

- **배선 추천:** 오른쪽 채팅에 만들고 싶은 회로를 설명합니다. (예: "ESP32로 외부 전원을 써서 밸브를 켜고 싶어")
- **배선 편집:** 핀을 클릭한 뒤 다른 핀을 클릭하면 선이 연결됩니다. 선이나 부품을 선택하고 Delete로 지우며, Ctrl+Z/Ctrl+Y로 되돌리거나 다시 실행합니다.
- **부품함:** 부품을 검색해 클릭하거나 제작대로 끌어 놓습니다.
- **가상 전원:** 전원을 켜고 보드 GPIO를 HIGH/LOW로 바꿉니다. 화면의 반응은 가상 계산이며 실제 하드웨어 검증을 대신하지 않습니다.
- **진단 요청:** 이상한 점을 적고 진단을 요청합니다. AI 수정안은 미리보기로 확인한 뒤 적용해야 바뀝니다.
- **프로젝트 보관:** 파일 메뉴에서 저장하거나 다른 프로젝트를 가져옵니다.
- **화면 설정:** 설정에서 배선 모양, 메인 색상, 라이트/다크 모드를 바꿉니다.

## AI·DB 서버 연결

배선 추천, 진단, 부품 DB는 공유 서버가 실행 중이어야 사용할 수 있습니다. 제작대와 튜토리얼은 서버 없이도 쓸 수 있습니다.

- 호스팅된 웹은 승인된 공유 서버의 공개 연결을 중계합니다. 일반 사용자는 API 키나 로그인 정보를 입력하지 않습니다.
- 실제 API 키와 Copilot 비밀 값은 서버 환경 변수에서만 관리합니다. HTML, JavaScript, EXE, GitHub 소스에는 넣지 않습니다.
- 로컬 파일로 연 HTML에서 원격 서버에 연결하려면 서버가 그 접속을 허용해야 합니다.

참고 문서:

- [키 없는 연결 안내](V106/미르%20HTML/docs/V106_KEYLESS_CONNECTION.md)
- [Railway 배포·환경 변수·복구 안내](V106/미르%20HTML/docs/RAILWAY_DEPLOYMENT.md)
- [서버 연결 시스템 개선 지침](V106/미르%20HTML/docs/CONNECTION_SYSTEM_GUIDELINES.md)

## 부품 추가

기본 부품에는 ESP32, Raspberry Pi, 온습도 센서, OLED, LED, 저항, 버튼, 릴레이, 솔레노이드 밸브 등이 있습니다.

부품함의 양식 저장과 파일 추가 기능으로 JSON·그림을 가져올 수 있습니다. [부품 안내](V106/미르%20HTML/docs/부품%20안내.html)를 참고하세요. 실제 부품을 연결하기 전에는 제조사 사양과 핀 배치를 따로 확인하세요.

## 폴더 구성

```text
V106/
  README.md                V106 요약
  EXE/
    mir-V106.exe           Windows portable 실행 파일
    SHA256.txt             실행 파일 해시
  미르 HTML/               웹판 (Railway 배포 대상)
    미르 HTML.html         웹 제작대
    미르.css · 미르.js     스타일과 브라우저 번들 (미르.js는 빌드 결과물)
    entry.js · assets/     웹 소스 (app.js, canvas.js, sim.js, led-tutorial.js 등)
    docs/                  튜토리얼·연결·부품·배포 안내
    serve.cjs              Node.js 웹 실행기와 서버 중계
    서버/                  Python 배선 API (FastAPI)와 기본 부품
    tests/                 웹·서버 검사
  개발소스/
    Electron/              V106 Windows 실행기 소스 (web/에 웹판 번들 포함)
    기존데스크톱/          이전 데스크톱 앱 소스 (보존용, V106 빌드에는 쓰지 않음)
  검사결과/
    EXE-검사.md            V106 EXE 실제 실행 검사 기록
```

## 개발자용

### 웹판 (`V106/미르 HTML`)

Node.js 20 이상이 필요합니다. 아래 명령은 모두 **`V106/미르 HTML` 폴더에서** 실행합니다.

```sh
npm ci
```

```sh
npm start
```

브라우저에서 <http://127.0.0.1:8791>에 접속합니다.

- `npm run build`: `entry.js`와 `assets/`에서 `미르.js` 번들을 다시 만듭니다. `미르.js`를 직접 고치지 말고 소스를 고친 뒤 빌드하세요.
- `npm test`: 웹 검사
- `npm run test:server`: Python 서버 검사 (`서버/requirements.txt` 설치 후)
- `npm run sync:html -- "<원본 폴더>"`: 다른 MIR HTML 원본을 가져옵니다. 서버·배포·인증 어댑터(`web-api.js`, `server-connection.js`)는 보존됩니다.

main에 병합하면 Railway 자동 배포가 실행될 수 있으니, 검토 브랜치에서 먼저 검사하세요. 자세한 규칙은 [`V106/미르 HTML/AGENTS.md`](V106/미르%20HTML/AGENTS.md)에 있습니다.

### Python 서버 (`V106/미르 HTML/서버`)

```sh
pip install -r requirements.txt
```

```sh
python run.py
```

기본 주소는 `http://127.0.0.1:8000`입니다. 환경 변수는 `서버/.env.example`을 참고해 로컬 `.env`에 설정합니다. 실제 키, 로그, 데이터베이스는 저장소에 올리지 않습니다.

### Windows EXE (`V106/개발소스/Electron`)

```sh
npm install
```

```sh
npm run dist
```

Electron 33.4.11과 electron-builder 25.1.8을 사용하며, 결과물은 `V106/EXE/mir-V106.exe`입니다. 웹 UI를 바꿨다면 웹판에서 번들을 먼저 다시 만들고 `web/`에 반영하세요. 자세한 내용은 [EXE 제작 안내](V106/개발소스/Electron/README.md)와 [EXE 검사 기록](V106/검사결과/EXE-검사.md)을 참고하세요.

## 함께 작업하는 방법

1. `main`에서 바로 작업하지 말고 작업용 브랜치를 만듭니다.
2. 한 번에 한 가지 변경만 하고, 위의 검사 명령을 실행합니다.
3. PR을 만들고 무엇을 바꿨는지, 어떻게 확인했는지, 확인하지 못한 것은 무엇인지 적습니다.
4. 직접 실행해 확인하고 팀원의 검토를 받은 뒤 병합합니다.

비밀번호, API 키, 개인정보는 코드·이슈·PR·화면 캡처에 넣지 않습니다.
