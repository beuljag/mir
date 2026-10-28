# 미르 토큰 서버

`.exe`로 배포할 때 Direct Line **비밀 키가 유출되지 않게** 하는 작은 서버입니다.
비밀 키는 이 서버에만 두고, 앱에는 약 1시간만 쓸 수 있는 **토큰**만 내줍니다.

```
[미르.exe] ──GET /token──▶ [토큰 서버] ──비밀 키──▶ Direct Line
     ◀──── 토큰 ────────────┘ (비밀 키는 서버에만 있음)
```

- 외부 패키지 없음, Node 18 이상
- `GET /token` → `{ "token": "...", "expires_in": 3600, "domain": "https://directline.botframework.com" }`
- `GET /health` → `{ "ok": true }` (호스팅의 상태 확인용)
- 한 IP가 1분에 10번까지만 토큰을 받을 수 있음 (`RATE_LIMIT_PER_MIN`으로 변경)

## 1. 환경 변수

| 이름 | 필수 | 설명 |
|---|---|---|
| `COPILOT_DIRECT_LINE_SECRET` | ✅ | Copilot Studio > 설정 > 보안 > 웹 채널 보안 의 비밀 키 |
| `PORT` | | 서버 포트 (기본 3000, 호스팅이 정해 주면 비워 둠) |
| `DIRECT_LINE_DOMAIN` | | 기본 `https://directline.botframework.com`. 에이전트가 다른 지역이면 그 주소 |
| `RATE_LIMIT_PER_MIN` | | IP당 1분 토큰 수 (기본 10) |

- 호스팅 서비스에서는 그 서비스의 **환경 변수(Environment variables / Application settings)** 화면에 넣습니다.
- 내 PC에서 돌릴 때는 `.env.example`을 `.env`로 복사하고 값을 **큰따옴표 없이** 넣습니다.

## 2. 실행

```bash
cd server
```

```bash
npm start
```

브라우저에서 `http://localhost:3000/token`을 열어 `token`이 보이면 성공입니다.

## 3. 호스팅에 올리기

어느 곳이든 **루트 폴더 `server`, 시작 명령 `npm start`, 환경 변수 `COPILOT_DIRECT_LINE_SECRET`** 세 가지만 맞추면 됩니다.

- **Render**: New → Web Service → 깃허브 저장소 선택 → Root Directory `server`, Start Command `npm start` → Environment에 키 추가
- **Azure App Service (Node)**: 앱 만들기 → 배포 센터에서 깃허브 연결(앱 경로 `server`) → 구성 > 애플리케이션 설정에 키 추가
- **학교·집 PC**: `npm start`로 실행 (PC가 꺼지면 앱도 연결 안 됨)

반드시 **https** 주소로 서비스하세요.

## 4. 앱에 서버 주소 넣고 배포

1. 프로젝트 루트의 `app-config.json`에 서버 주소를 넣습니다.

   ```json
   { "serverUrl": "https://내서버주소" }
   ```

   뒤에 `/token`을 안 붙여도 앱이 알아서 `https://내서버주소/token`으로 요청합니다. 붙여도 됩니다.

2. `npm run dist`로 `.exe`를 만듭니다. 처음 켜면 자동으로 이 서버에 연결됩니다.
3. 이미 ⚙에서 설정을 저장한 PC는 그 설정이 먼저입니다. ⚙ → "미르 서버 / 토큰 끝점 URL"을 고르고 주소를 넣으면 됩니다.

## 알아 둘 점

- 서버 주소를 아는 사람은 누구나 토큰을 받아 에이전트와 대화할 수 있습니다. 서버가 막아 주는 것은 **비밀 키 유출**이고, 남용은 요청 수 제한으로 줄입니다.
- 키가 유출된 것 같으면 Copilot Studio에서 키를 다시 만들고 **서버의 환경 변수만** 바꾸면 됩니다. 배포한 `.exe`는 그대로 둬도 됩니다.
- `server/.env`는 `.gitignore`에 걸려 깃허브에 올라가지 않습니다. `server` 폴더는 `.exe`에 들어가지 않습니다.
