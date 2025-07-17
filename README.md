# Memoji-Style Face Puppet App 🎭

A real-time face tracking application that animates a 3D avatar based on your facial expressions, similar to Apple's Memoji. Built with HTML5, JavaScript, Babylon.js, and face-api.js.

## 🚀 Features

- **Real-time face tracking** using your webcam
- **3D avatar animation** with facial expressions
- **Smooth blendshape animation** for natural movements
- **Expression detection**: smile, blink, mouth open, eyebrow raise, and more
- **Interactive 3D scene** with camera controls
- **Debug mode** to visualize face landmarks
- **Responsive design** that works on desktop and mobile

## 📁 Project Structure

```
face-avatar-app/
├── index.html          # Main HTML file with UI
├── app.js              # Core application logic
├── models/             # Face-api.js model files (download required)
├── avatars/            # 3D avatar files (.glb format)
├── README.md           # This file
└── SETUP.md            # Detailed setup instructions
```

## 🛠️ Quick Setup

### 1. Download Face Detection Models

The app requires face-api.js models for face detection and expression recognition:

1. Go to: https://github.com/justadudewhohacks/face-api.js-models
2. Download these files to the `models/` folder:
   - `tiny_face_detector_model-weights_manifest.json`
   - `tiny_face_detector_model-shard1`
   - `face_landmark_68_model-weights_manifest.json`  
   - `face_landmark_68_model-shard1`
   - `face_expression_model-weights_manifest.json`
   - `face_expression_model-shard1`

**Quick download commands:**
```bash
cd models
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/tiny_face_detector_model-weights_manifest.json
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/tiny_face_detector_model-shard1
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_landmark_68_model-weights_manifest.json
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_landmark_68_model-shard1
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_expression_model-weights_manifest.json
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_expression_model-shard1
```

### 2. Get a 3D Avatar

#### Option A: Ready Player Me (Recommended)
1. Visit https://readyplayer.me
2. Create a custom avatar (free)
3. Download as GLB format
4. Save as `avatars/avatar.glb`

#### Option B: Mixamo (Adobe)
1. Visit https://www.mixamo.com (requires Adobe account)
2. Browse characters or upload your own
3. Download in GLB format
4. Save as `avatars/avatar.glb`

#### Option C: Use Fallback Avatar
The app includes a simple fallback avatar (geometric shapes) that works without any downloads.

### 3. Run Local Server

Due to browser security restrictions, you need to run a local server:

**Node.js (Recommended):**
```bash
npm install
npm start
```

**Alternative - Simple Server:**
```bash
npx serve . -p 8000
```

**Live Server (VS Code):**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

### 4. Open in Browser

Navigate to: `http://localhost:8000`

## 🎮 How to Use

1. **Grant Camera Permission** when prompted
2. **Click "Start Camera"** to begin face tracking
3. **Make facial expressions** to animate the avatar:
   - Smile 😊
   - Open mouth 😮
   - Blink 😉
   - Raise eyebrows 🤨
   - Look around 👀

4. **Controls:**
   - **Reset Avatar**: Returns avatar to neutral pose
   - **Toggle Debug**: Shows face landmarks and detection data
   - **Mouse**: Rotate 3D camera around avatar

## 🎯 Supported Expressions

The app detects and maps these facial expressions:

| Expression | Avatar Response | Trigger |
|------------|----------------|---------|
| **Smile** | Mouth corners up | Happy expression |
| **Mouth Open** | Jaw opens | Surprised expression |
| **Eye Blink** | Eyelids close | Neutral/relaxed expression |
| **Eyebrow Raise** | Eyebrows lift | Surprised/questioning |
| **Frown** | Mouth corners down | Sad expression |
| **Eye Movement** | Pupils track | Eye gaze direction |

## 🔧 Technical Details

### Dependencies (CDN)
- **Babylon.js**: 3D rendering engine
- **face-api.js**: Face detection and expression recognition
- **Browser APIs**: getUserMedia, Canvas, WebGL

### Browser Requirements
- **WebGL support** (modern browsers)
- **Camera access** permission
- **HTTPS or localhost** (required for camera access)

### Performance Notes
- **Optimized for 30-60 FPS** face tracking
- **Smooth animation** with interpolation
- **Responsive design** for various screen sizes
- **Memory efficient** with cleanup on page unload

## 🐛 Troubleshooting

### "Camera access failed"
- Check browser permissions for camera access
- Ensure you're running on HTTPS or localhost
- Try a different browser

### "Failed to load face detection models"
- Verify all model files are in the `models/` folder
- Check file names match exactly (case-sensitive)
- Ensure local server is running

### "Avatar not loading"
- Check if `avatars/avatar.glb` exists
- Verify the GLB file is valid
- The app will use a fallback avatar if none is found

### Poor tracking performance
- Ensure good lighting conditions
- Keep face centered in camera view
- Close other applications using the camera
- Try reducing video resolution in browser settings

## 🚀 Advanced Customization

### Adding Custom Expressions
Edit the `animateBlendShapes()` function in `app.js` to map new expressions:

```javascript
const mappings = {
    'customExpression': expressions.angry * 0.5,
    // Add more mappings here
};
```

### Adjusting Sensitivity
Modify the smoothing factor for more/less responsive animations:

```javascript
this.smoothingFactor = 0.3; // Lower = smoother, Higher = more responsive
```

### Custom Avatar Setup
Ensure your GLB avatar has these blendshape names:
- `eyeBlinkLeft`, `eyeBlinkRight`
- `jawOpen`
- `mouthSmileLeft`, `mouthSmileRight`
- `browInnerUp`, `browOuterUpLeft`, `browOuterUpRight`

## 📱 Mobile Support

The app works on mobile browsers with these considerations:
- **Touch controls** for 3D camera rotation
- **Responsive layout** adapts to screen size
- **Performance optimization** for mobile GPUs
- **Front camera** automatically selected

## 🤝 Contributing

Feel free to enhance the app with:
- Additional expression mappings
- Better avatar models
- Performance optimizations
- New facial landmarks
- VR/AR integration

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Credits

- **face-api.js**: Face detection library by Vincent Mühler
- **Babylon.js**: 3D engine by Microsoft
- **Ready Player Me**: Avatar creation platform
- **Mixamo**: 3D character animation by Adobe

---

**Enjoy creating your own Memoji-style face puppet! 🎭✨**
