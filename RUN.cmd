@echo off
cd /d "%~dp0"
if exist "%~dp0release-shared-auto\mir-shared.exe" (
  start "" "%~dp0release-shared-auto\mir-shared.exe"
) else if exist "%~dp0release-v95\mir-V95.exe" (
  start "" "%~dp0release-v95\mir-V95.exe"
) else if exist "%~dp0release-shared-integrated\mir-integrated.exe" (
  start "" "%~dp0release-shared-integrated\mir-integrated.exe"
) else (
  call npm.cmd start
)
