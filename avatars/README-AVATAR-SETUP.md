# How to Get Your Avatar 🎭

Place this file in the `avatars/` folder and name it `avatar.glb`

## 🚀 Ready Player Me (Recommended - Free & Easy)

1. **Visit**: https://readyplayer.me
2. **Create**: Make a free account
3. **Customize**: Design your avatar
   - Choose body type
   - Customize face features
   - Add hair, clothing, accessories
   - Make it expressive and cartoon-like for best results
4. **Download**: 
   - Click "Download"
   - Format: "GLB"
   - Quality: "Medium" (good balance of quality vs file size)
5. **Save**: Rename the downloaded file to `avatar.glb` and place it here

## 🎨 Mixamo (Adobe - Free with Account)

1. **Visit**: https://www.mixamo.com
2. **Sign In**: Use your Adobe ID (free account)
3. **Browse**: Look for cartoon/stylized characters
4. **Download**: 
   - Select character
   - Format: "FBX for Unity" or "GLB" if available
   - No animation needed
5. **Convert**: If FBX, convert to GLB using online converter
6. **Save**: Name it `avatar.glb` and place it here

## 🌐 Other Free Sources

### Sketchfab
- **URL**: https://sketchfab.com
- **Filter**: Downloadable, Free
- **Search**: "cartoon character", "stylized avatar", "low poly character"

### Turbosquid
- **URL**: https://www.turbosquid.com
- **Section**: Free 3D Models
- **Category**: Characters & Creatures

### CGTrader
- **URL**: https://www.cgtrader.com
- **Filter**: Free models
- **Search**: Character, Avatar, Cartoon

## 📋 Avatar Requirements

For best results, your avatar should have:

- **Format**: GLB or GLTF
- **Size**: Under 50MB (10MB recommended)
- **Style**: Cartoon/stylized (works better than photorealistic)
- **Blendshapes**: Facial morph targets for expressions (optional but recommended)
- **Polygon Count**: Under 50,000 triangles for good performance

## 🔄 Format Conversion

If you have other formats (FBX, OBJ, etc.):

### Online Converters
- https://products.aspose.app/3d/conversion
- https://anyconv.com/fbx-to-glb-converter
- https://cloudconvert.com

### Blender (Free Software)
1. Download Blender: https://www.blender.org
2. Import your model (File → Import)
3. Export as GLB (File → Export → glTF 2.0)

## 🎯 Blendshape Names (Advanced)

If your avatar has facial blendshapes, use these names for automatic mapping:

- `eyeBlinkLeft` - Left eye blink
- `eyeBlinkRight` - Right eye blink  
- `jawOpen` - Mouth open
- `mouthSmileLeft` - Left mouth corner smile
- `mouthSmileRight` - Right mouth corner smile
- `mouthFrownLeft` - Left mouth corner frown
- `mouthFrownRight` - Right mouth corner frown
- `browInnerUp` - Inner eyebrow raise
- `browOuterUpLeft` - Left outer eyebrow raise
- `browOuterUpRight` - Right outer eyebrow raise

## 🚨 No Avatar? No Problem!

The app includes a fallback avatar made of simple shapes that will work if you don't have a custom avatar. You can always add one later!

## 🎮 Testing Your Avatar

After placing your avatar:

1. Start the server: `npm start`
2. Open: http://localhost:8000
3. Click "Start Camera"
4. Make facial expressions to test avatar response

## 💡 Tips for Best Results

- **Cartoon style** avatars work better than realistic ones
- **Smaller file sizes** load faster
- **Good topology** around the face area helps with animations
- **Neutral pose** should have eyes open and mouth closed
- **Forward-facing** avatar works best for face tracking

---

**Happy avatar hunting! 🎭✨**
