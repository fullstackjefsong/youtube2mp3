@echo off
rem One-step installer for youtube2mp3 on Windows (cmd / double-click friendly).
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" goto finished
call "%LOCALAPPDATA%\youtube2mp3\command\activate.cmd"
:finished
if /i "%~1" neq "/quiet" pause
exit /b %EXITCODE%
