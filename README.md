# 배선 에이전트 API

Python 3.11+ / FastAPI / SQLite로 만든 실행 가능한 MVP입니다.
AI가 계획한 회로를 저장·조회·검증하며, API 자체가 자연어로 회로를 설계하지는 않습니다.

DB에 없는 부품을 조사한 뒤 `CreateComponent`로 미검증 정의를 저장하고 이미지 제작·적용과 회로 사용까지 이어지는 흐름을 추가했습니다.
업로드할 에이전트 자료와 실제 검색 설정은 `COMPONENT_PIPELINE_SETUP.md`를 참고하세요. MCP 도구는 총 20개입니다.

## 빠른 실행 (Windows PowerShell)

현재 AI 채팅은 서버 `.env`의 **Copilot Studio Direct Line 비밀 키**를 사용하도록 설정했습니다.
`.env`의 `COPILOT_DIRECT_LINE_SECRET=` 뒤에 키를 넣고 저장하세요.
브라우저에서 키를 읽지 않으며, 사용 순서는 `DIRECTLINE_SETUP.md`에 있습니다.
미르의 배선 API 키 입력도 제거했습니다. 기존 키를 `.env`로 옮겼고, 8002번 로컬 전용 연결이 자동 인증합니다.

부품 이미지 제작 API와 `ComponentImageAgent` 설정 자료를 추가했습니다.
팀의 SVG 프롬프트로 에이전트가 직접 제작·저장·적용하는 기본 경로에는 별도 이미지 서비스 키가 필요 없습니다.
선택 기능인 서버 생성은 `.env`의 `OPENAI_API_KEY`를 사용합니다. 자세한 안내는 `IMAGE_AGENT_SETUP.md`를 참고하세요.

팀원의 **미르 2D 화면**을 연결했습니다. **미르열기.bat**를 더블클릭하면
`http://127.0.0.1:8000/mir/`를 엽니다. DB 불러오기·편집·저장·검증은 `MIR_SETUP.md`를 참고하세요.

이미 설치된 이 PC에서는 **`서버켜기.bat`를 더블클릭**하면 서버와 저장된 터널을 함께 켭니다.
이미 실행 중인 서비스는 유지합니다. 실행 확인 후 명령창을 닫아도 서비스는 백그라운드에서 계속 실행됩니다.
고정 API 키와 MCP 주소는 바뀌지 않습니다. 실패하면 창의 오류와 `logs/`의 로그를 확인하세요.
서버만 켜려면 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start_services.ps1 -NoTunnel`을 사용합니다.

이 폴더에서 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

프로젝트 전용 `.venv`에 패키지를 설치합니다. 첫 설치에는 인터넷이 필요합니다.
현재 폴더의 `.venv`에는 설치가 완료되어 있습니다. 패키지가 이미 있으면 다시 설치하지 않습니다.
고정 키는 `config/local-api-keys.json`에 처음 한 번 생성하고 이후 유지합니다.
JSON의 왼쪽 속성 이름(긴 문자열)을 API 키로 사용합니다. 오른쪽 `local-user`는 소유자 ID입니다.
키를 다른 사람에게 공유하지 마세요. 수동 실행한 서버의 종료는 Ctrl+C입니다.

- 테스트 편집기: http://127.0.0.1:8000
- Swagger API 문서: http://127.0.0.1:8000/docs
- OpenAPI 3: http://127.0.0.1:8000/openapi.json
- 상태 확인: http://127.0.0.1:8000/health

편집기에서 고정 키 입력 → 샘플 초안 → 드래그 배치 → 변경 저장 + 재검증을 실행하세요.
연결 변경은 JSON의 `nets`에서 합니다. 핀 드래그 배선 UI는 아직 없습니다.
페이지 새로고침 시 키를 다시 입력합니다. 키를 URL/브라우저 저장소에 저장하지 않습니다.
회로 ID를 기록하면 서버를 다시 시작해도 같은 owner로 조회할 수 있습니다.

## 고정 키로 실행

```powershell
$env:CIRCUIT_API_KEYS = '{"replace-with-a-random-key-of-at-least-24-characters":"user-a"}'
.\.venv\Scripts\python.exe run.py
```

키는 24자 이상이어야 합니다. 실제 키는 아래처럼 생성하세요.

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(32))"
```

`CIRCUIT_API_KEYS`는 키→owner 매핑 JSON입니다. 서로 다른 owner는 상대 회로에 접근할 수 없습니다.
owner가 같은 키는 같은 회로에 접근합니다. 부품 DB는 공유 읽기 전용입니다.
`CIRCUIT_API_KEYS` 환경 변수는 파일보다 우선합니다. 환경 변수와 키 파일이 모두 없으면 시작하지 않습니다.
DB 경로는 `CIRCUIT_DB_PATH`로 변경할 수 있습니다.
실제 운영에서는 환경 변수에 안전하게 키를 공급하고, HTTPS·비밀 관리·요청 제한·백업을 구성해야 합니다.
현재 인증은 MVP용 API 키 방식이며 Entra 사용자 인증은 구현하지 않았습니다.

## Windows 로그인 시 자동 실행

현재 사용자 시작프로그램 폴더에 `CircuitAgentAPI.lnk`를 등록했습니다.
Windows 로그인 후 가상환경의 `pythonw.exe`가 `run.py --background`를 실행합니다.
PowerShell 프로필을 읽지 않으며 콘솔 창은 표시하지 않습니다.
주소는 `http://127.0.0.1:8000`입니다. 노트북이 꺼지거나 절전 중이면 호출할 수 없습니다.
서버가 비정상 종료된 경우 자동 재시작하는 서비스/감시자는 아직 없습니다.
폴더 이동·삭제 시 바로가기를 다시 등록해야 합니다.

- 실행 로그: `logs/server.log` (회전 보관)
- 시작 오류: `logs/startup.log`
- 자동 실행 해제: Win+R → `shell:startup` → `CircuitAgentAPI` 바로가기 삭제
- 자동 실행 재등록: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install_autostart.ps1`
- 수동 실행: `powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1`

이미 8000번 포트를 사용 중이면 새 실행은 기존 프로세스를 종료하지 않고 빠져나옵니다.
실제 Windows 재부팅 시험은 하지 않았으며, 등록한 바로가기를 직접 실행해 고정 키 인증을 확인했습니다.
MCP 엔드포인트와 외부 고정 개발 터널을 추가했습니다. 연결 값은 `MCP_SETUP.md`를 참고하세요.
`CircuitAgentTunnel.lnk`도 시작프로그램에 등록하며 `logs/tunnel.log`에서 실행 상태를 확인할 수 있습니다.

## 구현된 API

|메서드/경로|operationId|기능|
|---|---|---|
|GET /components/search?q=|SearchComponents|부품 검색|
|GET /components/{component_id}|GetComponentDetails|핀/전압/출처 조회|
|POST /circuits|CreateCircuitDraft|새 초안 저장|
|GET /circuits/{circuit_id}|GetCircuitStatus|최신 회로/검증 결과 조회|
|PUT /circuits/{circuit_id}|UpdateCircuit|전체 회로 교체, 버전 증가|
|POST /circuits/{circuit_id}/validate|ValidateCircuit|현재 버전 규칙 검증|
|POST /circuits/{circuit_id}/apply|ApplyCircuitLayout|내장 편집기 반영 버전 기록|

`PUT`, `validate`, `apply`는 `expected_version`을 필수로 받습니다.
`PUT` 본문은 초안 필드와 `expected_version`입니다. 응답 전체를 그대로 PUT하면 안 됩니다.
수정 시 검증 결과와 반영 상태를 초기화하고 반드시 재검증합니다.
레이아웃 변경도 버전을 증가시키는 단순한 정책입니다. net은 부품 위치와 독립적입니다.
DB에는 최신 상태와 버전별 스냅샷을 저장합니다. 과거 버전 조회 API는 아직 없습니다.
생성 요청은 호출마다 새 ID를 만듭니다. idempotency key는 미구현이므로 무조건 자동 재시도하지 마세요.

### 검증 요청 예

```json
{"expected_version": 1}
```

검증을 통과하지 않은 초안을 명시적으로 반영하려면:

```json
{"expected_version": 1, "allow_unvalidated_draft": true}
```

`apply`는 회로를 생성하거나 배선을 설계하지 않습니다. 현재 버전의 반영 상태를 기록하고,
미르 편집기 URL(`/mir/?circuit=...`, 서버 기준 상대 경로)을 반환합니다.
미르에서 API 키로 연결해 회로를 불러옵니다. 다른 창에 자동으로 push하지는 않습니다.

### 오류

- 401: 키 누락/잘못된 키
- 404: 없는 리소스 또는 다른 owner의 회로
- 409 VERSION_CONFLICT: 최신 버전을 조회한 후 수정안을 재검토
- 409 DRAFT_CONFIRMATION_REQUIRED: 초안 반영 옵션 필요
- 422: 입력 JSON/필드 형식 오류
- 501: 아직 연결되지 않은 기능

## 검증 범위와 샘플 부품

출하 샘플 3종은 **새로 만든 가상 테스트 부품**입니다. 실제 제품의 사양을 조사하거나 검증한 것이 아닙니다.
가상 부품을 사용한 회로는 오류가 없더라도 `unknown`입니다.
핀 참조, 필수 연결, 복수 출력, 전원/GND 단락, 신호 타입, 정적 출력 전압과 입력 허용 범위를 검사합니다.
오류가 있으면 `failed`, 미확인 항목이 있으면 `unknown`, 구현된 검사에 문제가 없으면 `passed`입니다.
`passed`는 구현된 검사 범위의 통과이며 실제 안전 보증이 아닙니다.

전류·부하·발열, 통신 타이밍, 보호/보조 회로 적정성, MCU 펌웨어는 검사하지 않습니다.
오픈드레인·풀업·수동소자 경로 등은 모델링하지 않았으며 출력 공유도 보수적으로 오류 처리합니다.
실제 부품은 조사 후보를 만든 뒤 별도 사람 검토 키로 승인하여 등록할 수 있습니다. 사용법은 `RESEARCH_SETUP.md`에 있습니다.

## 부품 조사와 사람 검토

- `POST /components/research`: 비동기 공식 자료 조사, 검토 전 후보 저장.
- `POST /datasheets/analyze`: PDF/HTML의 페이지별 근거 추출.
- `GET /jobs/{job_id}`: 작업 상태·결과 조회.
- `/component-candidates`: 후보 조회와 별도 사람 검토 키를 통한 승인/반려.
- 사용법과 검색 API 연결 설정은 `RESEARCH_SETUP.md`를 참고하세요.

## 미구현 기능
- `POST /circuits/{id}/simulate`: HTTP 501 / unsupported. ngspice/모델 미연결.

시뮬레이션은 Copilot Studio의 활성 도구로 추가하지 마세요.

## 테스트

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

인증, 사용자 격리, DB 영속성, 버전 충돌, 검증 결과 초기화, 오류 검출,
가상 부품의 unknown, 전압 초과 및 제한된 passed 결과를 검사합니다.
테스트는 임시 DB를 사용하며 실행용 DB를 수정하지 않습니다.
현재 검증한 정확한 패키지 버전은 `requirements-tested.txt`에 기록했습니다.
재현할 때는 이 파일을 설치할 수 있습니다. 운영 배포 전에는 보안 업데이트를 검토하세요.

## Copilot Studio 연결

구체적인 설정은 `COPILOT_SETUP.md`를 참고하세요.
Copilot Studio의 **MCP 서버 추가** 화면을 사용하는 경우에는 `MCP_SETUP.md`를 사용하세요.

공식 참고: [FastAPI 테스트](https://fastapi.tiangolo.com/tutorial/testing/),
[Microsoft 커스텀 커넥터](https://learn.microsoft.com/microsoft-copilot-studio/advanced-connectors).
