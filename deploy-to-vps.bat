@echo off
title Deploy Barangay Natumolan to VPS
echo ===================================================================
echo   BARANGAY NATUMOLAN - 1-CLICK DEPLOYMENT TO HOSTBRR VPS
echo ===================================================================
echo   Server IP: 77.90.8.113
echo   Domain:    barangaynatumolan.tech
echo ===================================================================
echo.
echo [1/2] Nag-a-upload ng mga files sa VPS...
echo (Paalala: Kapag humingi ng password, i-paste o i-type ang Root Password mo)
echo.

scp setup-server.sh barangay_natumolan.tar.gz root@77.90.8.113:/root/

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [X] Hindi na-upload ang mga files.
    echo     Pakisuri kung tama ang root password o kung online ang VPS.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/2] Matagumpay na na-upload! Sinisimulan ang automated setup sa VPS...
echo.

ssh -t root@77.90.8.113 "chmod +x /root/setup-server.sh && /root/setup-server.sh"

echo.
echo ===================================================================
echo   TAPOS NA ANG DEPLOYMENT!
echo   Maaari mo nang buksan sa browser: https://barangaynatumolan.tech
echo ===================================================================
echo.
pause
