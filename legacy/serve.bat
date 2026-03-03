@echo off
echo ============================================
echo   MIND BODY - Local Development Server
echo ============================================
echo.
echo [1/2] Starting Backend Server (port 4444)...
start "MIND BODY Backend" cmd /k "cd server && uvicorn main:app --reload --port 4444"

echo [2/2] Starting Frontend Server (port 4000)...
echo.
echo Open http://localhost:4000 in your browser
echo.
python -m http.server 4000
pause
