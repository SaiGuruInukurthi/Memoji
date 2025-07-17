# Detailed Setup Instructions 🛠️

This guide will walk you through setting up your Memoji-Style Face Puppet app step by step.

## 📋 Prerequisites

- **Modern web browser** (Chrome, Firefox, Safari, Edge)
- **Camera access** (built-in or external webcam)
- **Internet connection** (for downloading models and dependencies)
- **Local server capability** (Python, Node.js, or VS Code Live Server)

## 🗂️ Project Structure Setup

Your final project should look like this:

```
face-avatar-app/
├── index.html                          # ✅ Already created
├── app.js                              # ✅ Already created
├── README.md                           # ✅ Already created
├── SETUP.md                            # ✅ This file
├── models/                             # 📁 Download required
│   ├── tiny_face_detector_model-weights_manifest.json
│   ├── tiny_face_detector_model-shard1
│   ├── face_landmark_68_model-weights_manifest.json
│   ├── face_landmark_68_model-shard1
│   ├── face_expression_model-weights_manifest.json
│   └── face_expression_model-shard1
└── avatars/                            # 📁 Optional (has fallback)
    └── avatar.glb
```

## 🔧 Step 1: Download Face Detection Models

The face tracking requires pre-trained models from face-api.js.

### Option A: Manual Download
1. Visit: https://github.com/justadudewhohacks/face-api.js-models
2. Click on each file below and download to your `models/` folder:
   - `tiny_face_detector_model-weights_manifest.json`
   - `tiny_face_detector_model-shard1`
   - `face_landmark_68_model-weights_manifest.json`
   - `face_landmark_68_model-shard1`
   - `face_expression_model-weights_manifest.json`
   - `face_expression_model-shard1`

### Option B: Command Line Download

**Windows (Command Prompt):**
```cmd
cd models
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/tiny_face_detector_model-weights_manifest.json
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/tiny_face_detector_model-shard1
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_landmark_68_model-weights_manifest.json
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_landmark_68_model-shard1
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_expression_model-weights_manifest.json
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_expression_model-shard1
```

**PowerShell:**
```powershell
cd models
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/tiny_face_detector_model-weights_manifest.json" -OutFile "tiny_face_detector_model-weights_manifest.json"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/tiny_face_detector_model-shard1" -OutFile "tiny_face_detector_model-shard1"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_landmark_68_model-weights_manifest.json" -OutFile "face_landmark_68_model-weights_manifest.json"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_landmark_68_model-shard1" -OutFile "face_landmark_68_model-shard1"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_expression_model-weights_manifest.json" -OutFile "face_expression_model-weights_manifest.json"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_expression_model-shard1" -OutFile "face_expression_model-shard1"
```

### ✅ Verify Model Download
Your `models/` folder should contain 6 files totaling about 15-20 MB.

## 🎭 Step 2: Get a 3D Avatar (Optional)

The app works with a fallback avatar, but a custom GLB avatar provides better results.

### Option A: Ready Player Me (Easiest)

1. **Visit**: https://readyplayer.me
2. **Create Account**: Sign up (free)
3. **Customize Avatar**:
   - Choose body type
   - Customize face, hair, clothing
   - Make it expressive and cartoon-like
4. **Download**:
   - Click "Download"
   - Select "GLB" format
   - Choose "Medium" quality
5. **Save**: Rename to `avatar.glb` and place in `avatars/` folder

### Option B: Mixamo (Advanced)

1. **Visit**: https://www.mixamo.com
2. **Sign in**: Requires Adobe ID (free)
3. **Browse Characters**:
   - Look for expressive, cartoon-style characters
   - Preview facial expressions if available
4. **Download**:
   - Select character
   - Format: "FBX for Unity" or "GLB"
   - Download without animation
5. **Convert if needed**: Use online converters if not GLB format

### Option C: Other Sources

**Free 3D Models:**
- **Sketchfab**: https://sketchfab.com (filter by "Downloadable")
- **Turbosquid**: https://www.turbosquid.com (free models section)
- **CGTrader**: https://www.cgtrader.com (free models)

**Requirements for Custom Avatars:**
- **Format**: GLB or GLTF
- **Blendshapes**: Should include facial morph targets
- **Size**: Under 50MB recommended
- **Style**: Cartoon/stylized works better than realistic

### 🔄 Converting Other Formats

If you have FBX, OBJ, or other formats:

**Online Converters:**
- https://products.aspose.app/3d/conversion
- https://anyconv.com/fbx-to-glb-converter
- https://cloudconvert.com

**Blender (Free Software):**
1. Import your model
2. Export as GLB
3. Ensure facial bones/morphs are preserved

## 🖥️ Step 3: Set Up Local Server

Web browsers require a local server for camera access and file loading.

### Option A: Python (Most Common)

**Python 3:**
```cmd
cd "c:\face-avatar-app\Final face app"
python -m http.server 8000
```

**Python 2:**
```cmd
cd "c:\face-avatar-app\Final face app"
python -m SimpleHTTPServer 8000
```

**Access**: http://localhost:8000

### Option B: Node.js

**With npx (Node.js 8+):**
```cmd
cd "c:\face-avatar-app\Final face app"
npx serve .
```

**With live-server:**
```cmd
npm install -g live-server
cd "c:\face-avatar-app\Final face app"
live-server
```

### Option C: VS Code Live Server

1. **Install Extension**: Search "Live Server" in VS Code extensions
2. **Open Folder**: Open your project folder in VS Code
3. **Start Server**: Right-click `index.html` → "Open with Live Server"

### Option D: Other Servers

**IIS (Windows):**
- Enable IIS in Windows Features
- Copy files to `C:\inetpub\wwwroot\`
- Access via http://localhost

**XAMPP/WAMP:**
- Install XAMPP or WAMP
- Copy files to `htdocs/` folder

## 🌐 Step 4: Test the Application

1. **Open Browser**: Navigate to your local server URL
2. **Grant Permissions**: Allow camera access when prompted
3. **Click "Start Camera"**: The video feed should appear
4. **Test Face Tracking**: Make facial expressions
5. **Check Avatar**: Should respond to your expressions

### 🐛 Common Issues and Solutions

#### "Failed to load face detection models"
- **Check**: All 6 model files are in `models/` folder
- **Verify**: File names match exactly (case-sensitive)
- **Test**: Try loading a model file directly in browser
- **Alternative**: App will fall back to online models (slower)

#### "Camera access denied"
- **Enable**: Browser camera permissions
- **Check**: No other apps using camera
- **Try**: Different browser or incognito mode
- **HTTPS**: Some browsers require HTTPS for camera

#### "Avatar not loading"
- **Verify**: `avatar.glb` exists in `avatars/` folder
- **Check**: File is valid GLB format
- **Test**: Open GLB in online viewer
- **Fallback**: App works without custom avatar

#### "Poor face tracking"
- **Lighting**: Ensure good, even lighting
- **Position**: Keep face centered and close enough
- **Quality**: Try higher resolution camera settings
- **Performance**: Close other tabs/applications

## 🎚️ Step 5: Customize Settings

### Adjusting Sensitivity

Edit `app.js` to modify tracking sensitivity:

```javascript
// Line ~20: Smoothing factor (0.1 = very smooth, 0.8 = very responsive)
this.smoothingFactor = 0.3;

// Line ~200: Expression thresholds
const indicators = {
    'expr-smile': this.expressions.happy > 0.3, // Lower = more sensitive
    'expr-mouth-open': this.expressions.surprised > 0.3,
    // ...
};
```

### Camera Resolution

Modify video constraints in `startCamera()`:

```javascript
const stream = await navigator.mediaDevices.getUserMedia({
    video: {
        width: { ideal: 1280 }, // Higher = better quality, slower
        height: { ideal: 720 },
        facingMode: 'user'
    }
});
```

### Render Quality

Adjust Babylon.js settings:

```javascript
// Line ~50: Engine settings
this.engine = new BABYLON.Engine(this.canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true, // Add for better quality
    powerPreference: "high-performance" // Use dedicated GPU
});
```

## 📱 Mobile Optimization

For better mobile performance:

1. **Reduce Resolution**: Lower camera resolution
2. **Simplify Avatar**: Use simpler 3D models
3. **Disable Debug**: Don't use debug mode
4. **Close Apps**: Free up mobile resources

## 🔐 Security Considerations

- **HTTPS Required**: For camera access on remote servers
- **Permissions**: Users must grant camera access
- **Privacy**: All processing happens locally (no data sent to servers)
- **CORS**: Models must be served from same domain or CORS-enabled

## 🚀 Performance Tips

1. **Model Size**: Keep avatar under 10MB for fast loading
2. **Texture Resolution**: 1024x1024 max for mobile
3. **Polygon Count**: Under 50k triangles recommended
4. **Face Tracking**: 30 FPS is sufficient for smooth animation
5. **Memory**: Monitor browser memory usage

## 📈 Next Steps

Once basic setup works:

1. **Custom Expressions**: Add more facial expression mappings
2. **Hand Tracking**: Integrate hand pose detection
3. **Voice Sync**: Add lip sync with speech recognition
4. **Recording**: Implement video recording functionality
5. **AR Mode**: Add AR.js for augmented reality features

## 💡 Tips for Best Results

- **Good Lighting**: Avoid backlighting or harsh shadows
- **Clean Background**: Reduces false detections
- **Stable Position**: Keep head reasonably still
- **Direct Gaze**: Look towards camera for best tracking
- **Exaggerated Expressions**: Work better than subtle ones

---

**You're all set! 🎉 Enjoy your Memoji-style face puppet app!**

If you encounter any issues, check the browser console (F12) for detailed error messages.
