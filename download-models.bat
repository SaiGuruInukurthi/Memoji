@echo off
echo =========================================
echo    Face Puppet App - Model Downloader
echo =========================================
echo.
echo This script will download the required face-api.js models
echo to the models/ folder for face detection and expression tracking.
echo.

if not exist "models" (
    echo Creating models directory...
    mkdir models
)

cd models

echo Downloading face detection models...
echo.

echo [1/6] Downloading tiny_face_detector_model-weights_manifest.json...
curl -L -o tiny_face_detector_model-weights_manifest.json "https://github.com/justadudewhohacks/face-api.js-models/raw/master/tiny_face_detector/tiny_face_detector_model-weights_manifest.json"
if %errorlevel% neq 0 (
    echo Error downloading file 1. Please check your internet connection.
    pause
    exit /b 1
)

echo [2/6] Downloading tiny_face_detector_model-shard1...
curl -L -o tiny_face_detector_model-shard1 "https://github.com/justadudewhohacks/face-api.js-models/raw/master/tiny_face_detector/tiny_face_detector_model-shard1"
if %errorlevel% neq 0 (
    echo Error downloading file 2. Please check your internet connection.
    pause
    exit /b 1
)

echo [3/6] Downloading face_landmark_68_model-weights_manifest.json...
curl -L -o face_landmark_68_model-weights_manifest.json "https://github.com/justadudewhohacks/face-api.js-models/raw/master/face_landmark_68/face_landmark_68_model-weights_manifest.json"
if %errorlevel% neq 0 (
    echo Error downloading file 3. Please check your internet connection.
    pause
    exit /b 1
)

echo [4/6] Downloading face_landmark_68_model-shard1...
curl -L -o face_landmark_68_model-shard1 "https://github.com/justadudewhohacks/face-api.js-models/raw/master/face_landmark_68/face_landmark_68_model-shard1"
if %errorlevel% neq 0 (
    echo Error downloading file 4. Please check your internet connection.
    pause
    exit /b 1
)

echo [5/6] Downloading face_expression_model-weights_manifest.json...
curl -L -o face_expression_model-weights_manifest.json "https://github.com/justadudewhohacks/face-api.js-models/raw/master/face_expression/face_expression_model-weights_manifest.json"
if %errorlevel% neq 0 (
    echo Error downloading file 5. Please check your internet connection.
    pause
    exit /b 1
)

echo [6/6] Downloading face_expression_model-shard1...
curl -L -o face_expression_model-shard1 "https://github.com/justadudewhohacks/face-api.js-models/raw/master/face_expression/face_expression_model-shard1"
if %errorlevel% neq 0 (
    echo Error downloading file 6. Please check your internet connection.
    pause
    exit /b 1
)

cd ..

echo.
echo =========================================
echo           Download Complete! ✅
echo =========================================
echo.
echo All face detection models have been downloaded successfully.
echo.
echo Next steps:
echo 1. Get a 3D avatar (optional):
echo    - Visit https://readyplayer.me
echo    - Create and download avatar as avatar.glb
echo    - Place in avatars/ folder
echo.
echo 2. Start local server:
echo    python -m http.server 8000
echo.
echo 3. Open browser:
echo    http://localhost:8000
echo.
echo The app will work with a fallback avatar if you skip step 1.
echo.
pause
