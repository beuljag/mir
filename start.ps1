$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw '가상환경 생성 실패' }
}
& .\.venv\Scripts\python.exe -c "import importlib.util, sys; sys.exit(0 if all(importlib.util.find_spec(x) for x in ('fastapi', 'uvicorn', 'pydantic', 'mcp', 'httpx', 'pypdf')) else 1)"
if ($LASTEXITCODE -ne 0) {
    if (Test-Path -LiteralPath 'work\wheels') {
        & .\.venv\Scripts\python.exe -m pip install --no-index --find-links work\wheels -r requirements.txt
    } else {
        & .\.venv\Scripts\python.exe -m pip install --disable-pip-version-check -r requirements.txt
    }
    if ($LASTEXITCODE -ne 0) { throw '패키지 설치 실패' }
}
& .\.venv\Scripts\python.exe scripts\setup_local_key.py
if ($LASTEXITCODE -ne 0) { throw 'API key setup failed' }
Write-Host '고정 키 파일: config/local-api-keys.json (JSON의 속성 이름을 API 키로 사용하세요.)'
if ($env:CIRCUIT_API_KEYS) { Write-Host '주의: 현재 셸의 CIRCUIT_API_KEYS 환경 변수가 파일보다 우선합니다.' }
Write-Host '편집기: http://127.0.0.1:8000   API 문서: http://127.0.0.1:8000/docs'
& .\.venv\Scripts\python.exe run.py
