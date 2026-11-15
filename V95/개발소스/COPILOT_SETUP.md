# Copilot Studio 연결 안내

## 1. 먼저 로컬에서 확인

`start.ps1`로 실행하고 `/docs`의 Authorize에 `config/local-api-keys.json`의 고정 키를 입력합니다.
JSON의 왼쪽 속성 이름이 키이며 오른쪽 값은 소유자 ID입니다.
SearchComponents와 GetComponentDetails가 정상 응답하는지 확인하세요.
부품 ID는 `virtual-supply`, `virtual-sensor`, `virtual-controller`입니다.

## 2. 연결 가능한 주소 준비

Copilot Studio 클라우드는 사용자 PC의 `127.0.0.1`에 직접 접근할 수 없습니다.
FastAPI를 HTTPS로 접근 가능한 서버에 배포하거나 조직에서 승인한 연결 경로를 구성해야 합니다.
이 프로젝트에서는 클라우드 배포, 외부 공개 및 결제를 실행하지 않았습니다.

현재 `run.py`는 로컬에서만 수신합니다. 배포 시에는 서버 환경에서 예를 들어 다음처럼 실행하고
플랫폼의 HTTPS 프록시와 비밀 환경 변수를 설정하세요.

```text
python -m uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000
```

공개 서버에는 제한된 owner별 키를 공급하세요. 에이전트 제작자 공용 키 하나를 사용하면
그 키를 쓰는 사용자는 같은 owner의 회로를 공유합니다. 사용자별 격리가 필요하면
사용자별 연결을 구성하거나 운영용 Entra/OAuth 인증으로 확장해야 합니다.

## 3. 커넥터 명세 생성

```powershell
.\.venv\Scripts\python.exe scripts/export_openapi.py --host your-api.example.com
```

- `openapi.json`: OpenAPI 3
- `copilot-connector.swagger.json`: Power Platform용 Swagger 2

host에 https:// 또는 경로를 넣지 않습니다. 기본 예시 host는 실제 서버가 아닙니다.
이름만 교체해도 배포되는 것은 아닙니다.
Swagger 2 변환기는 이 프로젝트의 현재 스키마용이며 범용 변환기가 아닙니다.

## 4. 커스텀 커넥터 생성

Power Apps/Power Automate의 사용자 지정 커넥터에서 OpenAPI 파일 가져오기로
`copilot-connector.swagger.json`을 등록합니다. UI 이름은 사용 환경에 따라 다를 수 있습니다.

- 인증 유형: API Key
- 매개변수 이름: X-API-Key
- 위치: Header
- 값: 서버의 CIRCUIT_API_KEYS에 등록한 실제 키

커넥터 테스트에서 부품 조회를 먼저 확인한 뒤 Copilot Studio의 도구 추가 → 커넥터에서
등록한 커넥터의 작업을 선택합니다. 테넌트 DLP/권한 정책에 의해 관리자의 설정이 필요할 수 있습니다.
실제 테넌트 가져오기·인증·게시 테스트는 이 로컬 작업에서 수행하지 않았습니다.

## 5. 에이전트별 할당

|에이전트|도구|
|---|---|
|중앙 설계|SearchComponents, GetComponentDetails, CreateCircuitDraft, UpdateCircuit, GetCircuitStatus, ValidateCircuit, ApplyCircuitLayout|
|부품 조사|SearchComponents, GetComponentDetails, ResearchComponent, AnalyzeDatasheet, GetJobStatus, ListComponentCandidates, GetComponentCandidate|
|회로 설계|SearchComponents, GetComponentDetails|
|검증 결과 해석|GetCircuitStatus, GetComponentDetails|

SimulateCircuit는 501 미구현 응답이므로 활성화하지 마세요. 조사·분석·검토 절차는 RESEARCH_SETUP.md를 참고하세요.
API의 operationId를 도구 이름으로 사용합니다.

## 6. 중앙 에이전트 실행 규칙

1. 부품 ID를 검색하고 상세 정보를 조회한다.
2. 실제 부품 모델/사양이 불분명하면 질문한다. 가상 부품은 시연에만 사용한다.
3. 회로 설계 에이전트가 `component_instances`, `nets`, `layout`을 반환한다.
4. CreateCircuitDraft로 저장한 ID/버전을 변수에 보관한다.
5. ValidateCircuit에 ID와 expected_version을 전달한다.
6. failed이면 오류 해석 → 수정 → UpdateCircuit → 새 버전 검증을 최대 3회 반복한다.
7. unknown을 passed로 바꾸지 않는다.
8. 초안 반영 의도가 있을 때만 allow_unvalidated_draft=true로 ApplyCircuitLayout을 호출한다.
9. 반환된 상대 editor_url 앞에 서버 주소를 붙여 안내한다. 키는 URL에 넣지 않는다.
10. 사용자 편집 이후 GetCircuitStatus로 최신 버전을 다시 읽는다.

실행 순서와 반복 횟수는 안내문에만 맡기지 말고 토픽/흐름의 조건·변수로 관리하세요.

공식 문서:
- https://learn.microsoft.com/microsoft-copilot-studio/advanced-connectors
- https://learn.microsoft.com/microsoft-copilot-studio/add-agent-child-agent
