@echo off
setlocal
title Circuit Agent - Start services
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_services.ps1"
set "result=%errorlevel%"
echo.
if not "%result%"=="0" echo Startup needs attention. See the message above.
echo You may close this window. Background services will keep running.
pause
exit /b %result%
