@echo off
cd /d "%~dp0" || exit /b 1
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js 20 or later is required.
  pause
  exit /b 1
)
node.exe "%~dp0serve.cjs" --open
if errorlevel 1 pause
