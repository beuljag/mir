# MIR HTML: Railway 호환성 및 배포

## V106: 기존 공개 연결로 API 키 입력 생략

사용자의 최신 요청에 따라 로그인·게스트 세션·호출/사용량 제한은 추가하지 않습니다. 기존 공유 서버에서 이미 활성화된 `/mir/api` 공개 연결을 Railway 웹이 중계하도록 수정했습니다. 새 환경 변수나 웹 서버 보관용 관리자 키는 필요하지 않습니다. 백엔드 API 키 인증과 공개 연결의 허용/거절은 그대로 유지합니다.

웹 요청은 기존 출처와 MIR_BACKEND_URL만 허용하며 사용자 키 헤더를 전달하지 않습니다. `/connection`은 공개 주소와 `authentication: backend-public`만 알려줍니다. 해당 웹 연결 화면은 API 키 입력칸을 숨기고 자동 연결을 안내합니다. 로컬·직접 파일 실행의 기존 인증 방식은 유지합니다.

현재 실제 웹의 승인 백엔드는 `/connection` 응답의 공유 Dev Tunnel 주소이며, 이 서버에서 키 없는 부품 조회(17개)와 Copilot configured=true를 확인했습니다. 별도 Railway 백엔드는 configured=false라 연결 대상을 그쪽으로 임의 변경하지 않았습니다. 기존 서버 주소·비밀 값·Volume·운영 설정은 변경하지 않습니다.

## 적용 범위

이 저장소는 `meuyeehug/mir`의 HTML 웹 앱과 필요한 Node/Python 서버를 관리합니다. EXE, Electron, 데스크톱 빌드 파일은 추가하지 않습니다. 데스크톱 원본은 `beuljag/mir`에 유지합니다. 이번 변경은 V95 UI를 유지하면서 실행 환경, 영구 저장 검사, 빌드·동기화 절차를 보완합니다. DB 스키마는 변경하지 않습니다.

전체 개발 지침은 루트 `AGENTS.md`, V95 원본 정보는 `mir-version.json`에 보존했습니다.

## 읽기 전용으로 확인한 운영 구성

확인일: 2026-11-16. Railway 커넥터로 설정과 상태를 조회했습니다. 비밀 값은 가려져 있어 값의 정확성은 검증하지 않았습니다.

| 항목 | 웹 | 백엔드 |
|---|---|---|
| 프로젝트 / 환경 | innovative-healing / production | 동일 |
| 서비스 | mir | calm-vibrancy |
| GitHub / 브랜치 | meuyeehug/mir / main | 동일 |
| Root Directory | `/` | `/서버` |
| Start Command | `node serve.cjs` | `python run.py` |
| Builder | Railpack (V3) | Railpack (V3) |
| 공개 주소 | https://mir-production-11d1117d.up.railway.app | https://calm-vibrancy-production-07af9f2a.up.railway.app |
| 도메인 대상 포트 | 8791 | 8000 |
| 복제본 | 1 | 1 |
| Volume | 없음 | 기존 `/data`, 500 MB |

두 서비스의 최근 배포는 SUCCESS였고 대기 중인 설정 변경은 없었습니다. 공개 `/connection`과 백엔드 `/health`는 200, 키 없는 `/components/search`는 401이었습니다. 이 조회는 기존 배포에 대한 검사이며 이번 코드가 배포됐다는 뜻은 아닙니다.

이번 작업에서 서비스·도메인·변수·볼륨 생성/변경/삭제나 배포는 하지 않았습니다. 예전 안내의 프로젝트 `MIR`, 서비스 `MIR-WEB`/`MIR-SERVER`, 양쪽 루트 `/`, Docker 강제 전환은 실제 구성과 달라 정정했습니다.

## 실행 환경과 변수

연결 시스템을 구현·변경하기 전에 [서버 연결 시스템 근본 개선 지침](CONNECTION_SYSTEM_GUIDELINES.md)의 전체 분석·Connection Manager·인증·복구·독립 상태·필수 테스트 기준도 함께 적용합니다. 지침 저장은 구현 완료나 운영 배포 승인이 아닙니다.

### Railway 자동 연결의 필수 보안 기준

2026-11-16 추가된 사용자 정책이며 전체 내용은 루트 `AGENTS.md` 15절에 보존합니다. 다음 항목은 자동 연결 기능의 구현·검증 조건입니다. 현재 완료되었다는 의미가 아닙니다.

- 실제 API 키와 Direct Line Secret은 백엔드 환경 변수에서만 관리하고 Railway Sealed Variables를 고려합니다. HTML/JS/Electron 렌더러, 공개 응답, 로그에 노출하지 않습니다.
- 로그인과 세션 기반 인증을 적용하고, 비로그인 사용자가 서버의 관리자 키를 간접 사용하지 못하도록 차단합니다.
- 사용자별 데이터 권한, 호출 횟수 제한, 사용량 제한을 적용합니다.
- 기존 인증과 백엔드 허용 목록·SSRF 방어를 유지합니다.
- 개발자 도구·네트워크 응답·서버 로그·GitHub 소스·빌드 산출물의 비밀 노출을 검사합니다.
- 자동 연결 성공과 함께 비로그인/만료 세션/타 사용자 접근/제한 초과/미승인 목적지 차단을 검사하고 결과 및 미검증 범위를 보고합니다.

아래의 기존 웹 접속용 API 키 입력 설명은 기존 구현에 대한 기록입니다. Railway 자동 연결 구현에는 위 정책을 우선 적용하며, 기존 인증을 제거하는 대신 세션과 사용자별 인가를 함께 적용합니다.

- `MIR_DEPLOYMENT` 미설정: 기존 Windows 로컬 모드.
- `MIR_DEPLOYMENT=railway`: 클라우드 모드. HOST 기본 `0.0.0.0`, 브라우저 자동 열기와 로컬 자동 인증 비활성화.
- `PORT`: 1~65535 정수. 미설정 시 웹 8791, 백엔드 8000. Railway 지정값이 우선합니다.
- cloud에서는 기존/자동 주입 `HOST` 값과 무관하게 앱이 `0.0.0.0`을 사용합니다. 로컬에서는 사용자 지정 HOST를 유지합니다.
- 잘못된 설정은 필요한 변수 이름을 포함해 시작 시 실패하며 입력 값이나 키를 오류에 출력하지 않습니다.

### 웹

`MIR_WEB_ORIGIN`은 웹의 공개 HTTPS 원점, `MIR_BACKEND_URL`은 승인된 백엔드의 공개 HTTPS 원점입니다. 경로·사용자 정보·끝 `/` 없이 지정합니다. `MIR_DEPLOYMENT`, `HOST`, `PORT`도 지원합니다.

다른 백엔드 주소, 다른 요청 출처, 키 누락, 미허용 API 경로, 리디렉션은 계속 차단합니다. `/connection`은 공개 연결 정보만 반환합니다. `/health`는 웹 상태 확인에 사용합니다.

### 백엔드

- 인증: `CIRCUIT_API_KEY` 또는 `CIRCUIT_API_KEYS`. 키 24자 이상 및 소유자 매핑을 유지합니다. `CIRCUIT_API_OWNER` 변경은 기존 데이터 접근에 영향을 줄 수 있습니다.
- 영구 저장: `CIRCUIT_DB_PATH=/data/circuits.db`와 기존 Volume 연결. Railway 자동 주입 `RAILWAY_VOLUME_MOUNT_PATH`도 확인합니다. 마운트가 실제 디렉터리인지, DB가 그 안의 파일인지 검사합니다. 운영 DB 경로 값 자체는 이번 조회에서 가려져 있었습니다.
- CORS: `MIR_CORS_ORIGINS`는 승인할 웹 HTTPS 원점만 지정합니다. `*`로 확장하지 않습니다.
- AI: Copilot 연결의 `COPILOT_DIRECT_LINE_SECRET`, 필요 시 `COPILOT_DIRECT_LINE_DOMAIN`, `COPILOT_CHAT_MODE`를 사용합니다. `OPENAI_API_KEY`, `BRAVE_SEARCH_API_KEY`, `CIRCUIT_REVIEW_KEY`는 해당 기능에만 필요합니다. 모든 AI 키를 일괄 필수로 만들지 않습니다.
- 현재 조회에서 AI 공급자 변수 이름은 확인되지 않았습니다. 실제 AI 응답 성공은 미검증입니다. `/chat/config`의 미구성 상태 반환은 테스트했습니다.

기존 운영 변수 값을 변경하지 않았습니다. 새 사용자 비밀 변수는 추가하지 않습니다. 기존 변수와 자동 주입 변수의 검증을 강화한 변경입니다. 실제 키는 백엔드 Variables에 보관하고 Sealed Variables를 권장합니다. 기존 웹 접속용 키 입력 동작은 유지하지만 AI 공급자 비밀을 HTML/JS에 넣지 않습니다. 테스트 키는 가짜 값입니다.

## 로컬 실행과 직접 HTML 열기

```sh
npm ci
npm run build
npm start
```

`http://127.0.0.1:8791`에 접속합니다. `npm run start:local`은 로컬에서만 브라우저를 엽니다. `미르 HTML.html`을 직접 열어 제작대와 예제를 사용하는 방식도 유지합니다. 파일로 연 페이지의 실제 원격 API 사용은 백엔드 CORS 정책에 따르며 브라우저 보안을 우회하지 않습니다.

Python 3.12에서 `서버/requirements.txt`를 설치하고 `서버` 폴더에서 `python run.py`로 실행합니다. 로컬 기본 127.0.0.1:8000/8002 리스너와 로컬 키 파일 지원을 유지합니다. HOST/PORT 지정 시 단일 리스너입니다. `pywin32`는 Windows에만 설치합니다.

클라우드에서는 로컬 `.env`, `local-api-keys.json`, `local-review-key.json`, `research-secrets.json`을 비밀 값 대체 소스로 읽지 않습니다. 친구 PC의 BAT/Dev Tunnel은 로컬 서버 실행·공개 도구입니다. Railway 서비스가 연결되면 공개 역할을 Railway HTTPS 도메인이 담당할 수 있습니다. 별도 PC 커넥터의 실제 의존성을 확인하지 않고 서비스를 새로 만들거나 친구 PC 주소를 강제로 바꾸지 않습니다.

KiCad/NGSpice 실행 파일은 컨테이너에 포함하지 않습니다. Linux 도구 설치와 실제 검증이 필요하며 설치되지 않은 기능을 검증 완료로 표시하지 않습니다.

## 다음 HTML 버전 가져오기

```sh
npm ci
npm run sync:html -- "<새 MIR 버전의 미르 HTML 폴더>"
npm test
```

`scripts/sync-html.cjs`는 entry/UI/회로 엔진/도움말을 갱신하고 번들을 빌드합니다. `serve.cjs`, 환경 검사, Python 서버, Docker 설정, 배포 규칙 및 인증 어댑터 `assets/web-api.js`, `assets/server-connection.js`는 덮어쓰지 않습니다. `initWorkspace` 계약과 버전 정보를 확인하며 변경 후 API/UI 회귀 검사가 필요합니다. 복사나 빌드 실패 시 부분 변경을 검토하고 업로드하지 않습니다. 자동 commit/push/배포는 하지 않습니다.

## DB와 복구

SQLite와 등록 부품/검증 작업 파일은 기존 볼륨의 DB 상위 경로에 저장됩니다. 이번 변경에는 DB 초기화·테이블 삭제·마이그레이션·볼륨 수정이 없습니다. 임시 테스트 DB만 쓰기·재시작 검사했습니다. SQLite 때문에 백엔드 복제본은 현재 1개를 유지하며 다중 인스턴스 확장은 별도 설계가 필요합니다.

병합/배포 전 SQLite 백업 API 또는 정지 후 일관된 DB/WAL/SHM 보존 방식으로 백업하고 복원 가능성을 확인하세요. 실행 중 `.db` 하나만 복사하는 것은 안전한 백업으로 간주하지 않습니다. 이번 작업에서 운영 백업/볼륨 파일을 직접 다루지 않았습니다.

배포 후 health·인증·실제 AI·MCP·DB 읽기/쓰기·재시작 후 유지를 확인합니다. 문제 시 이전 정상 배포로 코드 롤백하며 Volume은 유지합니다. 스키마 변경이 있었다면 해당 버전의 백업/마이그레이션 복구가 선행되어야 합니다.

## 설정 관리와 배포 승인

현재 저장소에 `railway.json`/`railway.toml`은 없습니다. [공식 IaC 문서](https://docs.railway.com/infrastructure-as-code)와 [CLI 안내](https://docs.railway.com/cli#infrastructure-as-code)를 확인했습니다. `.railway/railway.ts`는 기존 상태를 `railway config pull`로 가져온 후 `railway config plan`으로 차이를 검토하는 방식입니다. [기존 Config as Code](https://docs.railway.com/config-as-code)는 사용 중단 안내가 있어 새 JSON/TOML을 임의로 만들지 않습니다.

이번에는 실제 상태만 읽기 전용 확인했으며 인증된 CLI의 설정 가져오기나 apply는 하지 않았습니다. 리소스 재생성을 유발할 수 있는 추정 IaC 파일을 작성하지 않았습니다. 도입 시 비밀 값 유출 여부를 검사하고 기존 리소스 ID를 보존한 plan을 승인받은 뒤에만 적용합니다.

운영 두 서비스는 Railpack입니다. Dockerfile은 선택적 컨테이너 검사 경로이며 운영 빌더/시작 명령을 자동 전환하지 않습니다. main 병합은 자동 배포를 실행할 수 있어 검토 브랜치/PR로만 업로드합니다. 강제 push, 서비스/브랜치 삭제는 하지 않습니다.

## 변경 파일과 검사

### HOST 충돌로 인한 시작 실패 수정

`logs.1794761780214.log`에는 웹 프로세스가 `HOST=0.0.0.0` 검사에서 반복 종료된 기록이 있습니다. 기존 HOST를 먼저 읽은 뒤 그 값을 거부하는 검사가 원인이었습니다. Railway 모드에서 앱이 항상 `0.0.0.0`으로 바인딩하도록 Node/Python을 함께 수정했습니다. 운영 변수 값은 수정할 필요가 없고 로컬 HOST 사용자 지정은 유지됩니다. PORT, HTTPS 원점, 승인 백엔드, 인증, Volume 검사는 유지합니다.

기존 HOST가 `127.0.0.1`, `localhost`, IPv6, 이전 호스트 이름인 경우의 회귀 검사와 실제 웹 프로세스 시작 검사를 추가했습니다. Windows에서 Node 29건/Python 6건이 통과했습니다. Linux CI는 로그와 같은 Node 20과 컨테이너의 Node 22를 검사하며, 두 컨테이너에 HOST=127.0.0.1을 주입해도 외부 health 요청이 성공하는지 확인합니다. 실제 운영 복구는 PR 승인·배포 이후 따로 확인해야 합니다.

- `runtime-config.cjs`, `serve.cjs`, `mir-version.json`: 환경/URL/포트 검사, cloud 자동 브라우저 금지, 웹 health, 버전 정보.
- `서버/app/runtime_config.py`, `run.py`, `main.py`, `local_connection.py`, `directline_chat.py`, `research.py`: HOST/PORT, 필수 Volume, cloud 비밀 파일 대체 읽기 금지.
- `package.json`, lockfile, `scripts/`, Dockerfile, ignore: 웹 빌드, 안전한 HTML 갱신, requirements 기준 설치, 비밀/EXE 제외.
- `AGENTS.md`, 이 문서, 기존 배포 안내: 전체 규칙과 실제 구성 기록.
- `tests/`, `.github/workflows/compatibility.yml`: Node/Python 회귀와 Ubuntu/Docker 검사를 배포와 분리.

Windows에서 Node 22건, Python 6건 통과. 임시 DB 저장/재시작, 실제 Uvicorn HOST/PORT, 인증/CORS, MCP initialize를 포함합니다. Chrome의 파일 직접 열기와 HTTP 실행, PC 1440px/모바일 390px에서 LED 예제(부품 3개/선 3개) 및 되돌리기가 통과했습니다. 선택 이미지 200/null과 기존 승인 주소/인증/경로 차단도 통과했습니다. 모의 공급자 검사는 실제 운영 AI 성공을 의미하지 않습니다.

이 PC에는 Docker/WSL이 없어 컨테이너 검사는 GitHub Ubuntu CI에서 수행했습니다. [검사 실행 43737616075](https://github.com/meuyeehug/mir/actions/runs/43737616075)에서 Node/Python 테스트와 웹·백엔드 Docker 이미지 빌드 및 health가 모두 통과했습니다. 이후 커밋의 최신 결과는 PR Checks에서 확인합니다. 컨테이너 준비를 기다린 뒤 health를 검사하고 실패 시 임시 컨테이너 진단 로그를 남깁니다. 실제 Railway 재배포, 운영 DB 변경/재시작, AI 실제 응답, KiCad/NGSpice는 미검증입니다.
