@echo off
echo ========================================
echo     Testing Memoji Face Puppet App
echo ========================================
echo.

echo Starting Node.js server on port 8000...
echo.
echo Once the server starts:
echo 1. Open your browser
echo 2. Navigate to: http://localhost:8000
echo 3. Check the browser console (F12) for any errors
echo 4. Click "Start Camera" to test face tracking
echo.
echo Press Ctrl+C to stop the server when done.
echo.

if exist package.json (
    npm install --silent
    npm start
) else (
    npx serve . -p 8000
)
