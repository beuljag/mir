# 미르

브라우저에서 부품을 배치하고 배선을 구성하는 미르 HTML 프로젝트예요. 웹 제작대, 기본 부품 자료, Python 서버 코드와 배포 설정을 함께 보관해요.

## 실행

`미르 HTML.html`을 브라우저로 열거나, Node.js 20 이상을 설치한 뒤 이 폴더에서 실행하세요.

```sh
npm start
```

브라우저에서 <http://127.0.0.1:8791>에 접속하세요. 자세한 사용 방법은 [실행 안내](실행%20안내.md)를 확인하세요.

## 서버 연결

AI와 DB 기능에는 별도 서버 설정이 필요해요. `서버/.env.example`을 참고해 로컬 환경 변수를 설정하세요. 실제 API 키, 실행 로그, 데이터베이스와 캐시는 저장소에 포함하지 않아요.

- [서버 공유 연결](서버/docs/공유-서버-연결.md)
- [Copilot Studio 연결](서버/docs/Copilot-Studio-연결-안내.md)
- [Railway 배포 안내](Railway%20배포%20안내.md)

## 파일 구성

- `미르 HTML.html`, `미르.css`, `미르.js`: 바로 실행할 수 있는 웹 제작대
- `entry.js`, `assets/`, `docs/`: 웹 소스, 이미지와 도움말
- `serve.cjs`, `package.json`: Node.js 웹 실행기
- `서버/`: Python 서버, 기본 부품과 설정 예제
- `Dockerfile.web`, `Dockerfile.server`: 배포용 컨테이너 설정


## V95 HTML 반영

기준 원본은 `beuljag/mir` main의 `V95/미르 HTML`입니다 (커밋 `1362a28a9f685e9c6680bfaa1e78bb8c9950941e`). 웹 화면·브라우저 소스·도움말을 반영했습니다. 기존 Railway 설정과 Python 서버는 유지하며, 웹 실행기의 연결 정보와 중계 호환 처리만 보완했습니다. EXE·Electron·데스크톱 빌드 파일은 포함하지 않습니다.

## Railway 호환 개발

[전체 배포·복구 안내](docs/RAILWAY_DEPLOYMENT.md)와 루트 `AGENTS.md`를 먼저 확인하세요. `npm ci`, `npm run build`, `npm test`로 웹을 빌드·검사합니다. 서버 검사는 Python 의존성 설치 후 `npm run test:server`로 실행합니다.

다음 MIR HTML 원본은 `npm run sync:html -- "<원본 폴더>"`로 가져옵니다. 배포·인증 어댑터와 Python 서버를 보존하며 브라우저 번들을 다시 만듭니다. main 병합은 자동 배포를 실행할 수 있으므로 검토 브랜치에서 검사하세요.
