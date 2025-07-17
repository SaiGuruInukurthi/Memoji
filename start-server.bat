@echo off
echo =========================================
echo   Face Avatar App - Node.js Server
echo =========================================
echo.

echo Checking for Node.js...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js found! Starting server...
    echo.
    echo Installing dependencies if needed...
    if not exist node_modules (
        echo Installing npm packages...
        npm install
        echo.
    )
    
    echo Starting Face Avatar App server on port 8000...
    echo.
    echo 🌐 Open your browser and go to: http://localhost:8000
    echo 📱 Or try: http://127.0.0.1:8000
    echo.
    echo 🛑 Press Ctrl+C to stop the server
    echo.
    npm start
) else (
    echo ❌ Node.js not found!
    echo.
    echo Please install Node.js from: https://nodejs.org/download
    echo.
    echo Alternative options:
    echo 1. Use VS Code with Live Server extension:
    echo    - Install "Live Server" extension
    echo    - Right-click index.html and select "Open with Live Server"
    echo.
    echo 2. Use Python if available:
    echo    - python -m http.server 8000
    echo.
)

pause
