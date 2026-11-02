# .env의 비밀 키로 Copilot Studio 연결

## 키 넣기

프로젝트 루트의 `.env`를 열고 다음 줄의 `=` 뒤에 **Copilot Studio Direct Line 비밀 키**를 넣는다.

```dotenv
COPILOT_DIRECT_LINE_SECRET=
COPILOT_DIRECT_LINE_DOMAIN=https://directline.botframework.com/v3/directline
COPILOT_CHAT_MODE=directline
CIRCUIT_API_KEY=기존_배선_API_키
CIRCUIT_API_OWNER=local-user
```

키 위치는 해당 에이전트의 **설정 → 보안 → 웹 채널 보안 → Secret 1 또는 Secret 2**다.
이 메뉴에서 발급한 Direct Line 비밀 키여야 한다. 지원되는 에이전트·채널에서 발급한 키가 필요하다.
MCP에 쓰는 배선 API 키, 에이전트 웹사이트 주소, 잠시 발급받은 대화 토큰은 이 자리에 넣지 않는다.
키는 채팅으로 보내지 않고 로컬 파일에서 직접 입력한다. `.env`는 Git에서 제외하며 웹으로 제공하지 않는다.

Direct Line 키는 요청할 때 파일을 다시 읽으므로 **키를 넣고 파일만 저장하면 된다.**
배선 API 키와 owner는 시작 시 읽는다. 값을 바꾸면 로컬 서버를 재시작한다.
현재 PC의 기존 배선 키와 사람 검토 키는 `.env`로 복사했으며 원래 키 파일도 유지한다.
운영체제에 같은 이름의 환경 변수가 있으면 해당 값이 `.env`보다 우선한다.
공유용 `.env.example`은 빈 키만 포함한 양식이다.

## 미르에서 사용

1. 기존 **미르열기.bat**로 실행한다. 이미 열어 둔 화면은 필요한 배선을 파일로 저장한 뒤 새로고침한다.
2. 상단에 **Copilot · 서버 API**가 표시되는지 확인한다.
3. 배선 API 연결은 자동이다. API 키를 입력하지 않는다.
4. **연결 설정 → 서버 API → 연결 테스트**로 Direct Line 대화 생성이 되는지 확인한다.
5. 미르의 기존 채팅창에 설계를 요청한다.

답변에 미르 배선 JSON이 있으면 기존 수정안 미리보기·그리기 흐름을 사용한다.
API에 저장한 회로의 `circuit_id`를 반환하면 **에이전트 회로를 DB에서 불러오기** 버튼이 표시된다.
설계·부품 조사·검증의 범위는 기존 에이전트와 API 설정을 따른다.

## 연결 구조

미르 → 127.0.0.1:8002의 로컬 전용 연결 → .env의 X-API-Key로 인증한 Python API → Direct Line → Copilot Studio.

`run.py`는 8000번(화면·API·MCP)과 8002번(로컬 자동 연결)을 함께 연다.
둘 다 loopback에만 바인딩하며 기존 Dev Tunnel 대상 포트는 8000번을 유지한다.
자동 연결은 실제 소켓 포트, 접속 IP, Host, Origin을 확인한다.
8000번이나 외부 터널로 자동 인증을 요청하면 거절한다. MCP는 기존 API 키 인증을 유지한다.
localhost의 미르 화면과 Electron이 이 경로를 사용하며 브라우저에 키 값을 내려주지 않는다.
사람 검토 키는 자동 연결에서 사용하지 않는다.

Direct Line 비밀 키와 대화 토큰은 Python 서버에만 보관한다.
브라우저와 Electron 화면은 서버가 발급한 내부 세션 ID와 응답 텍스트만 받는다.
세션은 사용자별로 격리하며 30분 동안 사용하지 않으면 정리한다.
서버를 다시 시작하거나 대화 토큰이 만료되면 **새로 만들기**로 새 대화를 연다.
응답을 기다리는 동안 최대 약 2분간 결과를 조회한다. 응답 제한 시간이나 네트워크 오류 후에 요청을 자동 재전송하지 않는다.
여러 응답은 마지막 메시지 이후 약 3초의 조용한 구간을 기준으로 묶는다. 장시간 간격으로 나뉘는 응답이나 로그인 카드·첨부 전용 응답은 별도 처리가 필요할 수 있다.

## 오류

- `COPILOT_SECRET_NOT_CONFIGURED`: `.env`에 비밀 키를 넣고 저장한다.
- `DIRECT_LINE_AUTH_FAILED`: Secret 1/2가 맞는지와 지역별 Direct Line 주소를 확인한다.
- `INVALID_DIRECT_LINE_DOMAIN`: HTTPS의 공식 `*.directline.botframework.com/v3/directline` 주소만 허용한다.
- `CHAT_SESSION_NEEDS_RESET` / 만료: 현재 배선을 파일로 보관하고 새로 만들기로 대화를 다시 연다.
- Microsoft의 대화 권한 오류가 답변으로 오는 경우: 에이전트의 채널·인증·게시 설정을 별도로 확인한다.

지역 전용 에이전트는 전역 주소가 맞지 않을 수 있다. 예를 들어 Microsoft 공식 안내의 유럽 주소는
`https://europe.directline.botframework.com/v3/directline`이다. 임의 도메인으로 비밀 키를 전송하지 않도록 주소를 제한한다.

연결 테스트 성공은 대화 생성 성공을 의미한다. 실제 응답·MCP 도구 호출은 별도 채팅으로 확인한다.
채팅 검사는 가짜 Direct Line 응답으로 수행했다. 실제 로컬 자동 인증·부품 조회·기존 MCP 연결도 확인했다.
Microsoft의 실제 답변 성공은 별도 채팅으로 확인한다.

## 채팅 로그와 대기 상태

`logs/chat.log`에 대화 생성, 메시지 수락, Microsoft HTTP 상태, 수신 메시지 수, 경과 시간, 완료/오류를 기록한다.
키·토큰·프롬프트·응답 원문은 기록하지 않는다. `mock:false`는 실제 호출이고 `mock:true`는 테스트다.

```powershell
Get-Content .\logs\chat.log -Tail 30 -Wait
```

화면에는 대화 연결/응답 대기/응답 수신 단계와 경과 초를 표시한다.
`GET /chat/diagnostics`는 접속 소유자의 대기·완료·오류 요약만 반환하며 정상 API 인증이 필요하다.

2026-10-28 확인: 일부 실제 답변은 `from.role`이 없어 기존 필터에서 누락됐다.
현재는 봇 역할 또는 전송한 메시지와 일치하는 `replyToId`로 답변을 판별하고 사용자 에코를 제외한다.
수정 후 짧은 실제 연결 테스트는 수신 약 3.5초, 최종 완료 약 7.3초로 확인했다. 복잡한 설계 시간은 별도다.

공식 참고: [웹 및 Direct Line 보안](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configure-web-security),
[Direct Line API](https://learn.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-direct-line-3-0-api-reference).
