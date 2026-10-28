# Copilot Studio MCP 연결

## 입력 값

- 서버 이름: CircuitAgent (영문·숫자·하이픈·점 사용)
- 설명: 가상 부품 검색·상세 조회, 회로 저장·수정·규칙 검증 및 편집기 초안 반영
- 서버 URL: `https://rqc76xf3-8000.jpe1.devtunnels.ms/mcp`
- 인증: API 키
- 매개 변수 형식: 머리글
- 헤더 이름: `X-API-Key`
- 키 값: `config/local-api-keys.json`에서 왼쪽의 긴 문자열

키 파일이나 키 값을 지식 문서·공개 저장소에 올리지 마세요.
이 문서는 키를 포함하지 않습니다.

## 연결 후 도구

MCP 서버를 추가하면 제공되는 도구를 확인하고 에이전트 역할에 맞게 선택합니다.

|에이전트|도구|
|---|---|
|중앙 설계|총 20개. 이미지 제작은 연결한 ComponentImageAgent에 위임 권장|
|부품 조사|SearchComponents, GetComponentDetails, ResearchComponent, AnalyzeDatasheet, GetJobStatus, ListComponentCandidates, GetComponentCandidate, CreateComponent|
|회로 설계|SearchComponents, GetComponentDetails|
|검증 결과 해석|GetCircuitStatus, GetComponentDetails|
|부품 이미지|SearchComponents, GetComponentDetails, GetComponentImageSpec, SaveComponentSvg, ListComponentImages, GetComponentImage, ApplyComponentImage, GetImageGenerationConfig, GenerateComponentImage, GetJobStatus|

Copilot Studio의 참조형 스키마 제한을 피하기 위해 MCP 도구 입력을 단순화했습니다.
CreateCircuitDraft는 회로를 직렬화한 `draft_json` 문자열,
UpdateCircuit은 `circuit_id`와 `expected_version`을 포함한 회로의 `update_json` 문자열을 받습니다.
도구 출력은 JSON 텍스트입니다. REST API의 객체 입력 형식은 그대로입니다.
validate/apply는 `circuit_id`와 `expected_version`을 사용합니다.
미통과 초안 반영에만 `allow_unvalidated_draft=true`를 사용합니다.
가상 샘플 회로는 정상 연결이라도 검증 상태가 unknown입니다.
현재 MCP 도구는 20개입니다. SimulateCircuit는 제공하지 않습니다.
CreateComponent(component_json)가 새 미검증 부품을 저장합니다. 중앙·부품 검색 에이전트에 활성화하고 `COMPONENT_PIPELINE_SETUP.md`의 새 지침을 적용하세요.
신규 이미지 도구와 기술·지식 업로드는 `IMAGE_AGENT_SETUP.md`를 참고하세요. 기존 URL과 인증 연결을 재사용합니다.
부품 조사와 별도 사람 검토·승인 절차는 `RESEARCH_SETUP.md`를 참고하세요.

## 실행과 주소 유지

- 로컬 서버: `127.0.0.1:8000`에서 실행
- 고정 터널 ID: `circuit-agent-20261027.jpe1`
- 저장된 구성: `config/tunnel.json`
- Windows 로그인 시 API와 터널을 각각 숨김 실행
- 서버 로그: `logs/server.log`, 터널 로그: `logs/tunnel.log`
- 자동 실행 해제: Win+R → `shell:startup`에서 CircuitAgentAPI/CircuitAgentTunnel 바로가기 삭제

재시작 시 새 터널을 생성하지 않고 저장된 터널 ID를 재사용합니다.
노트북 종료·절전·인터넷 단절 중에는 연결되지 않습니다.
기본 Dev Tunnel은 비활성 기간이 길면 만료될 수 있습니다(공식 기본값: 30일 비활성).
계정 토큰이 만료되거나 조직 정책이 바뀌면 다시 로그인해야 할 수 있습니다.
영구 호스팅 서비스는 아닙니다.

터널 계정 재로그인:

```powershell
.\tools\devtunnel.exe user login --use-device-code-auth --entra
```

수동 터널 실행(자동 실행이 없는 경우):

```powershell
.\tools\devtunnel.exe host circuit-agent-20261027.jpe1 --host-header localhost:8000 --origin-header http://localhost:8000
```

## 검증

```powershell
.\.venv\Scripts\python.exe scripts\check_mcp.py
.\.venv\Scripts\python.exe scripts\check_mcp.py --url https://rqc76xf3-8000.jpe1.devtunnels.ms
```

양쪽 모두 인증 없는 요청이 401인지, initialize·tools/list 및 GetComponentDetails가 성공하는지 검사합니다.
현재 외부 HTTPS 주소에서 이 검증을 통과했습니다. Copilot Studio 테넌트에서 추가·채팅 테스트는 별도입니다.
MCP는 Streamable HTTP / stateless / JSON 응답으로 제공하며 API 키를 도구 매개변수에 노출하지 않습니다.
전원·통신·발열 등 실제 하드웨어의 안전성을 보증하지 않습니다.

공식 참고:
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent
- https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/faq
