# 미르 V95

[Windows V95 EXE 다운로드](https://github.com/beuljag/mir/releases/download/v95/mir-V95.exe)

브라우저판은 이 폴더의 미르 HTML 폴더 전체를 보관하고 미르 HTML.html을 직접 열어 실행해요. HTML, CSS와 JavaScript를 분리했어요.

HTML 이미지 요청은 /components/{id}/image?optional=true를 사용해요. 허용 규칙에 이 주소를 추가했고, image_data가 null이면 기존 기본 그림을 유지해요. 정상 SVG는 기존 좌표와 레이아웃으로 표시해요. 기존 연결 설정을 유지했어요.

Windows 앱 버전은 0.1.95예요. V94의 빈 이미지 응답 호환 처리를 포함해요.

Windows 실행 파일의 실행·예제·되돌리기·종료, HTML 직접 실행·연결 처리를 검사했어요. 검사 서버에서 이미지 요청 3건이 모두 200이고 404는 없었어요. 팀원 운영 서버는 API 키를 보유하지 않아 직접 검사하지 못했어요.
