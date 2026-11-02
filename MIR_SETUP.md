# 미르 화면과 배선 API 연결

팀 저장소 `https://github.com/beuljag/mir.git`를 `mir/`에 클론했다.
로컬 작업 브랜치는 `integrate-circuit-api`이며 원격 저장소에는 올리지 않았다.
원본은 Electron 앱이다. 기존 Electron 실행 방식을 유지하면서 FastAPI에서 같은 화면을 제공한다.

## 열기

프로젝트 폴더의 **미르열기.bat**를 더블클릭한다.
기존 API가 실행 중이면 그대로 사용하고, 없으면 실행한 뒤 브라우저를 연다.

- 미르: http://127.0.0.1:8000/mir/
- 기존 테스트 화면: http://127.0.0.1:8000/
- API 문서: http://127.0.0.1:8000/docs
- 외부 터널과 함께 실행: 기존 **서버켜기.bat**

MCP 주소와 키는 그대로다. 새 MCP를 등록할 필요가 없다.
ApplyCircuitLayout이 반환하는 `editor_url`은 이제 `/mir/?circuit=회로ID`다.
상대 주소이므로 현재 서버 주소 앞에 붙여 연다. URL에는 API 키를 넣지 않는다.

## API에 저장된 회로 보기

1. 미르 상단 **배선 API · DB**를 누른다.
2. **서버 자동 연결됨** 표시를 확인한다. 키는 `.env`에서 읽으므로 입력하지 않는다.
3. Copilot Studio 도구 응답의 `circuit_id`를 입력하고 **DB에서 불러오기**를 누른다.
4. 창을 닫고 부품을 드래그하거나 핀을 차례로 눌러 배선을 편집한다.
5. **배선 API · DB → 현재 화면 DB 저장 → 서버 검증** 순서로 누른다.

DB 연결 정보와 Copilot 채팅 연결 정보는 별개다.
상단이 **데모 · AI 미연결**이면 채팅은 실제 에이전트를 호출하지 않고 정해진 예시만 반환한다.
펌프처럼 데모에 없는 요청은 다른 보드·장치로 대체하지 않으며, 실제 채팅 연결이 필요하다고 안내한다.
키 입력 없이 새로고침 후에도 로컬 서버에 자동 연결한다. `CIRCUIT_API_KEY`, `CIRCUIT_API_OWNER`는 `.env`에서 관리한다.
서버 키 파일, DB, 사람 검토 키, 로그를 Git이나 에이전트 지식에 올리지 않는다.

## Copilot Studio 채팅

### 현재 기본 모드: 서버 .env 비밀 키

`.env`의 `COPILOT_CHAT_MODE=directline`이 설정되어 있으면 Python 서버를 거치는 API 채팅을 기본으로 사용한다.
아래 웹사이트 연결은 선택 가능한 대안이다. 현재 설정 순서는 `DIRECTLINE_SETUP.md`를 따른다.

### 현재 PC에 연결한 중앙 에이전트 웹사이트

사용자가 제공한 `.../bots/cr72a_circuitcoordinator_IEnqiS/canvas?...&cliAgent=true` 주소를
`mir/renderer/agent-config.json`에 저장했다. 이 파일은 Git에서 제외한다.
서버 모드를 사용하지 않을 때 브라우저를 새로 열면 **중앙 에이전트 · 웹 채팅** 모드로 시작한다.
기존 창의 대화·배선은 새로고침 전에 필요한 내용을 보관한다.

- 오른쪽 Microsoft 웹 채팅에서 직접 설계를 요청한다.
- 에이전트가 MCP로 저장한 회로의 ID를 **배선 API · DB → DB에서 불러오기**에 입력한다.
- 다른 출처의 iframe 대화를 미르가 읽거나 응답 JSON을 자동 처리하지 않는다.
- **에이전트 웹사이트 열기**는 같은 주소를 별도 브라우저에서 연다.
- 링크를 넣는 것만으로 대화 권한이 생기지 않는다. 이번 확인에서는 Microsoft 페이지에
  `You don't have access to talk to this bot, contact the owner.`가 표시됐다.
  해당 에이전트를 사용할 수 있는 Microsoft 계정으로 웹사이트에서 실제 응답을 확인해야 한다.
- **연결 테스트**는 웹 URL 형식만 확인한다. 로그인·권한·MCP 호출 성공을 보장하지 않는다.
- API 키는 Microsoft 채팅 링크에 넣지 않는다. 로컬 서버의 `.env`에서 관리한다.
- Electron에서는 기존 사용자 설정이 있으면 그 설정을 우선한다. **연결 설정 → 에이전트 웹사이트**에서 URL을 넣어 변경한다.

### 에이전트 유형을 먼저 확인

2026-10-28 공식 문서 확인 기준, 아래 Direct Line 토큰 연결은 **클래식(standard harness)** 에이전트용이다.
클래식에서는 중앙 에이전트를 게시한 뒤 **채널 → 모바일 앱 → Token Endpoint 복사**로 URL을 얻는다.
미르 **연결 설정 → 토큰 끝점 URL → 붙여넣기 → 연결 테스트** 순서로 설정한다.

**기술·도구·지식**을 사용하는 새 에이전트 환경(GitHub Copilot harness)은
공식 채널 표에서 **Native app / Direct Line 미지원**, **Web app / iframe 지원**으로 안내한다.
해당 환경에는 이 토큰 URL 메뉴가 없을 수 있으며, 미르의 현재 Direct Line 클라이언트로 연결된다고 보장할 수 없다.
중앙 에이전트의 **게시 창 → 채널 설정**에서 Web app의 제공 항목을 먼저 확인한다.
현재 미르는 iframe 채팅 표시를 지원한다. 기존 JSON 자동 응답 해석과는 별도로 회로 ID를 수동 입력해 DB에서 불러온다.
그 전에도 Studio의 Preview에서 MCP로 저장한 회로 ID를 미르의 DB 창에 입력해 2D로 불러올 수 있다.

- [클래식 토큰 URL 안내](https://learn.microsoft.com/en-us/microsoft-copilot-studio/publication-connect-bot-to-custom-application)
- [새 에이전트의 지원 채널](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/publication-channels-overview)

미르 **연결 설정**의 클래식 옵션은 자연어 채팅을 위한 Direct Line 연결이다.
MCP는 Copilot Studio가 배선 API 도구를 호출하는 별도 연결이다.
브라우저 모드에서는 **토큰 끝점 URL**을 사용한다. Direct Line 비밀 키 입력은 막았다.
토큰 URL과 대화 토큰은 탭 메모리에만 보관하며, 서버나 브라우저 저장소에 저장하지 않는다.
현재 팀 에이전트는 제공받은 웹사이트를 표시한다. Direct Line 토큰 URL은 제공받지 않았으며 별도 방식이다.
웹 채팅은 Microsoft 권한 오류로 인해 실제 대화 성공을 확인하지 못했다.
토큰 발급 서비스가 브라우저 호출을 허용해야 한다. 데스크톱 모드의 기존 비밀 키 연결은 유지한다.

중앙 에이전트의 기존 지침 끝에 아래 내용을 추가한다.

```text
[미르 화면과 DB 동기화]
회로를 설계할 때 기존 역할 분담과 검증 절차를 따른다.
API로 저장한 회로가 최종 결과의 기준이다. 회로 ID, 버전, 검증 상태를 사용자에게 알려 준다.
CreateCircuitDraft / UpdateCircuit 후 ValidateCircuit을 실행하고,
passed가 아닌 초안의 ApplyCircuitLayout은 사용자의 명시적 초안 반영 요청이 있을 때만 호출한다.
반영 도구가 반환한 editor_url은 현재 배선 API 서버를 기준으로 한 상대 주소다.
최종 답변 끝에 다음 JSON 코드블록을 하나 넣으면 미르에서 DB 불러오기 버튼이 나타난다.
{"type":"circuit_reference","circuit_id":"실제로 저장한 회로 ID"}
ID를 만들거나 추측하지 않는다. 서버에 저장하지 못했다면 이 블록을 넣지 않는다.
미르 화면의 부품 목록은 표시용 자료다. 이를 검증된 DB 사양으로 취급하지 않는다.
```

## 데이터 변환과 제한

- API `component_instances` → 미르 `instances`, `layout` → 위치.
- API의 다중 핀 `nets` → 같은 전기 연결을 나타내는 여러 선.
- 미르의 선 → 연결 그룹을 계산하여 API `nets`로 저장.
- 연결이 같으면 net ID를 유지한다. 변경한 그룹에는 새 ID를 준다.
- 요구사항과 회전 수치는 유지하지만 그림의 회전 표시는 아직 지원하지 않는다.
- 버전 충돌(409)이 나면 덮어쓰지 않는다. 현재 편집을 파일로 내보내고 최신 회로를 불러와 다시 반영한다.
- API 형식에는 선의 꺾임·개별 선 메모·부품 별명·채팅·예제 코드가 없다. 화면 파일 저장은 이 중 미르 형식의 배선 정보를 보관하는 별도 기능이다.
- 기본 부품 13개는 팀원이 만든 화면 자료다. 승인 없이 부품 DB에 자동 등록하지 않는다.
  DB에 없는 부품도 회로 초안에 참조해 저장할 수 있지만 서버 검증에서는 미등록 오류가 난다.
  검증된 부품은 기존 자료 조사 → 사람 검토 절차로 등록한다.
- API 부품은 범용 그림으로 표시한다. 핀 ID가 일치하는 미르 그림이 있으면 해당 그림을 재사용한다.
- DB 불러오기는 수동이다. 에이전트나 다른 창의 변경을 자동으로 덮어쓰거나 실시간 구독하지 않는다.
- 미르의 가상 전원은 기존 간이 계산 기능이다. 서버 규칙 검증이나 SPICE, 실제 부품 시험을 대신하지 않는다.
- 브라우저에서 추가한 부품은 탭을 닫으면 사라진다. JSON을 내려받아 보관하고 다시 불러온다.

## 개발 검증

```powershell
& 'C:\Program Files\nodejs\node.exe' --test mir/tests/circuit-api.test.mjs
.\.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```

Electron으로 실행하려면 `mir` 폴더에서 기존 `npm install`, `npm start`를 사용한다.
이번 연결의 화면 검증 대상은 브라우저 모드다. 설치 파일(.exe) 빌드와 Electron 실제 실행은 확인하지 않았다.


## 가져온 KiCad 파일 검증
배선 API·DB 창의 KiCad 파일 검증을 사용합니다. 회로도와 하위 회로도·모델 파일을 가져오거나 프로젝트 폴더를 선택할 수 있습니다. 주 회로도를 고른 뒤 ERC와 선택 ngspice 검사를 실행합니다. 실제 실행에는 KiCad와 ngspice를 설치하고 .env 실행 경로를 지정해야 합니다. 자세한 범위와 사용법은 KICAD_VERIFICATION_SETUP.md를 참고하세요.
