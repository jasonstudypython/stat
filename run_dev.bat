@echo off
setlocal

cd /d "%~dp0"
echo Starting Next.js dev server in %CD%

set "APP_URL=http://localhost:3000"
set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if exist "%CHROME_EXE%" (
  start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 5; Start-Process -FilePath '%CHROME_EXE%' -ArgumentList '%APP_URL%'"
) else (
  start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 5; Start-Process '%APP_URL%'"
)

call npm.cmd run dev

if errorlevel 1 (
  echo.
  echo Dev server exited with an error.
  pause
)
