# 이미지 에이전트 설정 — 최신 기본 그림 양식 v2

사용자가 2026-10-28에 제공한 양식을 반영했다. 기존 GitHub 양식의 글자 전면 금지 규칙은 대체했다.

## 안내에 붙여넣기
`outputs/copilot-agent-setup/설정안내.md`의 이미지 제작 역할 문구만 복사한다. 상세 지침은 기술에 둔다.
연결할 에이전트 이름은 `ComponentImageAgent`를 유지한다.

## 연결 설명
센서·액추에이터·보드·전원 장치의 2D 부품 그림이 필요할 때 호출합니다. 정확한 부품 ID와 외형 요구사항을 받아 미르 기본 디자인 양식에 맞는 PCB형 또는 BARE형 SVG를 직접 제작하고 저장·적용합니다. 몸체의 칩 이름·확인된 정격 표기, 재료 색·글꼴·연결점 배치를 유지하며 이미지 ID와 적용 결과를 반환합니다. 전기 사양 등록·검증은 담당하지 않습니다.

## 기술과 지식 교체

적용 방법의 기준은 `outputs/copilot-agent-setup/설정안내.md`다. 기술 ZIP은 압축을 풀지 않고 사용하며 기존 항목을 갱신한다.
- 기술: 기존 component-image 기술을 `outputs/copilot-agent-setup/component-image-skill.zip`으로 교체한다.
- 지식: 기존 이미지 지식을 `outputs/copilot-agent-setup/component-image-knowledge.md`로 교체한다.
- 오래된 이미지 지식에 text 전면 금지 규칙이 있다면 제거해 새 지식과 충돌하지 않게 한다.
- 도구: 기존 CircuitAgent 연결을 재사용한다. 서버 주소와 배선 API 키는 그대로다.
- GetComponentImageSpec의 presentation_json 인수가 추가되었으므로 도구 목록/스키마를 새로 고친다.
- 필요하면 해당 에이전트의 MCP 도구를 제거한 뒤 기존 연결로 다시 추가한다. 새 MCP 서버를 만들 필요는 없다.
- 중앙 에이전트의 위임 연결은 유지한다. 수정한 전문 에이전트를 저장하고 배포 채널에 맞게 다시 게시한다.

## 역할별 도구
기본: SearchComponents, GetComponentDetails, GetComponentImageSpec, SaveComponentSvg,
ListComponentImages, GetComponentImage, ApplyComponentImage.
선택 서버 생성: GetImageGenerationConfig, GenerateComponentImage, GetJobStatus.
전체 MCP는 20개이다. 이미지 에이전트에는 위 역할에 필요한 도구만 선택한다.
미등록 부품은 검색·중앙 에이전트가 CreateComponent로 저장한 뒤 실제 부품 ID를 전달한다. 전체 흐름은 COMPONENT_PIPELINE_SETUP.md를 참고한다.
스킬 지침은 서버의 권한 분리를 대신하지 않는다.

## 기본 제작 흐름
GetComponentImageSpec → Copilot이 SVG 직접 작성 → SaveComponentSvg → GetComponentImage → ApplyComponentImage.
외부 OpenAI API 키는 필요 없다. 선택 기능인 서버 자동 생성만 .env의 OPENAI_API_KEY와 COMPONENT_IMAGE_MODEL을 사용한다.
기존 Direct Line 키와 배선 API 키는 계속 사용하며 브라우저에 입력할 필요 없다.

## 새 표시 설정
GetComponentImageSpec의 presentation_json 예시:
```json
{"kind":"pcb","color":"#5b2a86","pin_sides":{"VCC":"left","GND":"left","OUT":"right"}}
```
kind는 pcb/bare, color는 #RRGGBB, pin_sides는 실제 핀의 left/right/top/bottom 표시 위치다.
도구가 반환한 presentation을 SaveComponentSvg 요청의 같은 필드에 복사한다.
SVG는 width/height/viewBox를 정확히 맞춘다. PCB 바탕·실크·구멍·패드는 서버가 추가한다.
BARE는 투명 바탕에 리드/케이블을 핀 위치까지 연결한다.

몸체 텍스트 예시(좌표는 실제 크기에 맞춰 변경):
```xml
<text x="80" y="60" text-anchor="middle" class="art-text strong dark">ESP32</text>
<text x="80" y="74" text-anchor="middle" class="art-text tiny dark">WROOM-32</text>
```
기본 9px, strong 12px 굵게, tiny 8px, 고정폭 글꼴. 부품 제목·핀 이름은 앱이 별도로 표시한다.
미확인 정격을 넣지 않는다. text 하나는 80자 이하이며 외부 폰트·URL·이벤트·스크립트는 허용하지 않는다.

## API와 저장
GET /components/{id}/image-spec 또는 GET /component-images/spec으로 기본 사양을 조회한다.
POST /component-images/spec은 component_id 또는 candidate_id와 presentation을 받는다.
POST /component-images/svg는 대상 ID, appearance, request_id, svg, presentation을 받는다.
선택 자동 생성 POST /component-images/generate는 svg를 제외한 같은 형식이다.
GET /component-images/{asset_id}/content는 SVG data URL과 안전한 art_nodes 트리, presentation, layout을 반환한다.
미르는 art.js에서 이 트리를 다시 그려 기존 CSS 색과 테마를 사용한다.
PUT /components/{id}/image로 선택하고 GET 같은 경로로 현재 그림을 읽는다. 인증은 X-API-Key이다.
실제 SVG는 data/component-images, 메타데이터와 선택 연결은 기존 SQLite의 component_images/component_image_bindings,
작업 상태는 jobs(kind=component_image), 비밀값 없는 상태 로그는 logs/images.log에 저장한다.

## 기존 데이터와 적용
기존 v1 그림과 부품·회로 기록은 보존한다. 새 양식을 적용하려는 부품만 새 request_id로 제작한다.
새 제작물은 design_version=v2이다. 현재 화면은 에이전트 응답 후 그림을 다시 읽는다.
Studio 테스트에서 적용했으면 미르의 서버 다시 연결 또는 DB 회로 불러오기를 사용한다.
핀 배치를 변경한 생성물은 제목 영역과 연결점도 함께 갱신된다. 전기적 연결 정의는 바꾸지 않는다.
상태 표시는 기존 behavior/시뮬레이션 결과가 있을 때 동작한다. 이미지 생성이 새 전기 시뮬레이션을 구현하지는 않는다.

이번 작업은 로컬 API와 업로드 자료의 수정이다. 실제 Studio 안내·기술·지식 업로드와 게시를 자동 실행하지 않았다.
