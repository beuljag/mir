# 가져온 KiCad 회로도 검증

## 현재 구현과 설치 상태

미르 DB에서 KiCad 회로도를 자동 생성하지 않는다. 사용자가 따로 만든 `.kicad_sch` 파일을 가져와 검사한다.
FastAPI가 KiCad CLI의 ERC 및 SPICE 넷리스트 내보내기, ngspice의 배치 실행을 호출한다.
현재 PC에는 두 프로그램이 설치되지 않았다. 파일 가져오기와 API 연결은 구현했지만 실제 두 프로그램의 연동 검증은 설치 후 수행해야 한다.
자동 검사는 합성 CLI 응답과 안전한 자식 프로세스를 사용했으며 실제 회로 시뮬레이션을 수행했다고 주장하지 않는다.

## 1. 프로그램 설치 후 실행 경로 설정

- KiCad 공식 Windows 배포: https://www.kicad.org/download/windows/
- ngspice 공식 다운로드 안내: https://ngspice.sourceforge.io/download.html

설치는 이번 작업에서 실행하지 않았다. 설치 후 프로젝트 `.env`의 기존 빈 항목에 실제 실행 파일 경로를 넣는다.

```dotenv
KICAD_CLI_PATH=C:/Program Files/KiCad/설치버전/bin/kicad-cli.exe
NGSPICE_PATH=C:/설치폴더/bin/ngspice_con.exe
```

경로는 예시다. 설치한 버전·폴더·콘솔 실행 파일 이름으로 바꿔야 한다. API 키가 아니며 기존 인증 값은 유지한다.
KiCad가 PATH에 있으면 자동 탐색하고, Windows 기본 KiCad 설치 폴더도 확인한다. ngspice는 PATH 또는 위 설정을 사용한다.
설정은 요청 시 읽는다. 미르의 검증 창을 다시 열어 준비 여부를 확인한다.
CLI 계약은 KiCad 9 문서의 `sch erc --format json` 및 `sch export netlist --format spice`를 기준으로 했다.
설치 버전에서 동일 옵션이 지원되는지 실제 파일로 확인해야 한다.

## 2. 미르에서 사용

1. 웹사이트를 새로고침한다.
2. **배선 API·DB → KiCad 파일 검증**을 누른다.
3. 개별 파일들을 고르거나 프로젝트 폴더를 선택한다. 폴더 선택은 하위 모델 경로를 유지한다.
4. 주 `.kicad_sch`를 선택하고 **파일 가져오기**를 누른다.
5. 필요한 경우 **ngspice 시뮬레이션도 실행**을 선택한다.
6. DC 동작점(op) 또는 시간 변화(transient)를 고른다. 시간 변화는 시간 간격과 전체 시간을 지정한다.
7. 측정 항목은 `v(out), i(V1)`처럼 쉼표로 구분한다. 생략하면 일반 소자에서 찾은 최대 8개 노드 전압을 사용한다.
8. **검사 실행**을 누르고 ERC와 ngspice 상태를 각각 확인한다.

가져온 `project_id`는 에이전트에 전달할 수 있다. 원본 파일을 덮어쓰지 않으며 서버가 복사본으로 작업한다.
파일을 수정하면 다시 가져와 새 project_id를 사용한다.

## 3. 함께 가져와야 할 파일

- 주 회로도와 참조하는 모든 하위 `.kicad_sch`.
- ERC 프로젝트 설정이 필요한 경우 해당 `.kicad_pro`.
- 시뮬레이션에 사용하는 `.lib`, `.inc`, `.mod`, `.cir`, `.sp`, `.model` 텍스트 모델.

최대 40개, 파일당 5MB, 전체 16MB다. 폴더를 고르면 필요한 확장자만 가져온다.
모델과 하위 회로도 참조는 프로젝트 안의 상대 경로로 구성한다. 절대 경로나 `..` 경로는 사용하지 않는다.
외부 모델은 자동 다운로드하지 않는다. 설치된 KiCad 표준 라이브러리 외의 모델은 사용자가 함께 제공해야 한다.

## 4. 검사 결과의 의미

- 작업 `queued/running/completed/failed`는 서버 작업 상태다.
- ERC `passed/failed/warning/unknown/unavailable/not_requested`를 별도로 확인한다.
- ngspice `completed/failed/unknown/unsupported/unavailable/not_requested`를 별도로 확인한다.
- ngspice completed는 지정 모델의 수치 계산이 완료됐다는 의미이며 회로의 실제 안전성 통과 판정이 아니다.
- 실행 파일 누락은 `KICAD_CLI_NOT_FOUND` 또는 `NGSPICE_NOT_FOUND`이며 통과로 처리하지 않는다.
- 모델 파일 누락, 미지원 지시문, 제어 스크립트는 실행하지 않고 오류·지원 제한을 반환한다.
- 수치 표가 없으면 시뮬레이션 결과를 unknown으로 표시한다.
- 계산 표는 표당 최대 2,000행과 최대 20개 표를 반환하며 생략 여부를 표시한다. 원문은 작업 결과의 로그 아티팩트에서 조회할 수 있다.

이 결과는 가져온 파일에 대한 것이다. 별개의 미르 DB 회로를 passed로 바꾸거나 부품을 verified로 승인하지 않는다.
기존 `ValidateCircuit`은 미르 DB의 빠른 정적 검사로 유지한다.
기존 DB 회로용 `/circuits/{id}/simulate`는 자동 SPICE 모델 변환이 없으므로 계속 미구현 응답이다. 가져온 파일에는 새 VerifyKiCadProject 경로를 사용한다.

## 5. 현재 SPICE 지원 범위와 실행 제한

KiCad에서 SPICE 넷리스트를 내보낸 뒤 업로드된 모델만 연결하고 요청한 분석 명령을 추가한다.
원본에 있던 분석·출력 지시문은 요청의 op/transient 설정으로 대체된다.
기본 R/L/C, 전압·전류원, 다이오드·트랜지스터·하위회로 등 허용된 장치와 텍스트 모델을 지원한다.
모든 제조사 PSpice/XSPICE 변형을 지원하는 것은 아니다. 동적 OSDI/코드 모델과 `.control` 셸 스크립트, 임의 파일 입출력은 허용하지 않는다.
구조화된 요청의 측정식과 시간 설정을 사용하며 임의 명령 문자열은 실행하지 않는다.
각 외부 실행은 60초, 로그 5MB, 작업 폴더 32MB, Windows 프로세스 메모리 1GB 제한을 사용한다.
시간 변화의 지정 스텝 수는 최대 20,000이다. ngspice에는 로컬 초기화 파일을 읽지 않는 `-n`을 전달한다.
이 제한은 프로그램의 전체 동작을 가상화하는 OS 샌드박스라는 뜻은 아니다.

## 6. 에이전트 도구

기존 CircuitAgent 연결을 갱신한다. 현재 총 24개이며 추가한 도구는 다음 4개다.

| 도구 | 역할 |
|---|---|
| GetCircuitVerificationConfig | 실행 파일 준비 여부 확인 |
| ImportKiCadProject | 사용자가 제공한 파일 텍스트를 프로젝트로 저장 |
| GetKiCadProject | 가져온 프로젝트의 파일 목록·해시 확인 |
| VerifyKiCadProject | ERC·선택 ngspice 작업 시작 |

진행 상태와 결과는 기존 `GetJobStatus`로 조회한다. 서버 경로만 주고 임의 파일을 읽는 도구는 제공하지 않는다.
사용자가 미르에서 파일을 가져오면 에이전트는 project_id만 받아 VerifyKiCadProject를 호출하면 된다.
미르 파일 업로드는 로컬 자동 연결로 처리하며 API 키를 입력받지 않는다.

중앙과 검증 결과 해석 에이전트의 기존 기술 ZIP·지식 MD를 같은 이름의 현재 파일로 갱신한다.
적용 방법은 `outputs/copilot-agent-setup/설정안내.md`를 따른다. ZIP을 풀거나 별도 업데이트 묶음을 올리지 않는다.

## 7. API와 저장

- GET `/verification/config`
- POST `/verification/projects`: name, main_file, files[{name,content}].
- GET `/verification/projects/{project_id}`
- POST `/verification/projects/{project_id}/verify`: run_erc, run_ngspice, analysis, timestep, duration, vectors.
- GET `/jobs/{job_id}`
- GET `/verification/jobs/{job_id}/artifacts/{name}`: 허용된 로그·ERC JSON·넷리스트를 `{name,text}`로 반환.

모든 API는 기존 소유자별 인증을 사용한다. SQLite의 kicad_projects에 메타데이터를, jobs에 작업 상태를 저장한다.
실제 원본 복사본과 결과 파일은 `data/verification/{project_id}/`에 저장한다. 프로젝트·결과는 다른 소유자에게 노출하지 않는다.

공식 참고:
- KiCad CLI: https://docs.kicad.org/9.0/en/cli/cli.html
- KiCad 시뮬레이션: https://www.kicad.org/discover/spice/
- ngspice 매뉴얼: https://ngspice.sourceforge.io/docs/ngspice-manual.pdf
