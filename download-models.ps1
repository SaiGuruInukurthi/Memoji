# Face Puppet App - Model Downloader (PowerShell)
# Downloads required face-api.js models for face detection

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Face Puppet App - Model Downloader" -ForegroundColor Cyan  
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will download the required face-api.js models" -ForegroundColor Yellow
Write-Host "to the models/ folder for face detection and expression tracking." -ForegroundColor Yellow
Write-Host ""

# Create models directory if it doesn't exist
if (!(Test-Path "models")) {
    Write-Host "Creating models directory..." -ForegroundColor Green
    New-Item -ItemType Directory -Path "models" | Out-Null
}

Set-Location "models"

Write-Host "Downloading face detection models..." -ForegroundColor Green
Write-Host ""

# Array of files to download
$files = @(
    @{name="tiny_face_detector_model-weights_manifest.json"; desc="[1/6] Tiny Face Detector Manifest"; path="tiny_face_detector"},
    @{name="tiny_face_detector_model-shard1"; desc="[2/6] Tiny Face Detector Model"; path="tiny_face_detector"},
    @{name="face_landmark_68_model-weights_manifest.json"; desc="[3/6] Face Landmarks Manifest"; path="face_landmark_68"},
    @{name="face_landmark_68_model-shard1"; desc="[4/6] Face Landmarks Model"; path="face_landmark_68"},
    @{name="face_expression_model-weights_manifest.json"; desc="[5/6] Face Expression Manifest"; path="face_expression"},
    @{name="face_expression_model-shard1"; desc="[6/6] Face Expression Model"; path="face_expression"}
)

$baseUrl = "https://github.com/justadudewhohacks/face-api.js-models/raw/master"

foreach ($file in $files) {
    Write-Host $file.desc -ForegroundColor Cyan
    $url = "$baseUrl/$($file.path)/$($file.name)"
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $file.name -ErrorAction Stop
        Write-Host "✅ Downloaded: $($file.name)" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error downloading $($file.name): $_" -ForegroundColor Red
        Write-Host "Please check your internet connection and try again." -ForegroundColor Yellow
        Set-Location ".."
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Set-Location ".."

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "          Download Complete! ✅" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "All face detection models have been downloaded successfully." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Get a 3D avatar (optional):" -ForegroundColor White
Write-Host "   - Visit https://readyplayer.me" -ForegroundColor Gray
Write-Host "   - Create and download avatar as avatar.glb" -ForegroundColor Gray
Write-Host "   - Place in avatars/ folder" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start local server:" -ForegroundColor White
Write-Host "   python -m http.server 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Open browser:" -ForegroundColor White
Write-Host "   http://localhost:8000" -ForegroundColor Gray
Write-Host ""
Write-Host "The app will work with a fallback avatar if you skip step 1." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
