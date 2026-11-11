# 미르 V93

- Windows EXE와 HTML 소스를 함께 제공해요. EXE의 버전은 0.1.93이에요.
- 설정창의 상단을 고정하고 탭에 따라 아래쪽 높이만 바뀌도록 수정했어요.
- 여러 부품을 이동할 때 움직이는 부품과 연결된 선만 다시 그려요.
- 설정에 다크/라이트 모드를 추가하고 다크 모드의 메뉴 아이콘을 흰색으로 표시해요.
- HTML 파일을 직접 열어 제작대를 실행할 수 있어요. HTML, CSS, JavaScript를 분리했어요.
- HTML 묶음에서 API 연결 객체가 등록되지 않던 오류를 수정했어요.
- API 키 인증 서버가 파일 출처(null)의 요청에 응답하도록 CORS를 수정했어요. API 키 인증을 유지해요. 로컬 자동 인증 중계의 출처 제한은 유지해요.

## 다운로드

[Windows EXE](https://github.com/beuljag/mir/releases/download/v93/mir-V93.exe)

[HTML ZIP](https://github.com/beuljag/mir/releases/download/v93/mir-V93-html.zip)

HTML ZIP을 풀고 미르 HTML.html을 여세요. assets, docs, CSS, JavaScript도 같은 폴더 구성으로 함께 보관하세요.

## 팀원 서버에 적용

현재 팀원 노트북에서 운영 중인 배선 서버에 이 버전의 app/main.py를 적용한 뒤 서버를 다시 시작해야 HTML 직접 연결이 가능해요. 서버의 변경 사항과 기존 운영 코드가 다르면 CORS 설정의 allow_origins에 추가된 null 항목만 반영하세요. 기존 API 키와 DB는 운영 서버의 것을 사용하세요.

GitHub에 올리는 것만으로 현재 운영 중인 서버가 갱신되지는 않아요. 서버를 켜 둔 상태에서 HTML의 에이전트 연결 설정에 공유 서버 주소와 배선 API 키를 입력하세요.

## 확인한 동작

- Chrome에서 HTML 파일을 직접 열어 실제 Python API와 SQLite DB에 연결했어요. HTML 실행기는 사용하지 않았어요.
- 파일 출처의 사전 요청 허용, 정상 키의 조회 성공, 키 누락과 잘못된 키의 401 응답을 확인했어요.
- 알 수 없는 웹 출처의 차단과 로컬 자동 인증 중계의 파일 출처 차단을 확인했어요.
- 최종 Windows EXE의 실행, 예제 열기, 되돌리기와 정상 종료를 확인했어요.
- 실제 팀원 서버의 갱신과 실제 Copilot 응답은 이 검사에 포함하지 않았어요.
