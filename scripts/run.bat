@echo off
chcp 65001 >nul
cd /d "%~dp0.."

if "%~1"=="" goto usage
if /i "%~1"=="test" goto test
if /i "%~1"=="check" goto check
if /i "%~1"=="serve" goto serve
if /i "%~1"=="resize-images" goto resize
if /i "%~1"=="measure-drop4" goto drop4
if /i "%~1"=="replay-othello" goto replay
goto usage

:test
node tests\run-node.js
exit /b %errorlevel%

:check
node tests\static-check.js
exit /b %errorlevel%

:serve
node tests\tools\serve.js 8080
exit /b %errorlevel%

:resize
powershell -NoProfile -ExecutionPolicy Bypass -File tools\resize-images\resize-images.ps1
exit /b %errorlevel%

:drop4
node tests\tools\measure-drop4.js %2 %3 %4 %5 %6 %7 %8 %9
exit /b %errorlevel%

:replay
rem %* is not shifted by "shift", so pass the remaining arguments explicitly (up to 8).
node tests\tools\replay-othello.js %2 %3 %4 %5 %6 %7 %8 %9
exit /b %errorlevel%

:usage
echo Usage: scripts\run.bat ^<test^|check^|serve^|resize-images^|measure-drop4^|replay-othello^>
echo   replay-othello extra args: --write, --verbose, --only ^<key prefix^> (space-separated)
exit /b 1
