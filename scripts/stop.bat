@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem ============================================================
rem  MindBody - shutdown script
rem  Soft-stops Node app (mindbody) + Caddy via PM2.
rem  Processes remain in PM2 list -> start.bat brings them back fast.
rem ============================================================

for /f %%E in ('"prompt $E$ & for %%e in (1) do rem"') do set "ESC=%%E"
set "C_OK=!ESC![92m"
set "C_ERR=!ESC![91m"
set "C_WARN=!ESC![93m"
set "C_INFO=!ESC![96m"
set "C_DIM=!ESC![90m"
set "C_BOLD=!ESC![1m"
set "C_HDR=!ESC![95m"
set "C_RST=!ESC![0m"

echo.
echo !C_BOLD!!C_HDR!============================================!C_RST!
echo !C_BOLD!!C_HDR!   MindBody  -  Shutdown Sequence!C_RST!
echo !C_BOLD!!C_HDR!============================================!C_RST!
echo !C_DIM!  [%date% %time%]  Stopping...!C_RST!
echo.

cd /d C:\mindbody

rem ============================================================
rem  [1/4]  Detect what's actually running
rem ============================================================
echo !C_INFO![1/4]!C_RST! Detecting PM2 state

where pm2 >nul 2>&1
if errorlevel 1 (
    echo !C_ERR![ERR]!C_RST!  PM2 not found in PATH - nothing to stop here
    endlocal & exit /b 1
)

set "FOUND_MB="
set "FOUND_CADDY="
call pm2 describe mindbody >nul 2>&1 && set "FOUND_MB=1"
call pm2 describe caddy    >nul 2>&1 && set "FOUND_CADDY=1"

if not defined FOUND_MB if not defined FOUND_CADDY (
    echo !C_INFO![INFO]!C_RST! No mindbody or caddy processes registered in PM2
    echo !C_DIM!        nothing to stop - exiting cleanly!C_RST!
    echo.
    call pm2 status
    echo.
    endlocal & exit /b 0
)

if defined FOUND_MB    echo !C_OK![OK]!C_RST!   mindbody is registered
if defined FOUND_CADDY echo !C_OK![OK]!C_RST!   caddy    is registered
if not defined FOUND_MB    echo !C_DIM!        mindbody not registered, skipping!C_RST!
if not defined FOUND_CADDY echo !C_DIM!        caddy not registered, skipping!C_RST!

echo.

rem ============================================================
rem  [2/4]  Stop processes (keep them in PM2 list)
rem ============================================================
echo !C_INFO![2/4]!C_RST! Stopping processes

set "STOP_TARGETS="
if defined FOUND_MB    set "STOP_TARGETS=!STOP_TARGETS! mindbody"
if defined FOUND_CADDY set "STOP_TARGETS=!STOP_TARGETS! caddy"

echo !C_DIM!        pm2 stop!STOP_TARGETS!!C_RST!
call pm2 stop!STOP_TARGETS! >nul 2>&1
set "STOP_RC=!errorlevel!"

if not "!STOP_RC!"=="0" (
    echo !C_WARN![WARN]!C_RST!  pm2 stop returned rc=!STOP_RC! - verify status manually
) else (
    echo !C_OK![OK]!C_RST!   stop command dispatched
)

echo.
echo !C_DIM!        waiting 2s for graceful shutdown...!C_RST!
ping -n 3 127.0.0.1 >nul

rem ============================================================
rem  [3/4]  Final PM2 status table
rem ============================================================
echo.
echo !C_INFO![3/4]!C_RST! Final PM2 status
echo.
call pm2 status
echo.

rem ============================================================
rem  [4/4]  Port verification - target ports should be free
rem ============================================================
echo !C_INFO![4/4]!C_RST! Port verification (3000, 80, 443 should be free)

set "STILL_BUSY="
netstat -ano | findstr /r ":3000.*LISTENING :80.*LISTENING :443.*LISTENING" >"%TEMP%\mb_ports_stop.txt" 2>nul
for /f "tokens=2,5" %%a in ('findstr /v "^$" "%TEMP%\mb_ports_stop.txt" 2^>nul') do (
    set "STILL_BUSY=1"
    echo !C_WARN![WARN]!C_RST!  port still occupied:  %%a    PID %%b
)
del "%TEMP%\mb_ports_stop.txt" >nul 2>&1

if not defined STILL_BUSY (
    echo !C_OK![OK]!C_RST!   ports 3000 / 80 / 443 are free
) else (
    echo !C_DIM!        ^(if a PID above is not ours - it's an unrelated process^)!C_RST!
)

echo.

rem ============================================================
rem  Footer
rem ============================================================
echo !C_BOLD!!C_OK!============================================!C_RST!
echo !C_BOLD!!C_OK!   MindBody stopped!C_RST!
echo !C_BOLD!!C_OK!============================================!C_RST!
echo !C_DIM!   Start again:        scripts\start.bat!C_RST!
echo !C_DIM!   Remove from PM2:    pm2 delete mindbody caddy!C_RST!
echo !C_DIM!   Save PM2 dump:      pm2 save!C_RST!
echo.

endlocal
exit /b 0
