@echo off
title Barangay Natumolan MIS - Dev Launcher
echo ======================================================
echo    Barangay Natumolan Management Information System
echo ======================================================
echo.
echo Launching Backend Server, Queue Worker, and Frontend...
echo.

start "Barangay Natumolan - Backend Server" cmd /c "cd /d %~dp0backend && php artisan serve"
start "Barangay Natumolan - Queue Worker" cmd /c "cd /d %~dp0backend && php artisan queue:listen --tries=3"
start "Barangay Natumolan - Frontend" cmd /c "cd /d %~dp0frontend && npm run dev"

echo Services started:
echo   - Backend API:  http://127.0.0.1:8000
echo   - Queue Worker: Active in background window
echo   - Frontend:     http://localhost:5173
echo.
echo Press any key to close this launcher window (services keep running).
pause > nul
