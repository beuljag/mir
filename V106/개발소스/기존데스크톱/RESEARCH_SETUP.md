미등록 부품의 자동 저장·이미지 연결은 `COMPONENT_PIPELINE_SETUP.md`의 새 흐름을 사용합니다. 조사 후보를 승인하지 않아도 미검증 설계 정의를 저장해 외형 제작에 쓸 수 있습니다.

# 부품 조사 · 데이터시트 분석 · 사람 검토

## 추가된 MCP 도구 5개

|도구|입력|동작|
|---|---|---|
|ResearchComponent|model, manufacturer, source_urls_json(기본 "[]")|공식 자료 조사 작업 생성. 반환값의 id로 상태 조회|
|AnalyzeDatasheet|url, model, manufacturer|공개 HTTPS PDF/HTML 분석 작업 생성|
|GetJobStatus|job_id|queued/running/completed/failed와 결과 조회|
|ListComponentCandidates|없음|현재 연결 소유자의 조사 후보 목록|
|GetComponentCandidate|candidate_id|후보의 원문·페이지 근거·경고·검토 상태 조회|

이미지 도구와 신규 CreateComponent를 포함해 현재 MCP 도구는 24개입니다. 같은 MCP 주소와 API 키를 사용합니다.
Copilot Studio에서 도구 목록을 갱신하고 새 도구를 활성화하세요.
승인 API는 MCP에 노출하지 않습니다.

## 바로 테스트할 요청

부품 조사 에이전트에 입력:

> Texas Instruments의 LM358을 조사해줘. ResearchComponent를 호출하고 GetJobStatus로 완료를 확인한 뒤 후보 ID, 공식 원문, 페이지 근거와 미확인 항목을 알려줘. 부품을 승인하지 마.

기본 탐색은 TI/ST의 공식 데이터시트 URL 규칙을 사용합니다. 성공 응답에서도 정확한 모델명을 별도 확인합니다.
다른 제조사/모델의 공식 문서가 있으면 source_urls_json에 HTTPS URL 배열의 JSON 문자열을 전달합니다.

예:

```json
{"model":"LM358","manufacturer":"Texas Instruments","source_urls_json":"[\"https://www.ti.com/lit/ds/symlink/lm358.pdf\"]"}
```

ResearchComponent 결과의 id는 작업 ID입니다. completed 결과의 result.candidate_id가 후보 ID입니다.
GetComponentCandidate로 후보의 상세 근거를 확인합니다.
queued/running이면 짧은 간격으로 무한 반복하지 말고 잠시 후 조회합니다.
서버 재시작으로 중단된 작업은 failed/SERVER_RESTARTED로 표시합니다.
단일 서버 프로세스 구성이며 다중 uvicorn worker는 지원하지 않습니다.

## 범용 웹 검색 연결(선택)

키 없는 공개 검색은 자동 요청 차단을 받을 수 있어 우회하지 않습니다.
Brave Search API 연결을 구현했습니다. 계정·키를 제공하거나 결제를 진행하지 않았습니다.
설정이 없을 때도 위 공식 URL 탐색과 지정 문서 분석은 작동합니다.

`config/research-secrets.json`을 직접 만들고 다음 값을 넣습니다. 이 파일은 Git에서 제외됩니다.

```json
{"brave_search_api_key":"직접 발급한 검색 API 키"}
```

또는 서버 실행 환경의 BRAVE_SEARCH_API_KEY를 사용합니다. 키 파일을 에이전트 지식에 업로드하지 마세요.
검색 결과는 알려진 제조사 공식 도메인으로 제한합니다. 지원되지 않은 제조사는 공식 문서 URL을 지정하세요.
현재 도메인 목록: TI, ST, Analog Devices, Microchip, NXP, Infineon, Espressif, Arduino, Raspberry Pi, onsemi, Vishay.
검색 결과가 없다거나 사양이 불충분하다는 이유로 다른 부품 사양을 만들어 넣지 않습니다.

## 분석 범위와 한계

- HTTPS 공개 주소만 요청합니다. 사설/로컬/메타데이터 주소는 차단합니다.
- DNS를 확인한 IP로 연결하고 TLS의 호스트 인증을 유지합니다. 리다이렉트마다 주소를 재검사합니다.
- 파일 최대 10MB, PDF 최대 40페이지, PDF 파서 실행 최대 25초.
- Windows PDF 분석 프로세스에 512MiB 메모리 제한을 적용합니다.
- PDF/HTML의 텍스트에서 핀, 권장 동작, 절대 최대 정격, 전류/인터페이스 관련 원문을 분류해 발췌합니다.
- 출처 URL, 문서 제목, 페이지, 다운로드 시각, SHA256과 모델 일치 여부를 기록합니다.
- 공식 도메인/모델 문자열 일치는 사양 검증 완료를 뜻하지 않습니다.
- 표/핀 그림에서 확정된 핀 매핑이나 전압 제한을 자동 생성하지 않습니다.
- 스캔 문서 OCR, 임의 CAD/PCB 파일 분석, LLM 기반 사양 자동 확정은 미구현입니다.
- 검토 전 결과는 unverified이고 운영 components 테이블에 등록되지 않습니다.

## 사람 검토와 등록

1. http://127.0.0.1:8000/review 또는 외부 주소의 /review를 엽니다.
2. config/local-api-keys.json의 API 키를 입력합니다.
3. config/local-review-key.json의 review_key 값을 별도 검토 키에 입력합니다.
4. 후보 목록에서 후보 ID를 입력하고 근거를 불러옵니다.
5. 원문을 대조해 부품 JSON의 정확한 모델·리비전·패키지 핀·전기적 제한을 작성합니다.
6. source_references의 URL·SHA256을 유지하고 실제 검토한 페이지를 작성합니다.
7. 모델/리비전, 핀 배치, 전기적 제한 확인 3개를 체크하고 검토 메모를 작성합니다.
8. 승인 버튼으로 등록하거나, 부족하면 반려합니다.

별도 검토 키는 에이전트/MCP 연결이나 지식에 등록하지 마세요.
검토 키가 없거나 다르면 승인 API는 403입니다.
기존 components ID를 덮어쓰지 않습니다. 리비전 변경은 새 ID로 등록합니다.
후보 상태 변경과 부품 등록은 같은 DB 트랜잭션입니다. 충돌하면 둘 다 롤백됩니다.
승인은 사람이 사양을 검토했다는 기록이며, 실제 회로 안전을 보장하지 않습니다.

## REST 경로

- POST /components/research → 202 JobRecord
- POST /datasheets/analyze → 202 JobRecord
- GET /jobs/{job_id}
- GET /component-candidates
- GET /component-candidates/{candidate_id}
- POST /component-candidates/{candidate_id}/review (X-API-Key + X-Review-Key)

DB에 jobs, component_candidates 테이블을 자동 추가합니다. 기존 회로/부품은 보존합니다.
시뮬레이션 API는 여전히 501이며 이번 조사 기능과 별개입니다.
