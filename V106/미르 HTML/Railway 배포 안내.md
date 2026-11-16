# Railway 배포 안내

최신 기준은 [Railway 호환성 및 배포 문서](docs/RAILWAY_DEPLOYMENT.md)입니다.

현재 운영 프로젝트는 **innovative-healing / production**이며 웹 서비스는 **mir**(루트 `/`, `node serve.cjs`), 백엔드는 **calm-vibrancy**(루트 `/서버`, `python run.py`)입니다. 두 서비스는 Railpack을 사용합니다. 기존 루트·시작 명령·도메인·볼륨을 유지하세요.

예전 안내의 `MIR-WEB`·`MIR-SERVER` 서비스 생성, 루트 비우기, Docker 빌더 전환은 현재 구성에 적용하지 않습니다. Dockerfile은 별도 검증용이며 운영 빌더를 자동으로 바꾸지 않습니다.

main 병합은 자동 배포를 실행할 수 있습니다. 검사 결과와 환경 변수·백업 상태를 확인하고 승인된 때에만 병합하세요.
