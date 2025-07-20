class MediaPipeFaceAvatar {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.canvasCtx = null;
        this.avatarCanvas = null;
        this.faceMesh = null;
        this.camera = null;
        this.isTracking = false;
        this.debugMode = false;
        
        // Three.js components
        this.scene = null;
        this.threeCamera = null;
        this.renderer = null;
        this.avatar = null;
        this.animationMixer = null;
        
        // Face data
        this.landmarks = null;
        this.faceBlendshapes = null;
        
        // Expression thresholds
        this.expressionThresholds = {
            smile: 0.3,
            mouthOpen: 0.15,
            eyeBlink: 0.7,
            browRaise: 0.3,
            jawOpen: 0.2
        };
        
        // Smoothing
        this.smoothingFactor = 0.7;
        this.previousBlendshapes = {};
        
        this.init();
    }

    async init() {
        try {
            this.setupElements();
            this.initThreeJS();
            this.initMediaPipe();
            await this.loadDefaultAvatar();
            this.updateStatus('✅ Ready! Click "Start Camera" to begin.', 'ready');
        } catch (error) {
            console.error('❌ Initialization error:', error);
            this.updateStatus('❌ Initialization failed. Please refresh the page.', 'error');
        }
    }

    setupElements() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('landmarkCanvas');
        this.canvasCtx = this.canvas.getContext('2d');
        this.avatarCanvas = document.getElementById('avatarCanvas');
        
        if (!this.video || !this.canvas || !this.avatarCanvas) {
            throw new Error('Required DOM elements not found');
        }
    }

    initThreeJS() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2c3e50);
        
        // Camera setup
        this.threeCamera = new THREE.PerspectiveCamera(
            75, 
            this.avatarCanvas.clientWidth / this.avatarCanvas.clientHeight, 
            0.1, 
            1000
        );
        this.threeCamera.position.set(0, 0, 3);
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.avatarCanvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.avatarCanvas.clientWidth, this.avatarCanvas.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        const fillLight = new THREE.DirectionalLight(0x404040, 0.3);
        fillLight.position.set(-1, 0, 0.5);
        this.scene.add(fillLight);
        
        // Start render loop
        this.animate();
        
        console.log('✅ Three.js initialized');
    }

    initMediaPipe() {
        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        
        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.faceMesh.onResults(this.onResults.bind(this));
        
        console.log('✅ MediaPipe initialized');
    }

    async loadDefaultAvatar() {
        try {
            await this.loadAvatarFromPath('avatar.glb');
        } catch (error) {
            console.warn('❌ Could not load default avatar, creating fallback');
            this.createFallbackAvatar();
        }
    }

    async loadAvatarFromPath(fileName) {
        try {
            this.updateAvatarInfo(`🔄 Loading ${fileName}...`);
            
            // Remove existing avatar
            if (this.avatar) {
                this.scene.remove(this.avatar);
                this.avatar = null;
            }
            
            const loader = new THREE.GLTFLoader();
            const gltf = await new Promise((resolve, reject) => {
                loader.load(
                    `./avatars/${fileName}`,
                    resolve,
                    (progress) => {
                        const percent = Math.round((progress.loaded / progress.total) * 100);
                        this.updateAvatarInfo(`🔄 Loading ${fileName}... ${percent}%`);
                    },
                    reject
                );
            });
            
            this.avatar = gltf.scene;
            this.scene.add(this.avatar);
            
            // Center and scale avatar
            const box = new THREE.Box3().setFromObject(this.avatar);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // Center the avatar
            this.avatar.position.sub(center);
            
            // Scale to fit
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim;
            this.avatar.scale.setScalar(scale);
            
            // Position for head view
            this.avatar.position.y += 0.5;
            
            // Setup morph targets
            this.setupMorphTargets();
            
            // Setup animation mixer if needed
            if (gltf.animations && gltf.animations.length > 0) {
                this.animationMixer = new THREE.AnimationMixer(this.avatar);
            }
            
            this.updateAvatarInfo(`✅ ${fileName} loaded successfully!`);
            console.log(`✅ Avatar loaded: ${fileName}`);
            
        } catch (error) {
            console.error(`❌ Failed to load avatar ${fileName}:`, error);
            this.updateAvatarInfo(`❌ Failed to load ${fileName}`);
            this.createFallbackAvatar();
        }
    }

    setupMorphTargets() {
        if (!this.avatar) return;
        
        this.morphTargets = {};
        
        // Find all meshes with morph targets
        this.avatar.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary) {
                console.log(`Found morph targets on mesh: ${child.name}`);
                console.log('Available targets:', Object.keys(child.morphTargetDictionary));
                
                // Store references to morph targets
                for (const [name, index] of Object.entries(child.morphTargetDictionary)) {
                    this.morphTargets[name.toLowerCase()] = {
                        mesh: child,
                        index: index
                    };
                }
            }
        });
        
        console.log(`✅ Found ${Object.keys(this.morphTargets).length} morph targets`);
    }

    createFallbackAvatar() {
        // Remove existing avatar
        if (this.avatar) {
            this.scene.remove(this.avatar);
        }
        
        // Create simple geometric avatar
        const group = new THREE.Group();
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        group.add(head);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.15, 0.1, 0.4);
        group.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.15, 0.1, 0.4);
        group.add(rightEye);
        
        // Mouth
        const mouthGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const mouthMaterial = new THREE.MeshLambertMaterial({ color: 0x8b0000 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, -0.2, 0.4);
        mouth.scale.set(1.5, 0.5, 0.5);
        group.add(mouth);
        
        this.avatar = group;
        this.avatar.isFallback = true;
        this.avatar.head = head;
        this.avatar.leftEye = leftEye;
        this.avatar.rightEye = rightEye;
        this.avatar.mouth = mouth;
        
        this.scene.add(this.avatar);
        this.updateAvatarInfo('🤖 Using fallback avatar (geometric shapes)');
        console.log('✅ Fallback avatar created');
    }

    async startCamera() {
        try {
            this.updateStatus('📷 Starting camera...', 'loading');
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: 640, 
                    height: 480,
                    facingMode: 'user'
                }
            });
            
            this.video.srcObject = stream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });
            
            // Setup canvas dimensions
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Initialize MediaPipe camera
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    await this.faceMesh.send({ image: this.video });
                },
                width: 640,
                height: 480
            });
            
            await this.camera.start();
            
            this.isTracking = true;
            this.updateStatus('✅ Camera active! Face tracking enabled.', 'ready');
            this.enableControls();
            
            // Update button
            document.getElementById('startBtn').textContent = '📷 Stop Camera';
            
            console.log('✅ Camera started successfully');
            
        } catch (error) {
            console.error('❌ Camera start error:', error);
            this.updateStatus('❌ Camera access failed. Please allow camera permissions.', 'error');
        }
    }

    stopCamera() {
        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }
        
        if (this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }
        
        this.isTracking = false;
        this.updateStatus('📷 Camera stopped', 'loading');
        this.disableControls();
        
        // Clear canvas
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update button
        document.getElementById('startBtn').textContent = '🎬 Start Camera';
        
        console.log('📷 Camera stopped');
    }

    onResults(results) {
        // Clear canvas
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this.landmarks = results.multiFaceLandmarks[0];
            
            // Draw landmarks if debug mode
            if (this.debugMode) {
                this.drawLandmarks();
            }
            
            // Calculate face expressions
            this.calculateExpressions();
            
            // Animate avatar
            this.animateAvatar();
            
            // Update UI
            this.updateExpressionIndicators();
            this.updateFaceInfo('✅ Face detected and tracking');
            
        } else {
            this.updateFaceInfo('❌ No face detected');
        }
    }

    drawLandmarks() {
        if (!this.landmarks) return;
        
        this.canvasCtx.fillStyle = '#FF0000';
        this.canvasCtx.strokeStyle = '#00FF00';
        this.canvasCtx.lineWidth = 1;
        
        // Draw all landmarks
        for (const landmark of this.landmarks) {
            const x = landmark.x * this.canvas.width;
            const y = landmark.y * this.canvas.height;
            
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(x, y, 2, 0, 2 * Math.PI);
            this.canvasCtx.fill();
        }
        
        // Draw face contour
        drawConnectors(this.canvasCtx, this.landmarks, FACEMESH_FACE_OVAL, {
            color: '#00FF00',
            lineWidth: 1
        });
        
        // Draw eyes
        drawConnectors(this.canvasCtx, this.landmarks, FACEMESH_LEFT_EYE, {
            color: '#0000FF',
            lineWidth: 1
        });
        drawConnectors(this.canvasCtx, this.landmarks, FACEMESH_RIGHT_EYE, {
            color: '#0000FF',
            lineWidth: 1
        });
        
        // Draw mouth
        drawConnectors(this.canvasCtx, this.landmarks, FACEMESH_LIPS, {
            color: '#FF0000',
            lineWidth: 1
        });
    }

    calculateExpressions() {
        if (!this.landmarks) return;
        
        this.expressions = {
            smile: this.calculateSmile(),
            mouthOpen: this.calculateMouthOpen(),
            leftBlink: this.calculateEyeBlink('left'),
            rightBlink: this.calculateEyeBlink('right'),
            browRaise: this.calculateBrowRaise(),
            jawOpen: this.calculateJawOpen()
        };
    }

    calculateSmile() {
        // Use mouth corner landmarks
        const leftCorner = this.landmarks[61];  // Left mouth corner
        const rightCorner = this.landmarks[291]; // Right mouth corner
        const upperLip = this.landmarks[13];     // Upper lip center
        const lowerLip = this.landmarks[14];     // Lower lip center
        
        // Calculate mouth width and height
        const mouthWidth = Math.abs(rightCorner.x - leftCorner.x);
        const mouthHeight = Math.abs(upperLip.y - lowerLip.y);
        
        // Calculate corner elevation
        const lipCenter = (upperLip.y + lowerLip.y) / 2;
        const cornerElevation = lipCenter - (leftCorner.y + rightCorner.y) / 2;
        
        // Smile detection based on width/height ratio and corner elevation
        const aspectRatio = mouthWidth / mouthHeight;
        const smile = Math.max(0, Math.min(1, 
            (aspectRatio - 2.5) * 2 + cornerElevation * 50
        ));
        
        return this.smoothExpression('smile', smile);
    }

    calculateMouthOpen() {
        const upperLip = this.landmarks[13];
        const lowerLip = this.landmarks[14];
        const leftCorner = this.landmarks[61];
        const rightCorner = this.landmarks[291];
        
        const mouthHeight = Math.abs(upperLip.y - lowerLip.y);
        const mouthWidth = Math.abs(rightCorner.x - leftCorner.x);
        
        // Normalize mouth opening
        const openness = Math.max(0, Math.min(1, (mouthHeight / mouthWidth - 0.1) * 10));
        
        return this.smoothExpression('mouthOpen', openness);
    }

    calculateEyeBlink(eye) {
        let upperLid, lowerLid, leftCorner, rightCorner;
        
        if (eye === 'left') {
            upperLid = this.landmarks[159];
            lowerLid = this.landmarks[145];
            leftCorner = this.landmarks[33];
            rightCorner = this.landmarks[133];
        } else {
            upperLid = this.landmarks[386];
            lowerLid = this.landmarks[374];
            leftCorner = this.landmarks[362];
            rightCorner = this.landmarks[263];
        }
        
        const eyeHeight = Math.abs(upperLid.y - lowerLid.y);
        const eyeWidth = Math.abs(rightCorner.x - leftCorner.x);
        
        // Eye aspect ratio - lower values indicate more closed eye
        const ear = eyeHeight / eyeWidth;
        const blink = Math.max(0, Math.min(1, (0.04 - ear) * 25));
        
        return this.smoothExpression(`${eye}Blink`, blink);
    }

    calculateBrowRaise() {
        // Use eyebrow landmarks
        const leftBrow = this.landmarks[70];
        const rightBrow = this.landmarks[300];
        const leftEye = this.landmarks[33];
        const rightEye = this.landmarks[263];
        
        const browHeight = ((leftBrow.y + rightBrow.y) / 2);
        const eyeHeight = ((leftEye.y + rightEye.y) / 2);
        
        const browDistance = eyeHeight - browHeight;
        const raise = Math.max(0, Math.min(1, (browDistance - 0.02) * 30));
        
        return this.smoothExpression('browRaise', raise);
    }

    calculateJawOpen() {
        const upperJaw = this.landmarks[10];
        const lowerJaw = this.landmarks[152];
        
        const jawDistance = Math.abs(lowerJaw.y - upperJaw.y);
        const jaw = Math.max(0, Math.min(1, (jawDistance - 0.02) * 20));
        
        return this.smoothExpression('jawOpen', jaw);
    }

    smoothExpression(name, value) {
        if (!this.previousBlendshapes[name]) {
            this.previousBlendshapes[name] = 0;
        }
        
        const smoothed = this.previousBlendshapes[name] + 
            (value - this.previousBlendshapes[name]) * this.smoothingFactor;
        
        this.previousBlendshapes[name] = smoothed;
        return smoothed;
    }

    animateAvatar() {
        if (!this.avatar || !this.expressions) return;
        
        if (this.avatar.isFallback) {
            this.animateFallbackAvatar();
        } else {
            this.animateMorphTargets();
        }
        
        this.animateHeadRotation();
    }

    animateFallbackAvatar() {
        // Animate eyes (blinking)
        const leftBlink = this.expressions.leftBlink;
        const rightBlink = this.expressions.rightBlink;
        
        this.avatar.leftEye.scale.y = 1 - leftBlink * 0.8;
        this.avatar.rightEye.scale.y = 1 - rightBlink * 0.8;
        
        // Animate mouth
        const mouthOpen = this.expressions.mouthOpen;
        const smile = this.expressions.smile;
        
        this.avatar.mouth.scale.y = 0.5 + mouthOpen * 0.8;
        this.avatar.mouth.scale.x = 1.5 + smile * 0.5;
    }

    animateMorphTargets() {
        // Map expressions to common morph target names
        const morphMappings = {
            // Smile variations
            smile: ['jawopen', 'mouthsmile', 'mouthsmile_l', 'mouthsmile_r'],
            
            // Mouth open variations
            mouthOpen: ['jawopen', 'mouthopen', 'mouthfunnel'],
            
            // Eye blink variations
            leftBlink: ['eyeblink_l', 'eyelidsclosed_l', 'eyeclose_l'],
            rightBlink: ['eyeblink_r', 'eyelidsclosed_r', 'eyeclose_r'],
            
            // Eyebrow variations
            browRaise: ['browsup_l', 'browsup_r', 'browsinner_up'],
            
            // Jaw variations
            jawOpen: ['jawopen', 'jawforward']
        };
        
        for (const [expression, targets] of Object.entries(morphMappings)) {
            const value = this.expressions[expression] || 0;
            
            for (const targetName of targets) {
                const target = this.morphTargets[targetName.toLowerCase()];
                if (target) {
                    target.mesh.morphTargetInfluences[target.index] = value;
                }
            }
        }
    }

    animateHeadRotation() {
        if (!this.landmarks || !this.avatar) return;
        
        // Calculate head rotation from face landmarks
        const leftEye = this.landmarks[33];
        const rightEye = this.landmarks[263];
        const nose = this.landmarks[1];
        const chin = this.landmarks[18];
        
        // Calculate head pose
        const eyeCenter = {
            x: (leftEye.x + rightEye.x) / 2,
            y: (leftEye.y + rightEye.y) / 2
        };
        
        // Yaw (left/right rotation)
        const yaw = (nose.x - eyeCenter.x) * Math.PI * 0.5;
        
        // Pitch (up/down rotation)
        const pitch = (eyeCenter.y - nose.y) * Math.PI * 0.5;
        
        // Roll (tilt rotation)
        const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
        
        // Apply rotation with limits
        this.avatar.rotation.y = Math.max(-0.5, Math.min(0.5, yaw));
        this.avatar.rotation.x = Math.max(-0.3, Math.min(0.3, pitch));
        this.avatar.rotation.z = Math.max(-0.2, Math.min(0.2, -roll));
    }

    updateExpressionIndicators() {
        if (!this.expressions) return;
        
        const indicators = {
            'expr-smile': this.expressions.smile > this.expressionThresholds.smile,
            'expr-mouth-open': this.expressions.mouthOpen > this.expressionThresholds.mouthOpen,
            'expr-blink-left': this.expressions.leftBlink > this.expressionThresholds.eyeBlink,
            'expr-blink-right': this.expressions.rightBlink > this.expressionThresholds.eyeBlink,
            'expr-eyebrow-raise': this.expressions.browRaise > this.expressionThresholds.browRaise,
            'expr-jaw-open': this.expressions.jawOpen > this.expressionThresholds.jawOpen
        };
        
        for (const [id, isActive] of Object.entries(indicators)) {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle('active', isActive);
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update animation mixer if available
        if (this.animationMixer) {
            this.animationMixer.update(0.016); // ~60fps
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.threeCamera);
    }

    resetAvatar() {
        if (!this.avatar) return;
        
        // Reset rotation
        this.avatar.rotation.set(0, 0, 0);
        
        // Reset fallback avatar
        if (this.avatar.isFallback) {
            this.avatar.leftEye.scale.set(1, 1, 1);
            this.avatar.rightEye.scale.set(1, 1, 1);
            this.avatar.mouth.scale.set(1.5, 0.5, 0.5);
        } else {
            // Reset morph targets
            this.avatar.traverse((child) => {
                if (child.isMesh && child.morphTargetInfluences) {
                    child.morphTargetInfluences.fill(0);
                }
            });
        }
        
        // Reset camera
        this.threeCamera.position.set(0, 0, 3);
        this.updateCameraControlValues();
        
        // Reset smoothing
        this.previousBlendshapes = {};
        
        console.log('🔄 Avatar reset');
    }

    toggleDebug() {
        this.debugMode = !this.debugMode;
        const btn = document.getElementById('toggleDebugBtn');
        btn.textContent = this.debugMode ? '🐛 Hide Debug' : '🐛 Show Debug';
        
        if (!this.debugMode) {
            this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        console.log(`🐛 Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
    }

    updateCameraPosition() {
        const x = parseFloat(document.getElementById('cameraX').value);
        const y = parseFloat(document.getElementById('cameraY').value);
        const z = parseFloat(document.getElementById('cameraZ').value);
        
        this.threeCamera.position.set(x, y, z);
        this.threeCamera.lookAt(0, 0, 0);
        
        document.getElementById('cameraXValue').textContent = x.toFixed(1);
        document.getElementById('cameraYValue').textContent = y.toFixed(1);
        document.getElementById('cameraZValue').textContent = z.toFixed(1);
    }

    updateCameraControlValues() {
        document.getElementById('cameraX').value = this.threeCamera.position.x;
        document.getElementById('cameraY').value = this.threeCamera.position.y;
        document.getElementById('cameraZ').value = this.threeCamera.position.z;
        document.getElementById('cameraXValue').textContent = this.threeCamera.position.x.toFixed(1);
        document.getElementById('cameraYValue').textContent = this.threeCamera.position.y.toFixed(1);
        document.getElementById('cameraZValue').textContent = this.threeCamera.position.z.toFixed(1);
    }

    enableControls() {
        document.getElementById('resetBtn').disabled = false;
        document.getElementById('toggleDebugBtn').disabled = false;
        document.getElementById('avatarSelect').disabled = false;
        document.getElementById('loadAvatarBtn').disabled = false;
        document.getElementById('cameraX').disabled = false;
        document.getElementById('cameraY').disabled = false;
        document.getElementById('cameraZ').disabled = false;
    }

    disableControls() {
        document.getElementById('resetBtn').disabled = true;
        document.getElementById('toggleDebugBtn').disabled = true;
        document.getElementById('avatarSelect').disabled = true;
        document.getElementById('loadAvatarBtn').disabled = true;
        document.getElementById('cameraX').disabled = true;
        document.getElementById('cameraY').disabled = true;
        document.getElementById('cameraZ').disabled = true;
    }

    updateStatus(message, type) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status ${type}`;
        }
    }

    updateAvatarInfo(message) {
        const avatarInfoElement = document.getElementById('avatarInfo');
        if (avatarInfoElement) {
            avatarInfoElement.textContent = message;
        }
    }

    updateFaceInfo(message) {
        const faceInfoElement = document.getElementById('faceInfo');
        if (faceInfoElement) {
            faceInfoElement.textContent = message;
        }
    }
}

// Global app instance
let app = null;

// Global functions for HTML buttons
function startApp() {
    if (app && app.isTracking) {
        app.stopCamera();
    } else if (app) {
        app.startCamera();
    }
}

function resetAvatar() {
    if (app) {
        app.resetAvatar();
    }
}

function toggleDebug() {
    if (app) {
        app.toggleDebug();
    }
}

function updateCameraPosition() {
    if (app) {
        app.updateCameraPosition();
    }
}

function changeAvatar(selectedValue) {
    console.log('Avatar selection changed to:', selectedValue);
    if (app) {
        app.updateAvatarInfo(`🎭 Ready to load: ${selectedValue}`);
    }
}

function loadSelectedAvatar() {
    const select = document.getElementById('avatarSelect');
    const selectedAvatar = select.value;
    
    if (app && selectedAvatar) {
        console.log('Loading avatar:', selectedAvatar);
        app.loadAvatarFromPath(selectedAvatar);
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    app = new MediaPipeFaceAvatar();
    window.app = app; // Make globally accessible for debugging
    console.log('🎭 MediaPipe Face Avatar initialized!');
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (app && app.isTracking) {
        app.stopCamera();
    }
});
