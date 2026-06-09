@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem ============================================================
rem  MindBody - startup script
rem  Brings up Node app (mindbody) + Caddy reverse proxy via PM2
rem ============================================================

rem ANSI escape sequence (works in Win10+ / Server 2019+ cmd.exe)
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
echo !C_BOLD!!C_HDR!   MindBody  -  Startup Sequence!C_RST!
echo !C_BOLD!!C_HDR!============================================!C_RST!
echo !C_DIM!  [%date% %time%]  Initializing...!C_RST!
echo.

cd /d C:\mindbody

rem ============================================================
rem  [1/6]  Environment check
rem ============================================================
echo !C_INFO![1/6]!C_RST! Pre-flight: environment

where node >nul 2>&1
if errorlevel 1 (
    echo !C_ERR![ERR]!C_RST!  Node.js not found in PATH
    echo        Install Node 20+ from https://nodejs.org/ and retry
    endlocal & exit /b 1
)
for /f "delims=" %%v in ('node --version 2^>nul') do echo !C_OK![OK]!C_RST!   Node  !C_DIM!%%v!C_RST!

where pm2 >nul 2>&1
if errorlevel 1 (
    echo !C_ERR![ERR]!C_RST!  PM2 not found in PATH
    echo        Install:  npm i -g pm2
    endlocal & exit /b 1
)
for /f "delims=" %%v in ('pm2 -v 2^>nul') do echo !C_OK![OK]!C_RST!   PM2   !C_DIM!v%%v!C_RST!

if not exist "C:\mindbody\caddy.exe" (
    echo !C_ERR![ERR]!C_RST!  caddy.exe not found in C:\mindbody\
    endlocal & exit /b 1
)
echo !C_OK![OK]!C_RST!   caddy.exe found

echo.

rem ============================================================
rem  [2/6]  Build artifacts check
rem ============================================================
echo !C_INFO![2/6]!C_RST! Pre-flight: build artifacts

if not exist "C:\mindbody\build\server\index.js" (
    echo !C_ERR![ERR]!C_RST!  build\server\index.js not found
    echo        Run:  npm run build
    endlocal & exit /b 1
)
echo !C_OK![OK]!C_RST!   build\ ready

if not exist "C:\mindbody\ecosystem.config.cjs" (
    echo !C_ERR![ERR]!C_RST!  ecosystem.config.cjs missing
    endlocal & exit /b 1
)
echo !C_OK![OK]!C_RST!   ecosystem.config.cjs found

if not exist "C:\mindbody\caddy-pm2.json" (
    echo !C_ERR![ERR]!C_RST!  caddy-pm2.json missing
    endlocal & exit /b 1
)
echo !C_OK![OK]!C_RST!   caddy-pm2.json found

if not exist "C:\mindbody\.env" (
    echo !C_WARN![WARN]!C_RST!  .env not found - app will run with defaults only
) else (
    echo !C_OK![OK]!C_RST!   .env present
)

echo.

rem ============================================================
rem  [3/6]  Port scan (informational only - PM2 reuses its own)
rem ============================================================
echo !C_INFO![3/6]!C_RST! Pre-flight: port scan (3000, 80, 443)

set "PORT_BUSY="
netstat -ano | findstr /r ":3000.*LISTENING :80.*LISTENING :443.*LISTENING" >"%TEMP%\mb_ports.txt" 2>nul
for /f "tokens=2,5" %%a in ('findstr /v "^$" "%TEMP%\mb_ports.txt" 2^>nul') do (
    set "PORT_BUSY=1"
    echo !C_DIM!        %%a    PID %%b!C_RST!
)
del "%TEMP%\mb_ports.txt" >nul 2>&1

if not defined PORT_BUSY (
    echo !C_OK![OK]!C_RST!   target ports free
) else (
    echo !C_DIM!        ^(PM2 will gracefully reuse its own processes^)!C_RST!
)

echo.

rem ============================================================
rem  [4/6]  Start / restart processes
rem ============================================================
echo !C_INFO![4/6]!C_RST! Starting processes via PM2

rem ---- mindbody ----
call pm2 describe mindbody >nul 2>&1
if errorlevel 1 (
    echo !C_DIM!        mindbody not registered, fresh start...!C_RST!
    call pm2 start ecosystem.config.cjs >nul 2>&1
    set "MB_RC=!errorlevel!"
) else (
    echo !C_DIM!        mindbody registered, restarting...!C_RST!
    call pm2 restart mindbody --update-env >nul 2>&1
    set "MB_RC=!errorlevel!"
)
if not "!MB_RC!"=="0" (
    echo !C_ERR![ERR]!C_RST!  mindbody failed to start ^(rc=!MB_RC!^)
    echo !C_DIM!--- mindbody error log ---!C_RST!
    call pm2 logs mindbody --nostream --lines 20 --err
    endlocal & exit /b 1
)
echo !C_OK![OK]!C_RST!   mindbody dispatched

rem ---- caddy ----
call pm2 describe caddy >nul 2>&1
if errorlevel 1 (
    echo !C_DIM!        caddy not registered, fresh start...!C_RST!
    call pm2 start caddy-pm2.json >nul 2>&1
    set "CD_RC=!errorlevel!"
) else (
    echo !C_DIM!        caddy registered, restarting...!C_RST!
    call pm2 restart caddy >nul 2>&1
    set "CD_RC=!errorlevel!"
)
if not "!CD_RC!"=="0" (
    echo !C_ERR![ERR]!C_RST!  caddy failed to start ^(rc=!CD_RC!^)
    echo !C_DIM!--- caddy error log ---!C_RST!
    call pm2 logs caddy --nostream --lines 20 --err
    endlocal & exit /b 1
)
echo !C_OK![OK]!C_RST!   caddy dispatched

echo.
echo !C_DIM!        waiting 3s for processes to settle...!C_RST!
ping -n 4 127.0.0.1 >nul

rem ============================================================
rem  [5/6]  PM2 status table + HTTP health-check
rem ============================================================
echo.
echo !C_INFO![5/6]!C_RST! PM2 status
echo.
call pm2 status
echo.

echo !C_INFO![ ]!C_RST!  HTTP health-check  !C_DIM!GET http://localhost:3000!C_RST!
curl -s -o nul -w "        HTTP %%{http_code}   time=%%{time_total}s   bytes=%%{size_download}\n" --max-time 8 http://localhost:3000
if errorlevel 1 (
    echo !C_WARN![WARN]!C_RST!  curl request failed - app may still be warming up
) else (
    echo !C_OK![OK]!C_RST!   health-check completed
)

echo.

rem ============================================================
rem  [6/6]  Recent logs (visual confirmation that nothing burns)
rem ============================================================
echo !C_INFO![6/6]!C_RST! Recent logs
echo.
echo !C_DIM!--------  mindbody  ^(last 15 lines^)  --------!C_RST!
call pm2 logs mindbody --nostream --lines 15
echo.
echo !C_DIM!--------  caddy  ^(last 5 lines^)  --------!C_RST!
call pm2 logs caddy --nostream --lines 5
echo.

rem ============================================================
rem  Footer
rem ============================================================
echo !C_BOLD!!C_OK!============================================!C_RST!
echo !C_BOLD!!C_OK!   MindBody is running!C_RST!
echo !C_BOLD!!C_OK!============================================!C_RST!
echo !C_DIM!   Public:    https://saleid.icu!C_RST!
echo !C_DIM!   Local:     http://localhost:3000!C_RST!
echo !C_DIM!   Monitor:   pm2 monit!C_RST!
echo !C_DIM!   Stop:      scripts\stop.bat!C_RST!
echo.

rem ============================================================
rem  Live log stream - keeps the terminal open
rem  (server keeps running in PM2 after you press Ctrl+C)
rem ============================================================
echo !C_BOLD!!C_HDR!============================================!C_RST!
echo !C_BOLD!!C_HDR!   Live logs  -  press Ctrl+C to exit!C_RST!
echo !C_BOLD!!C_HDR!   ^(server stays online in PM2^)!C_RST!
echo !C_BOLD!!C_HDR!============================================!C_RST!
echo.
call pm2 logs --lines 0

endlocal
exit /b 0
