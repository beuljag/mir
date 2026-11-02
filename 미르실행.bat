@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist node_modules\electron\dist\electron.exe (
  call npm.cmd ci
  if errorlevel 1 (
    echo Dependency installation failed. Check the network and run again.
    pause
    exit /b 1
  )
)
call npm.cmd start
if errorlevel 1 pause
