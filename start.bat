@echo off
title Dungeon Forge
cd /d "%~dp0"

set "BROWSER="
for %%P in (^
    "%ProgramFiles%\Google\Chrome\Application\chrome.exe" ^
    "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" ^
    "%LocalAppData%\Google\Chrome\Application\chrome.exe" ^
    "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" ^
    "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"^
) do (
    if not defined BROWSER if exist "%%~P" set "BROWSER=%%~P"
)

echo Dungeon Forge - starting dev server...
echo The app window will open in a moment.
echo Close THIS window to stop the app.
echo.

start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open_app.ps1" "%BROWSER%"

call npm run dev
