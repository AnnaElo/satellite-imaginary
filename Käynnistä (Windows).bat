@echo off
cd /d "%~dp0"
start "Maapallo-palvelin" powershell -NoProfile -ExecutionPolicy Bypass -File "tools\palvelin.ps1" -Port 8000
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000/?offline"
