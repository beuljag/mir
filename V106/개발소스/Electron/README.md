# MIR V106 Windows 실행기

Electron의 격리된 렌더러에서 V106 HTML 제작대를 실행합니다. Node.js 통합은 끄고 contextIsolation/sandbox를 사용합니다. 정적 제작대와 중계 서버는 이 앱 프로세스에서 127.0.0.1의 사용 가능한 임의 포트에만 바인딩합니다. API 키와 Copilot 비밀 값은 포함하지 않습니다.

## 빌드

Node.js를 설치하고 이 폴더에서 `npm install`, `npm run dist`를 실행합니다. Electron 33.4.11 및 electron-builder 25.1.8을 사용합니다. `web/`는 V106 HTML의 브라우저 번들과 런타임 파일입니다. UI 원본 수정 시 V106 HTML에서 먼저 번들을 다시 생성하고 web/에 반영하세요.

출력은 `V106/EXE/mir-V106.exe`입니다. `win-unpacked`와 빌드 로그는 Git에 올리지 않습니다. `기존데스크톱` 폴더는 이전 개발 소스를 보존한 것으로 이 V106 빌드에 자동 혼합하지 않습니다.

## 검증 범위

검사 결과와 최종 EXE의 SHA-256은 V106/EXE 및 V106/검사결과에 기록합니다. 코드 서명 인증서는 설정하지 않았습니다. Windows 외 OS용 EXE는 생성하지 않습니다.
