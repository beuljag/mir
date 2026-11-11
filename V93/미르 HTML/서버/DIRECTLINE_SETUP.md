# 미르 HTML 배선 서버 연결

서버 폴더에서 .env.example을 .env로 복사한 뒤 아래 값을 설정해요.

- CIRCUIT_API_KEY에는 이 서버의 배선 API 키를 설정해요. 24자 이상이어야 해요.
- COPILOT_DIRECT_LINE_SECRET에는 Copilot Studio 에이전트의 웹 채널 보안에서 발급받은 Direct Line 비밀 키를 설정해요.
- COPILOT_CHAT_MODE에는 directline을 사용해요.
- 지역 전용 Direct Line을 쓰면 COPILOT_DIRECT_LINE_DOMAIN에 에이전트의 공식 Direct Line 주소를 설정해요.

서버 폴더에서 python -m pip install -r requirements.txt를 실행한 뒤 python run.py로 서버를 켜세요. 이 PC에서 미르 HTML 실행기를 열고 이 PC의 서버를 선택해요. 공유 서버를 쓸 때는 관리자가 제공한 HTTPS 주소와 배선 API 키를 미르 HTML에서 입력해요.

AI가 만든 회로를 DB에서 바로 열려면 에이전트의 배선 도구가 미르 HTML과 같은 DB를 사용하고, 해당 계정에 회로 조회 권한이 있어야 해요. 미르에서는 에이전트가 반환한 회로 ID를 받아 제작대에 표시해요.

배선 API 키와 계정은 서버 시작 때 읽어요. 값을 바꾼 뒤 배선 서버를 다시 시작해 주세요. Direct Line 키는 연결할 때마다 서버가 읽어요.
