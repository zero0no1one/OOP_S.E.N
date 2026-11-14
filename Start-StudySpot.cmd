@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-backend.ps1" -LocalNetwork -Port 8081
pause
