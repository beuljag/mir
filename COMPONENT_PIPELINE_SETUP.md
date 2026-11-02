# 검색 → 부품 DB 저장 → 이미지 제작·적용 → 재사용

## 현재 동작

1. 중앙이 DB 부품을 검색한다. 있으면 기존 정의·그림을 재사용한다.
2. 없으면 부품 검색 에이전트가 준비된 웹 검색으로 공식 제품 자료·데이터시트를 조사한다.
3. `CreateComponent`가 조사 결과를 **미검증 설계 부품**으로 저장하고 실제 `component_id`를 반환한다.
4. 중앙이 그 ID를 이미지 에이전트에 전달한다.
5. 이미지 에이전트가 최신 v2 양식으로 SVG를 작성하고 `SaveComponentSvg`와 `ApplyComponentImage`를 실행한다.
6. 부품 정의는 DB에, SVG는 이미지 폴더에, 부품·이미지 연결은 DB에 저장된다.
7. 미르는 응답 뒤 부품 목록과 그림을 다시 읽는다. 회로 ID 응답의 DB 불러오기 버튼으로 배치·배선을 연다.
8. 다음 요청은 같은 DB와 소유자 연결에서 검색해 저장한 정의와 이미지를 재사용한다.

이미지에 연결할 부품 ID가 필요하므로 메타데이터를 먼저 저장하고, 그림이 완성되면 같은 ID에 연결한다.
최종적으로 부품 정보와 그림이 모두 보존된다. 기존 부품·회로를 초기화하거나 덮어쓰지 않는다.

## Copilot Studio에서 바꿀 항목

기존 MCP `CircuitAgent` 연결과 서버 URL·API 키를 유지한다.
도구 목록을 새로 고쳐 **CreateComponent**를 중앙·부품 검색 에이전트에서 사용할 수 있게 추가한다.
현재 서버가 제공하는 MCP 도구는 총 24개다. 자동으로 새 도구가 안 보이면 해당 에이전트의 MCP 도구를 제거한 뒤 기존 연결로 다시 추가한다.

파일 적용 방법은 `outputs/copilot-agent-setup/설정안내.md` 한 곳을 기준으로 한다.
기존 파일명을 유지하며 기술 ZIP은 압축을 풀지 않고, 지식 MD는 그대로 기존 항목에 갱신한다.
별도 업데이트 묶음이나 instructions.md 사본은 사용하지 않는다.
안내에는 설정안내.md의 짧은 역할 문구만 넣는다. 상세 지침은 기술에만 둔다.
중앙·검색·이미지 역할의 파일을 갱신하고 회로 설계·검증 해석의 지식도 같은 이름의 현재 파일로 맞춘다.

## 전문 에이전트 연결 설명

### 부품 검색·조사

```text
설계에 필요한 부품이 DB에 없을 때 호출합니다. 공식 제품 자료와 데이터시트를 검색·분석하고, 확인한 정보와 미확인 항목을 구분해 CreateComponent로 미검증 부품을 저장합니다. 이미지와 회로에 사용할 실제 component_id를 반환합니다. 조사 상태만 정리하고 종료하지 않습니다.
```

### 이미지 제작

```text
검색 에이전트가 DB에 저장한 component_id를 받아 미르 기본 디자인 양식의 PCB형 또는 BARE형 SVG를 직접 만들고 저장·적용합니다. 기존 그림이 적합하면 재사용합니다. 핀 정보가 부족한 부품도 외형 초안은 만들 수 있으며, 임의의 핀이나 정격을 추가하지 않습니다. asset_id와 component_id, 적용 결과를 반환합니다.
```

## 실제 검색 설정

검색 에이전트의 Web Search/웹 검색을 사용할 수 있게 한다. Microsoft 문서상 웹 검색은 생성형 오케스트레이션이 켜져 있을 때 공개 웹 검색을 제공한다.
[Microsoft 공식 설정 안내](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio#use-information-from-the-web)

공식 URL을 알고 있으면 `ResearchComponent(source_urls_json)` 또는 `AnalyzeDatasheet`로 분석할 수 있다.
서버 자체 범용 검색은 선택 설정인 `.env`의 `BRAVE_SEARCH_API_KEY`를 사용한다. 기존 research-secrets.json 설정도 호환한다.
서버의 제조사 도메인 목록에 없는 새 제조사는 검색 결과를 공식 출처 미확인 후보로 수집하고, 확인되지 않은 출처라는 경고를 유지한다.
Copilot 웹 검색을 쓰면 이 서버 검색 키를 따로 요구하지 않는다. 이미지 직접 제작에도 OpenAI 키가 필요 없다.
검색이 안 될 때 실제로 조사했다고 주장하거나 가짜 URL을 만들지 않는다.

## 정보가 부족한 경우

모델·핀·정격을 추측하지 않고 현재 알 수 있는 정보로 미검증 부품을 저장한다.
핀을 모르면 `pins: []`, 수치를 모르면 해당 전압 필드 생략, 개념 부품이면 `is_virtual: true`로 둔다.
`unresolved_fields`와 notes에 미확인 사항을 적는다. 외형과 배치를 먼저 만들고 실제 연결은 핀 확인 뒤 진행한다.
검증 결과는 unknown이며 그림 생성이나 DB 저장만으로 verified가 되지 않는다.
실물 사양의 사람 검토·승인 기능은 그대로 유지하며 이 자동 저장과 구분한다.

## CreateComponent 예시

MCP에는 아래 객체를 직렬화한 문자열을 `component_json`으로 전달한다.

```json
{
  "request_id": "external-pump-concept-001",
  "manufacturer": "미확인",
  "model": "외부 전원 펌프 (모델 미확인)",
  "category": "actuator",
  "pins": [],
  "is_virtual": true,
  "notes": "사용자가 외부 전원 펌프를 요청함. 모델·핀·정격 추가 확인 필요.",
  "unresolved_fields": ["exact_model", "pinout", "rated_voltage", "rated_current"]
}
```

확인한 핀이 있으면 Pin 형식으로 넣는다. 선택 candidate_id가 있으면 후보 모델과 일치해야 하며 서버가 출처를 함께 연결한다.
같은 request_id와 같은 내용은 같은 부품을 반환한다. 같은 ID에 다른 내용은 409이다.
기존 사양을 덮어쓰지 않으므로 수정된 정의는 새 request_id로 저장하고 새 부품 ID를 사용한다.

## 저장 구조

- components: 기존 공개/승인 부품 정의.
- component_drafts: 소유자, 요청 ID, 요청 해시, 새 부품 정의. 현재 연결의 검색·조회에 함께 나타난다.
- component_images / component_image_bindings: 생성물과 부품별 선택 이미지.
- data/component-images/{asset_id}.svg: 실제 그림 파일.
- circuits / circuit_versions: 저장한 부품 ID를 사용하는 회로와 이력.
- component_candidates / jobs: 조사 근거와 작업 상태.

현재 사용자만의 미검증 부품은 다른 소유자에게 노출하지 않는다. 같은 API 키·소유자의 부품은 같은 DB에서 재사용한다.
기존 세 개의 가상 부품이나 승인 정의를 교체하지 않는다. 미르는 100개씩 페이지를 읽어 신규 부품이 목록 뒤에 있어도 불러온다.

## 검증과 남은 설정

합성 조사 자료를 사용한 자동 검사로 조사 → 저장 → 그림 연결 → 회로 검증 → DB 재조회 흐름을 확인했다.
실제 인터넷에서 특정 펌프의 사양을 확인하거나 실제 Studio 에이전트가 검색·생성을 완료했다고 주장하는 검사는 아니다.
새 API는 로컬 서버에 반영하고, Studio 안내·도구·기술·지식 교체 및 게시는 사용자가 해야 한다.
