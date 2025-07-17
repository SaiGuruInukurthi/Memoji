@echo off
echo =========================================
echo      Face Puppet App - Start Server
echo =========================================
echo.

echo Checking for Python...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python found! Starting HTTP server on port 8000...
    echo.
    echo Open your browser and go to: http://localhost:8000
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    python -m http.server 8000
) else (
    echo Python not found. Trying alternative methods...
    echo.
    
    echo Checking for Node.js...
    node --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo Node.js found! Installing serve...
        npx serve . -p 8000
    ) else (
        echo Neither Python nor Node.js found.
        echo.
        echo Please install one of the following:
        echo 1. Python: https://python.org/downloads
        echo 2. Node.js: https://nodejs.org/download
        echo.
        echo Or use VS Code with Live Server extension:
        echo - Install "Live Server" extension
        echo - Right-click index.html and select "Open with Live Server"
        echo.
    )
)

pause
