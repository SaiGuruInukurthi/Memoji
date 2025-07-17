import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

class FacePuppetApp {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.avatar = null;
        this.isInitialized = false;
        this.isTracking = false;
        this.debugMode = false;
        
        // Camera control state
        this.manualCameraControl = false;
        
        // Face tracking data
        this.faceDetections = null;
        this.expressions = {};
        this.landmarks = null;
        
        // Animation smoothing - enhanced for better expression responsiveness
        this.smoothingFactor = 0.4;
        this.previousExpressions = {};
        this.blendshapeSmoothing = {};
        this.headRotationSmoothing = { yaw: 0, pitch: 0, roll: 0 };
        
        // Enhanced expression thresholds
        this.expressionThresholds = {
            smile: 0.3,
            surprise: 0.25,
            jawOpen: 0.15,
            eyeBlink: 0.3,
            frown: 0.3,
            cheekPuff: 0.2
        };
        
        // Blendshape mappings
        this.blendShapeNames = [
            'eyeBlinkLeft', 'eyeBlinkRight', 'jawOpen',
            'mouthSmileLeft', 'mouthSmileRight',
            'mouthFrownLeft', 'mouthFrownRight',
            'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
            'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookInRight', 'eyeLookOutRight',
            'eyeLookUpLeft', 'eyeLookDownLeft', 'eyeLookUpRight', 'eyeLookDownRight'
        ];
        
        // Performance optimization
        this.clock = new THREE.Clock();
        this.animationId = null;
        
        // Initialize the app
        this.init();
    }

    async init() {
        try {
            this.updateStatus('🚀 Initializing Three.js application...', 'loading');
            
            // Initialize DOM elements
            this.video = document.getElementById('video');
            this.canvas = document.getElementById('renderCanvas');
            this.overlayCanvas = document.getElementById('overlay');
            
            if (!this.video || !this.canvas || !this.overlayCanvas) {
                throw new Error('Required DOM elements not found');
            }
            
            console.log('✅ DOM elements initialized');
            
            // Initialize Three.js
            await this.initThreeJS();
            
            // Load face-api.js models
            await this.loadFaceAPIModels();
            
            this.updateStatus('✅ Three.js application ready! Click "Start Camera" to begin.', 'ready');
            this.isInitialized = true;
            
        } catch (error) {
            console.error('❌ Initialization error:', error);
            this.updateStatus('❌ Initialization failed: ' + error.message, 'error');
        }
    }

    async initThreeJS() {
        try {
            // Create renderer with performance optimizations
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: false,
                powerPreference: "high-performance"
            });
            
            this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1;
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            
            // Create scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x1a1a33);
            
            // Setup camera
            this.camera = new THREE.PerspectiveCamera(
                50, // FOV
                this.canvas.clientWidth / this.canvas.clientHeight,
                0.1,
                1000
            );
            this.camera.position.set(0, 0, 6);
            
            // Setup controls with better performance settings
            this.controls = new OrbitControls(this.camera, this.canvas);
            this.controls.target.set(0, 0, 0);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.minDistance = 1;
            this.controls.maxDistance = 10;
            this.controls.enablePan = true;
            this.controls.enableZoom = true;
            this.controls.enableRotate = true;
            
            // Optimize controls for performance
            this.controls.addEventListener('change', () => {
                if (!this.manualCameraControl) {
                    this.updateSliderValues();
                }
            });
            
            // Setup lighting optimized for performance
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(5, 10, 5);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 1024; // Reduced for performance
            directionalLight.shadow.mapSize.height = 1024;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 50;
            this.scene.add(directionalLight);
            
            const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
            fillLight.position.set(-5, 0, 5);
            this.scene.add(fillLight);
            
            console.log('🚀 Three.js renderer initialized successfully');
            
            // Load avatar
            await this.loadAvatar();
            
            // Start render loop
            this.startRenderLoop();
            
            // Handle resize
            window.addEventListener('resize', () => this.handleResize());
            
            console.log('✅ Three.js initialization complete');
            
        } catch (error) {
            console.error('❌ Three.js initialization error:', error);
            throw new Error('Failed to initialize Three.js: ' + error.message);
        }
    }

    startRenderLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            // Update controls
            this.controls.update();
            
            // Update avatar animation
            if (this.avatar && this.isTracking) {
                this.updateAvatarAnimation();
            }
            
            // Render scene
            this.renderer.render(this.scene, this.camera);
        };
        
        animate();
    }

    handleResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    async loadAvatar() {
        try {
            const loader = new GLTFLoader();
            
            // Try to load custom avatar first
            const avatarPaths = [
                "./avatars/avatar.glb",
                "./avatars/test.glb",
                "./avatar.glb",
                "./test.glb"
            ];

            let loadedSuccessfully = false;

            for (const path of avatarPaths) {
                try {
                    console.log(`Attempting to load avatar from: ${path}`);
                    
                    const gltf = await new Promise((resolve, reject) => {
                        loader.load(path, resolve, undefined, reject);
                    });
                    
                    if (gltf.scene) {
                        this.setupAvatar(gltf);
                        console.log('✅ Avatar loaded successfully from:', path);
                        this.updateAvatarInfo(`🎭 Custom avatar loaded! (${this.getMorphTargetCount()} blendshapes)`);
                        loadedSuccessfully = true;
                        break;
                    }
                } catch (e) {
                    console.warn(`Could not load avatar from ${path}:`, e.message);
                    continue;
                }
            }

            if (!loadedSuccessfully) {
                this.createFallbackAvatar();
                this.updateAvatarInfo('🤖 Using fallback avatar (geometric shapes)');
                console.log('Using fallback avatar');
            }

        } catch (error) {
            console.error('Avatar loading error:', error);
            this.createFallbackAvatar();
        }
    }

    setupAvatar(gltf) {
        // Clear any existing avatar
        if (this.avatar) {
            this.scene.remove(this.avatar.group);
        }
        
        // Create avatar group
        const avatarGroup = new THREE.Group();
        this.scene.add(avatarGroup);
        
        // Process avatar meshes
        const meshes = [];
        const morphTargets = {};
        
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                // Optimize mesh for performance
                child.frustumCulled = true;
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Store mesh reference
                meshes.push(child);
                
                // Extract morph targets
                if (child.morphTargetDictionary && child.morphTargetInfluences) {
                    Object.keys(child.morphTargetDictionary).forEach(morphName => {
                        const index = child.morphTargetDictionary[morphName];
                        morphTargets[morphName.toLowerCase()] = {
                            mesh: child,
                            index: index
                        };
                    });
                }
                
                console.log(`📊 Mesh: ${child.name}, Morph targets: ${Object.keys(child.morphTargetDictionary || {}).length}`);
            }
        });
        
        // Setup avatar for face-only view
        this.setupAvatarForFaceView(gltf.scene, avatarGroup);
        
        // Store avatar data
        this.avatar = {
            group: avatarGroup,
            scene: gltf.scene,
            meshes: meshes,
            morphTargets: morphTargets,
            isFallback: false
        };
        
        console.log(`🎭 Avatar setup complete with ${Object.keys(morphTargets).length} morph targets`);
        console.log('📋 Available morph targets:', Object.keys(morphTargets));
    }

    setupAvatarForFaceView(avatarScene, avatarGroup) {
        // Define head/face parts to keep
        const keepParts = [
            'head', 'hair', 'eyes', 'eye', 'eyebrows', 'eyebrow', 'eyelashes', 'eyelash',
            'eyelids', 'eyelid', 'teeth', 'tooth', 'tongue', 'mouth', 'lips', 'lip',
            'nose', 'nostril', 'ears', 'ear', 'beard', 'mustache', 'face', 'facial',
            'skull', 'jaw', 'forehead', 'cheek', 'chin', 'pupil', 'iris', 'cornea',
            'sclera', 'eyeball'
        ];
        
        // Define body parts to hide
        const hideParts = [
            'body', 'shirt', 'top', 'torso', 'chest', 'shoulder', 'arm', 'hand',
            'finger', 'neck', 'neckline', 'throat', 'collar', 'sleeve', 'jacket',
            'hoodie', 'tshirt', 'clothing', 'outfit', 'pants', 'legs', 'feet', 'shoe', 'sock'
        ];
        
        const headParts = [];
        
        avatarScene.traverse((child) => {
            if (child.isMesh) {
                const meshName = child.name.toLowerCase();
                
                // Check if this is a head/face part
                const isHeadPart = keepParts.some(part => meshName.includes(part));
                const isBodyPart = hideParts.some(part => meshName.includes(part));
                
                if (isHeadPart && !isBodyPart) {
                    // Keep head/face parts
                    child.visible = true;
                    headParts.push(child);
                    console.log(`✅ Keeping head part: "${child.name}"`);
                } else if (isBodyPart) {
                    // Hide body parts
                    child.visible = false;
                    console.log(`❌ Hiding body part: "${child.name}"`);
                } else {
                    // For unrecognized parts, be conservative and keep them
                    child.visible = true;
                    headParts.push(child);
                    console.log(`🤔 Keeping unrecognized part: "${child.name}"`);
                }
            }
        });
        
        // Add avatar to group
        avatarGroup.add(avatarScene);
        
        // Position and scale for close-up face view
        avatarGroup.position.set(0, 0, 0);
        avatarGroup.scale.set(3, 3, 3);
        
        // Adjust camera for face view
        this.camera.position.set(0, 0.8, 2.4);
        this.controls.target.set(0, 0.8, 0);
        this.controls.update();
        
        console.log(`🎭 Avatar configured for face view with ${headParts.length} head parts`);
    }

    createFallbackAvatar() {
        // Create simple geometric avatar
        const avatarGroup = new THREE.Group();
        
        // Head (sphere)
        const headGeometry = new THREE.SphereGeometry(0.75, 32, 32);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xe8d5c4 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.name = 'head';
        head.castShadow = true;
        head.receiveShadow = true;
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.075, 16, 16);
        const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.3, 0.3, 0.6);
        leftEye.name = 'leftEye';
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.3, 0.3, 0.6);
        rightEye.name = 'rightEye';
        
        // Mouth
        const mouthGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.1);
        const mouthMaterial = new THREE.MeshLambertMaterial({ color: 0xcc6666 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, -0.2, 0.6);
        mouth.name = 'mouth';
        
        // Add to group
        avatarGroup.add(head);
        avatarGroup.add(leftEye);
        avatarGroup.add(rightEye);
        avatarGroup.add(mouth);
        
        this.scene.add(avatarGroup);
        
        this.avatar = {
            group: avatarGroup,
            head: head,
            leftEye: leftEye,
            rightEye: rightEye,
            mouth: mouth,
            morphTargets: {},
            isFallback: true
        };
        
        console.log('✅ Fallback avatar created');
    }

    getMorphTargetCount() {
        return this.avatar ? Object.keys(this.avatar.morphTargets).length : 0;
    }

    async loadFaceAPIModels() {
        try {
            const modelPaths = [
                './models',
                '/models',
                'https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master'
            ];

            let modelsLoaded = false;

            for (const path of modelPaths) {
                try {
                    await Promise.all([
                        faceapi.nets.tinyFaceDetector.loadFromUri(path),
                        faceapi.nets.faceLandmark68Net.loadFromUri(path),
                        faceapi.nets.faceExpressionNet.loadFromUri(path)
                    ]);
                    console.log('✅ Face API models loaded from:', path);
                    modelsLoaded = true;
                    break;
                } catch (e) {
                    console.warn(`Could not load models from ${path}:`, e.message);
                    continue;
                }
            }

            if (!modelsLoaded) {
                throw new Error('Could not load face-api.js models from any location');
            }

        } catch (error) {
            console.error('❌ Error loading face-api models:', error);
            throw new Error('Failed to load face detection models. Please check the models folder.');
        }
    }

    async startCamera() {
        try {
            if (!this.isInitialized) {
                throw new Error('Application not initialized');
            }

            this.updateStatus('📷 Starting camera...', 'loading');
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera API not available. Please use HTTPS or localhost.');
            }
            
            console.log('🔍 Requesting camera access...');

            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log('✅ Camera stream obtained:', stream);
            this.video.srcObject = stream;
            
            return new Promise((resolve, reject) => {
                const onLoadedMetadata = () => {
                    console.log('📺 Video metadata loaded');
                    
                    // Setup overlay canvas
                    this.overlayCanvas.width = this.video.videoWidth;
                    this.overlayCanvas.height = this.video.videoHeight;
                    
                    this.updateStatus('✅ Camera started! Face tracking active.', 'ready');
                    this.isTracking = true;
                    
                    // Start face tracking loop
                    this.trackFace();
                    
                    // Update UI
                    this.updateCameraUI(true);
                    
                    console.log('🎉 Camera initialization complete!');
                    resolve();
                };
                
                const onError = (error) => {
                    console.error('❌ Video element error:', error);
                    reject(new Error('Video element failed to load: ' + error.message));
                };
                
                this.video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
                this.video.addEventListener('error', onError, { once: true });
                
                setTimeout(() => {
                    if (!this.isTracking) {
                        reject(new Error('Camera initialization timeout'));
                    }
                }, 10000);
            });

        } catch (error) {
            console.error('❌ Camera error:', error);
            this.handleCameraError(error);
        }
    }

    stopCamera() {
        if (this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }
        
        this.isTracking = false;
        this.updateStatus('📷 Camera stopped', 'loading');
        this.updateCameraUI(false);
        
        // Clear overlay
        const ctx = this.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }

    updateCameraUI(isRunning) {
        const startBtn = document.getElementById('startBtn');
        const resetBtn = document.getElementById('resetBtn');
        const toggleDebugBtn = document.getElementById('toggleDebugBtn');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const cameraHorizontal = document.getElementById('cameraHorizontal');
        const cameraVertical = document.getElementById('cameraVertical');
        
        if (isRunning) {
            startBtn.textContent = '📷 Stop Camera';
            startBtn.onclick = () => this.stopCamera();
            resetBtn.disabled = false;
            toggleDebugBtn.disabled = false;
            zoomInBtn.disabled = false;
            zoomOutBtn.disabled = false;
            cameraHorizontal.disabled = false;
            cameraVertical.disabled = false;
            this.updateSliderValues();
        } else {
            startBtn.textContent = '🎬 Start Camera';
            startBtn.onclick = () => this.startCamera();
            resetBtn.disabled = true;
            toggleDebugBtn.disabled = true;
            zoomInBtn.disabled = true;
            zoomOutBtn.disabled = true;
            cameraHorizontal.disabled = true;
            cameraVertical.disabled = true;
        }
    }

    handleCameraError(error) {
        let errorMessage = error.message;
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Camera permission denied. Please allow camera access and reload the page.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'Camera is already in use by another application. Please close other apps and try again.';
        } else if (error.name === 'OverconstrainedError') {
            errorMessage = 'Camera does not meet the required specifications. Try a different camera.';
        } else if (error.name === 'SecurityError') {
            errorMessage = 'Camera access denied due to security restrictions. Please use HTTPS or localhost.';
        }
        
        this.updateStatus('❌ Camera access failed: ' + errorMessage, 'error');
        
        // Reset button state
        const startBtn = document.getElementById('startBtn');
        startBtn.textContent = '🎬 Start Camera';
        startBtn.onclick = () => this.startCamera();
    }

    async trackFace() {
        if (!this.isTracking) return;

        try {
            const detections = await faceapi.detectSingleFace(
                this.video,
                new faceapi.TinyFaceDetectorOptions()
            ).withFaceLandmarks().withFaceExpressions();

            if (detections) {
                this.faceDetections = detections;
                this.landmarks = detections.landmarks;
                this.expressions = detections.expressions;

                // Update face info
                const faceInfo = document.getElementById('faceInfo');
                if (faceInfo) {
                    faceInfo.textContent = `Face detected! Confidence: ${(detections.detection.score * 100).toFixed(1)}%`;
                }

                // Animate avatar based on expressions
                this.animateAvatar();

                // Update expression indicators
                this.updateExpressionIndicators();

                // Draw debug overlay if enabled
                if (this.debugMode) {
                    this.drawDebugOverlay();
                }
            } else {
                const faceInfo = document.getElementById('faceInfo');
                if (faceInfo) {
                    faceInfo.textContent = 'No face detected';
                }
                this.clearExpressionIndicators();
            }

        } catch (error) {
            console.error('Face tracking error:', error);
        }

        // Continue tracking
        requestAnimationFrame(() => this.trackFace());
    }

    animateAvatar() {
        if (!this.avatar || !this.expressions) return;

        // Process expressions with smoothing
        const smoothedExpressions = this.smoothExpressions(this.expressions);

        if (this.avatar.isFallback) {
            this.animateFallbackAvatar(smoothedExpressions);
        } else {
            this.animateBlendShapes(smoothedExpressions);
        }
    }

    smoothExpressions(expressions) {
        const smoothed = {};
        
        for (const [key, value] of Object.entries(expressions)) {
            const prevValue = this.previousExpressions[key] || 0;
            smoothed[key] = prevValue + (value - prevValue) * this.smoothingFactor;
            this.previousExpressions[key] = smoothed[key];
        }
        
        return smoothed;
    }

    animateFallbackAvatar(expressions) {
        if (!this.avatar.leftEye || !this.avatar.rightEye || !this.avatar.mouth) return;

        // Animate eyes (blinking)
        const blinkStrength = Math.max(expressions.neutral || 0, expressions.surprised || 0);
        this.avatar.leftEye.scale.y = Math.max(0.1, 1 - blinkStrength * 2);
        this.avatar.rightEye.scale.y = Math.max(0.1, 1 - blinkStrength * 2);

        // Animate mouth (smile/open)
        const smileStrength = expressions.happy || 0;
        const openStrength = expressions.surprised || 0;
        
        this.avatar.mouth.scale.x = 1 + smileStrength * 0.5;
        this.avatar.mouth.scale.y = 1 + openStrength * 2;

        // Head rotation based on face position
        if (this.landmarks) {
            const noseTip = this.landmarks.positions[30];
            const faceCenter = this.landmarks.positions[33];
            
            const rotationY = (noseTip.x - faceCenter.x) * 0.01;
            this.avatar.head.rotation.y = -rotationY;
        }
    }

    animateBlendShapes(expressions) {
        if (!this.avatar.morphTargets) return;

        // Enhanced mapping for morph targets
        const mappings = {
            // Eye blinking
            'eyeBlinkLeft': this.calculateEyeBlinkStrength('left'),
            'eyeblinkleft': this.calculateEyeBlinkStrength('left'),
            'eyeBlink_L': this.calculateEyeBlinkStrength('left'),
            'EyeBlinkLeft': this.calculateEyeBlinkStrength('left'),
            
            'eyeBlinkRight': this.calculateEyeBlinkStrength('right'),
            'eyeblinkright': this.calculateEyeBlinkStrength('right'),
            'eyeBlink_R': this.calculateEyeBlinkStrength('right'),
            'EyeBlinkRight': this.calculateEyeBlinkStrength('right'),
            
            // Mouth expressions
            'jawOpen': Math.max(this.calculateMouthOpenness() * 5.0, expressions.surprised * 3.0),
            'jawopen': Math.max(this.calculateMouthOpenness() * 5.0, expressions.surprised * 3.0),
            'JawOpen': Math.max(this.calculateMouthOpenness() * 5.0, expressions.surprised * 3.0),
            'mouthOpen': Math.max(this.calculateMouthOpenness() * 5.0, expressions.surprised * 2.4),
            
            // Smiling
            'mouthSmileLeft': expressions.happy * 3.0,
            'mouthsmileleft': expressions.happy * 3.0,
            'mouthSmile_L': expressions.happy * 3.0,
            'MouthSmileLeft': expressions.happy * 3.0,
            
            'mouthSmileRight': expressions.happy * 3.0,
            'mouthsmileright': expressions.happy * 3.0,
            'mouthSmile_R': expressions.happy * 3.0,
            'MouthSmileRight': expressions.happy * 3.0,
            
            // Eyebrow movement
            'browInnerUp': expressions.surprised * 0.6,
            'browOuterUpLeft': expressions.surprised * 0.5,
            'browOuterUpRight': expressions.surprised * 0.5,
        };

        // Apply blend shape influences
        let appliedCount = 0;
        
        for (const [shapeName, influence] of Object.entries(mappings)) {
            const smoothedInfluence = this.smoothBlendshape(shapeName, influence);
            const shapeKey = shapeName.toLowerCase();
            
            // Apply to morph targets
            if (this.avatar.morphTargets[shapeKey]) {
                const target = this.avatar.morphTargets[shapeKey];
                target.mesh.morphTargetInfluences[target.index] = Math.max(0, Math.min(1, smoothedInfluence));
                appliedCount++;
            }
        }

        // Debug info
        if (appliedCount > 0 && Math.random() < 0.01) {
            console.log(`🎭 Applied ${appliedCount} blendshape influences`);
        }
    }

    // Helper methods for expression calculation
    calculateEyeBlinkStrength(side) {
        if (!this.landmarks) return 0;
        
        try {
            const eyeLandmarks = side === 'left' ? this.landmarks.getLeftEye() : this.landmarks.getRightEye();
            if (eyeLandmarks.length < 6) return 0;
            
            const upperEyelid = eyeLandmarks[1];
            const lowerEyelid = eyeLandmarks[5];
            const eyeWidth = eyeLandmarks[3].x - eyeLandmarks[0].x;
            
            const eyeHeight = Math.abs(upperEyelid.y - lowerEyelid.y);
            const normalizedHeight = eyeHeight / eyeWidth;
            
            return Math.max(0, 1 - (normalizedHeight * 8));
        } catch (error) {
            return 0;
        }
    }

    calculateMouthOpenness() {
        if (!this.landmarks) return 0;
        
        try {
            const mouth = this.landmarks.getMouth();
            if (mouth.length < 20) return 0;
            
            const upperLip = mouth[13];
            const lowerLip = mouth[19];
            const mouthWidth = mouth[6].x - mouth[0].x;
            
            const mouthHeight = Math.abs(upperLip.y - lowerLip.y);
            const normalizedHeight = mouthHeight / mouthWidth;
            
            return Math.max(0, normalizedHeight - 0.1) * 2;
        } catch (error) {
            return 0;
        }
    }

    smoothBlendshape(shapeName, value) {
        const prevValue = this.blendshapeSmoothing[shapeName] || 0;
        const smoothed = prevValue + (value - prevValue) * this.smoothingFactor;
        this.blendshapeSmoothing[shapeName] = smoothed;
        return smoothed;
    }

    updateAvatarAnimation() {
        // This method is called in the render loop for any continuous animations
        if (this.avatar && !this.avatar.isFallback) {
            // Add any continuous animations here if needed
        }
    }

    // UI helper methods
    updateStatus(message, type) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status ${type}`;
        }
        console.log(`Status: ${message}`);
    }

    updateAvatarInfo(message) {
        const avatarInfoElement = document.getElementById('avatarInfo');
        if (avatarInfoElement) {
            avatarInfoElement.textContent = message;
        }
    }

    updateSliderValues() {
        // Update UI sliders based on camera position
        const cameraHorizontal = document.getElementById('cameraHorizontal');
        const cameraVertical = document.getElementById('cameraVertical');
        
        if (cameraHorizontal && cameraVertical) {
            // Convert camera position to slider values
            const horizontal = this.camera.position.x;
            const vertical = this.camera.position.y;
            
            cameraHorizontal.value = horizontal;
            cameraVertical.value = vertical;
        }
    }

    updateExpressionIndicators() {
        // Update expression indicators in the UI
        if (!this.expressions) return;
        
        Object.entries(this.expressions).forEach(([expression, value]) => {
            const indicator = document.getElementById(`${expression}Indicator`);
            if (indicator) {
                indicator.style.opacity = value;
            }
        });
    }

    clearExpressionIndicators() {
        // Clear all expression indicators
        const expressions = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral'];
        expressions.forEach(expression => {
            const indicator = document.getElementById(`${expression}Indicator`);
            if (indicator) {
                indicator.style.opacity = 0;
            }
        });
    }

    drawDebugOverlay() {
        if (!this.overlayCanvas || !this.landmarks) return;
        
        const ctx = this.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Draw face landmarks
        ctx.fillStyle = 'red';
        this.landmarks.positions.forEach(point => {
            ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
        });
    }

    // Cleanup method
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.controls) {
            this.controls.dispose();
        }
        
        this.stopCamera();
    }
}

// Export for use
window.FacePuppetApp = FacePuppetApp;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FacePuppetApp();
});
