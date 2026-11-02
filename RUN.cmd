@echo off
cd /d "%~dp0"if exist "%~dp0release-shared-integrated\mir-integrated.exe" (  start "" "%~dp0release-shared-integrated\mir-integrated.exe") else (  call npm.cmd start)
