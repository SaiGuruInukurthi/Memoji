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
        
        // Face tracking optimization
        this.faceTrackingFrameSkip = 3; // Skip more face detection frames, but not avatar animation
        this.faceTrackingFrameCount = 0;
        this.lastFaceTrackingTime = 0;
        this.faceTrackingInterval = 33; // Increased to ~30 FPS for faster detection with optimizations
        
        // Avatar animation optimization (separate from face tracking)
        this.avatarAnimationInterval = 16; // ~60 FPS for avatar animation (smooth)
        this.lastAvatarAnimationTime = 0;
        this.avatarAnimationFrameCount = 0;
        
        // Face-API performance optimizations
        this.faceDetectorOptions = null; // Will be initialized after models load
        
        // Canvas for face detection optimization
        this.detectionCanvas = null;
        this.detectionContext = null;
        
        // Animation smoothing - enhanced for better expression responsiveness
        this.smoothingFactor = 0.6; // Increased from 0.4 for more responsive animations
        this.previousExpressions = {};
        this.blendshapeSmoothing = {};
        this.headRotationSmoothing = { yaw: 0, pitch: 0, roll: 0 };
        
        // High-frequency avatar animation smoothing (separate from face detection)
        this.avatarSmoothingFactor = 0.8; // Higher responsiveness for avatar
        this.interpolationFrames = 4; // Interpolate between face detection updates
        
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
        
        // Enhanced performance tracking
        this.frameCount = 0;
        this.lastFPSTime = performance.now();
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        this.lastRenderTime = 0;
        this.adaptiveQuality = true;
        this.performanceStats = {
            fps: 0,
            renderTime: 0,
            frameTime: 0,
            faceDetectionTime: 0, // New: track face detection performance
            faceDetectionFPS: 0   // New: track face detection FPS
        };
        
        // Face detection performance tracking
        this.faceDetectionCount = 0;
        this.lastFaceDetectionFPSTime = performance.now();
        
        // Frustum culling optimization
        this.frustumCulling = true;
        
        // LOD (Level of Detail) system
        this.useLOD = true;
        this.lodDistance = 5;
        
        // Render targets for performance
        this.useRenderTargets = false;
        
        // Object pooling for performance
        this.objectPool = {
            vector3: [],
            matrix4: [],
            quaternion: [],
            box3: []
        };
        
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
            
            // Create optimized detection canvas for faster face-api processing
            this.createDetectionCanvas();
            
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
            // Create renderer with aggressive performance optimizations
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: window.devicePixelRatio <= 1, // Only enable AA on low DPI displays
                alpha: false,
                powerPreference: "high-performance",
                stencil: false, // Disable stencil buffer for performance
                depth: true,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false, // Better memory performance
                failIfMajorPerformanceCaveat: false
            });
            
            this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
            
            // Enhanced renderer optimizations
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1;
            
            // Shadow optimizations
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.shadowMap.autoUpdate = false; // Manual shadow updates for performance
            
            // Additional performance settings
            this.renderer.sortObjects = true; // Enable object sorting for better performance
            this.renderer.autoClear = true;
            this.renderer.autoClearColor = true;
            this.renderer.autoClearDepth = true;
            this.renderer.autoClearStencil = false;
            
            // Enable GPU timing for performance monitoring
            if (this.renderer.capabilities.disjointTimerQuery) {
                this.renderer.info.autoReset = false;
            }
            
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
            this.controls.maxDistance = 40; // Increased from 20 to 40 for maximum zoom out
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
        let lastTime = 0;
        
        const animate = (currentTime) => {
            this.animationId = requestAnimationFrame(animate);
            
            // Frame rate limiting for performance
            const deltaTime = currentTime - lastTime;
            if (deltaTime < this.frameInterval) {
                return; // Skip this frame to maintain target FPS
            }
            
            const frameStart = performance.now();
            
            // Update performance stats
            this.updatePerformanceStats(currentTime, deltaTime);
            
            // Adaptive quality based on performance
            if (this.adaptiveQuality) {
                this.adjustQualityBasedOnPerformance();
            }
            
            // Update controls (throttled)
            if (this.frameCount % 2 === 0) {
                this.controls.update();
            }
            
            // Update avatar animation at full 60 FPS (separate from face detection)
            if (this.avatar && this.isTracking) {
                this.updateAvatarAnimationHighFreq(currentTime);
            }
            
            // Frustum culling optimization
            if (this.frustumCulling && this.frameCount % 3 === 0) { // Throttle frustum culling
                this.performFrustumCulling();
            }
            
            // Render scene
            this.renderer.render(this.scene, this.camera);
            
            // Track render time
            const frameEnd = performance.now();
            this.performanceStats.renderTime = frameEnd - frameStart;
            this.performanceStats.frameTime = deltaTime;
            
            lastTime = currentTime;
            this.frameCount++;
        };
        
        animate(0);
    }

    handleResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    updatePerformanceStats(currentTime, deltaTime) {
        // Calculate FPS every second
        if (currentTime - this.lastFPSTime >= 1000) {
            this.performanceStats.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFPSTime));
            this.frameCount = 0;
            this.lastFPSTime = currentTime;
            
            // Update UI if debug mode is enabled
            if (this.debugMode) {
                this.updatePerformanceUI();
            }
        }
    }

    updateFaceDetectionFPS() {
        this.faceDetectionCount++;
        const currentTime = performance.now();
        
        // Calculate face detection FPS every second
        if (currentTime - this.lastFaceDetectionFPSTime >= 1000) {
            this.performanceStats.faceDetectionFPS = Math.round((this.faceDetectionCount * 1000) / (currentTime - this.lastFaceDetectionFPSTime));
            this.faceDetectionCount = 0;
            this.lastFaceDetectionFPSTime = currentTime;
        }
    }

    adjustQualityBasedOnPerformance() {
        const targetFPS = 60;
        const currentFPS = this.performanceStats.fps;
        
        if (currentFPS < targetFPS * 0.8) { // Below 80% of target FPS
            // Reduce quality for better performance
            if (this.renderer.getPixelRatio() > 1) {
                this.renderer.setPixelRatio(Math.max(1, this.renderer.getPixelRatio() - 0.1));
            }
            
            // Reduce shadow map size
            this.scene.traverse((child) => {
                if (child.isLight && child.shadow) {
                    if (child.shadow.mapSize.width > 512) {
                        child.shadow.mapSize.setScalar(512);
                        child.shadow.needsUpdate = true;
                    }
                }
            });
        } else if (currentFPS > targetFPS * 0.95) { // Above 95% of target FPS
            // Increase quality if performance allows
            if (this.renderer.getPixelRatio() < Math.min(window.devicePixelRatio, 2)) {
                this.renderer.setPixelRatio(Math.min(this.renderer.getPixelRatio() + 0.1, 2));
            }
        }
    }

    performFrustumCulling() {
        if (!this.camera) return;
        
        const frustum = new THREE.Frustum();
        const matrix = this.getPooledMatrix4().multiplyMatrices(
            this.camera.projectionMatrix, 
            this.camera.matrixWorldInverse
        );
        frustum.setFromProjectionMatrix(matrix);
        
        this.scene.traverse((object) => {
            if (object.isMesh) {
                // Check if object is in camera frustum using pooled objects
                const boundingBox = this.getPooledBox3().setFromObject(object);
                object.visible = frustum.intersectsBox(boundingBox);
                this.returnPooledBox3(boundingBox);
            }
        });
        
        this.returnPooledMatrix4(matrix);
    }

    // Object pooling methods for performance
    getPooledVector3() {
        return this.objectPool.vector3.pop() || new THREE.Vector3();
    }

    returnPooledVector3(vector) {
        vector.set(0, 0, 0);
        this.objectPool.vector3.push(vector);
    }

    getPooledMatrix4() {
        return this.objectPool.matrix4.pop() || new THREE.Matrix4();
    }

    returnPooledMatrix4(matrix) {
        matrix.identity();
        this.objectPool.matrix4.push(matrix);
    }

    getPooledQuaternion() {
        return this.objectPool.quaternion.pop() || new THREE.Quaternion();
    }

    returnPooledQuaternion(quaternion) {
        quaternion.set(0, 0, 0, 1);
        this.objectPool.quaternion.push(quaternion);
    }

    getPooledBox3() {
        return this.objectPool.box3.pop() || new THREE.Box3();
    }

    returnPooledBox3(box) {
        box.makeEmpty();
        this.objectPool.box3.push(box);
    }

    updatePerformanceUI() {
        // Update performance counter if it exists
        const performanceCounter = document.getElementById('performanceCounter');
        if (performanceCounter) {
            performanceCounter.innerHTML = `
                Render: ${this.performanceStats.fps} FPS | ${this.performanceStats.renderTime.toFixed(1)}ms<br>
                Face Detection: ${this.performanceStats.faceDetectionFPS} FPS | ${this.performanceStats.faceDetectionTime.toFixed(1)}ms
            `;
        }
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

            // Initialize optimized face detector options after models are loaded
            this.faceDetectorOptions = new faceapi.TinyFaceDetectorOptions({
                inputSize: 160, // Reduced from default 416 for 2.6x speed improvement
                scoreThreshold: 0.3 // Lower threshold for faster detection
            });
            
            console.log('✅ Face detector optimized for speed (160px input, 0.3 threshold)');

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
        const togglePerformanceBtn = document.getElementById('togglePerformanceBtn');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const cameraHorizontal = document.getElementById('cameraHorizontal');
        const cameraVertical = document.getElementById('cameraVertical');
        
        if (isRunning) {
            startBtn.textContent = '📷 Stop Camera';
            startBtn.onclick = () => this.stopCamera();
            resetBtn.disabled = false;
            toggleDebugBtn.disabled = false;
            if (togglePerformanceBtn) {
                togglePerformanceBtn.disabled = false;
                togglePerformanceBtn.textContent = this.adaptiveQuality ? '⚡ Performance ON' : '⚡ Performance OFF';
                togglePerformanceBtn.style.background = this.adaptiveQuality ? 'rgba(76, 175, 80, 0.3)' : '';
            }
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
            if (togglePerformanceBtn) togglePerformanceBtn.disabled = true;
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

        const faceDetectionStart = performance.now();

        try {
            // Use optimized video frame for faster detection
            const inputElement = this.optimizeVideoFrame();
            if (!inputElement) {
                return; // Skip this frame if optimization failed
            }
            
            // Use pre-configured optimized detector options
            const detections = await faceapi.detectSingleFace(
                inputElement,
                this.faceDetectorOptions
            ).withFaceLandmarks().withFaceExpressions();

            // Track face detection performance
            const faceDetectionEnd = performance.now();
            this.performanceStats.faceDetectionTime = faceDetectionEnd - faceDetectionStart;
            this.updateFaceDetectionFPS();

            if (detections) {
                this.faceDetections = detections;
                this.landmarks = detections.landmarks;
                
                // Store previous expressions for interpolation
                this.previousExpressions = { ...this.expressions };
                this.expressions = detections.expressions;

                // Update face info
                const faceInfo = document.getElementById('faceInfo');
                if (faceInfo) {
                    faceInfo.textContent = `Face detected! Confidence: ${(detections.detection.score * 100).toFixed(1)}%`;
                }

                // Animate avatar based on expressions (lower frequency detection)
                this.animateAvatar();
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

        // Optimized face tracking loop with throttling
        this.faceTrackingFrameCount++;
        const now = performance.now();
        
        // Throttle face tracking to improve performance
        if (now - this.lastFaceTrackingTime >= this.faceTrackingInterval) {
            this.lastFaceTrackingTime = now;
            requestAnimationFrame(() => this.trackFace());
        } else {
            // Use setTimeout for more precise timing
            setTimeout(() => this.trackFace(), this.faceTrackingInterval - (now - this.lastFaceTrackingTime));
        }
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

        // Remove frame skipping for smoother avatar animation
        // Avatar animations now run at full frequency

        // Enhanced mapping for morph targets with performance optimization
        const mappings = {
            // Eye blinking - cached calculations
            'eyeBlinkLeft': this.calculateEyeBlinkStrength('left'),
            'eyeblinkleft': this.calculateEyeBlinkStrength('left'),
            'eyeBlink_L': this.calculateEyeBlinkStrength('left'),
            'EyeBlinkLeft': this.calculateEyeBlinkStrength('left'),
            
            'eyeBlinkRight': this.calculateEyeBlinkStrength('right'),
            'eyeblinkright': this.calculateEyeBlinkStrength('right'),
            'eyeBlink_R': this.calculateEyeBlinkStrength('right'),
            'EyeBlinkRight': this.calculateEyeBlinkStrength('right'),
            
            // Mouth expressions - optimized calculations
            'jawOpen': Math.max(this.calculateMouthOpenness() * 5.0, expressions.surprised * 3.0),
            'jawopen': Math.max(this.calculateMouthOpenness() * 5.0, expressions.surprised * 3.0),
            'JawOpen': Math.max(this.calculateMouthOpenness() * 5.0, expressions.surprised * 3.0),
            'mouthOpen': Math.max(this.calculateMouthOpenness() * 5.0, expressions.surprised * 2.4),
            
            // Smiling - reuse calculations
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

        // Apply blend shape influences with higher frequency smoothing
        let appliedCount = 0;
        
        for (const [shapeName, influence] of Object.entries(mappings)) {
            const smoothedInfluence = this.smoothBlendshapeHighFreq(shapeName, influence);
            const shapeKey = shapeName.toLowerCase();
            
            // Apply to morph targets with reduced threshold for smoother animation
            if (this.avatar.morphTargets[shapeKey]) {
                const target = this.avatar.morphTargets[shapeKey];
                const finalInfluence = Math.max(0, Math.min(1, smoothedInfluence));
                
                // Reduced threshold for smoother updates (was 0.01, now 0.005)
                const currentInfluence = target.mesh.morphTargetInfluences[target.index];
                if (Math.abs(finalInfluence - currentInfluence) > 0.005) {
                    target.mesh.morphTargetInfluences[target.index] = finalInfluence;
                    appliedCount++;
                }
            }
        }

        // Debug info (reduced frequency)
        if (appliedCount > 0 && Math.random() < 0.001) { // Further reduced logging
            console.log(`🎭 Applied ${appliedCount} blendshape influences (High-Freq)`);
        }
    }

    // Helper methods for expression calculation with caching
    calculateEyeBlinkStrength(side) {
        if (!this.landmarks) return 0;
        
        // Cache key for this calculation
        const cacheKey = `eyeBlink_${side}_${this.faceTrackingFrameCount}`;
        if (this.calculationCache && this.calculationCache[cacheKey]) {
            return this.calculationCache[cacheKey];
        }
        
        try {
            const eyeLandmarks = side === 'left' ? this.landmarks.getLeftEye() : this.landmarks.getRightEye();
            if (eyeLandmarks.length < 6) return 0;
            
            const upperEyelid = eyeLandmarks[1];
            const lowerEyelid = eyeLandmarks[5];
            const eyeWidth = eyeLandmarks[3].x - eyeLandmarks[0].x;
            
            const eyeHeight = Math.abs(upperEyelid.y - lowerEyelid.y);
            const normalizedHeight = eyeHeight / eyeWidth;
            
            const result = Math.max(0, 1 - (normalizedHeight * 8));
            
            // Cache the result
            if (!this.calculationCache) this.calculationCache = {};
            this.calculationCache[cacheKey] = result;
            
            return result;
        } catch (error) {
            return 0;
        }
    }

    calculateMouthOpenness() {
        if (!this.landmarks) return 0;
        
        // Cache key for this calculation
        const cacheKey = `mouthOpen_${this.faceTrackingFrameCount}`;
        if (this.calculationCache && this.calculationCache[cacheKey]) {
            return this.calculationCache[cacheKey];
        }
        
        try {
            const mouth = this.landmarks.getMouth();
            if (mouth.length < 20) return 0;
            
            const upperLip = mouth[13];
            const lowerLip = mouth[19];
            const mouthWidth = mouth[6].x - mouth[0].x;
            
            const mouthHeight = Math.abs(upperLip.y - lowerLip.y);
            const normalizedHeight = mouthHeight / mouthWidth;
            
            const result = Math.max(0, normalizedHeight - 0.1) * 2;
            
            // Cache the result
            if (!this.calculationCache) this.calculationCache = {};
            this.calculationCache[cacheKey] = result;
            
            return result;
        } catch (error) {
            return 0;
        }
    }

    smoothBlendshape(shapeName, value) {
        // Optimized smoothing with early exit for performance
        const prevValue = this.blendshapeSmoothing[shapeName] || 0;
        
        // Skip smoothing calculation if the change is minimal
        if (Math.abs(value - prevValue) < 0.001) {
            return prevValue;
        }
        
        const smoothed = prevValue + (value - prevValue) * this.smoothingFactor;
        this.blendshapeSmoothing[shapeName] = smoothed;
        return smoothed;
    }

    updateAvatarAnimation() {
        // This method is called in the render loop for any continuous animations
        if (this.avatar && !this.avatar.isFallback) {
            // Clear calculation cache periodically to prevent memory leaks
            if (this.frameCount % 120 === 0) { // Every 2 seconds at 60fps
                this.clearCalculationCache();
            }
        }
    }

    updateAvatarAnimationHighFreq(currentTime) {
        // High-frequency avatar animation updates (60 FPS)
        // This runs independently of face detection frequency
        
        if (!this.avatar || !this.expressions) return;
        
        this.avatarAnimationFrameCount++;
        
        // Interpolate expressions between face detection updates for smoother animation
        const interpolatedExpressions = this.interpolateExpressions();
        
        // Update avatar with interpolated data
        if (this.avatar.isFallback) {
            this.animateFallbackAvatar(interpolatedExpressions);
        } else {
            this.animateBlendShapes(interpolatedExpressions);
        }
    }

    interpolateExpressions() {
        // Create smoother animation by interpolating between face detection updates
        if (!this.expressions || !this.previousExpressions) {
            return this.expressions || {};
        }
        
        // Calculate interpolation factor based on time since last face detection
        const timeSinceLastDetection = performance.now() - this.lastFaceTrackingTime;
        const interpolationFactor = Math.min(timeSinceLastDetection / this.faceTrackingInterval, 1.0);
        
        const interpolated = {};
        
        // Interpolate each expression value
        for (const [key, currentValue] of Object.entries(this.expressions)) {
            const previousValue = this.previousExpressions[key] || 0;
            
            // Use easing function for smoother interpolation
            const easedFactor = this.easeInOutCubic(interpolationFactor);
            interpolated[key] = previousValue + (currentValue - previousValue) * easedFactor;
        }
        
        return interpolated;
    }

    easeInOutCubic(t) {
        // Smooth easing function for more natural animation
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    smoothBlendshapeHighFreq(shapeName, value) {
        // High-frequency smoothing with different parameters
        const prevValue = this.blendshapeSmoothing[shapeName] || 0;
        
        // Skip smoothing calculation if the change is minimal
        if (Math.abs(value - prevValue) < 0.0005) { // Even smaller threshold for smoother animation
            return prevValue;
        }
        
        // Use higher smoothing factor for more responsive animation
        const smoothed = prevValue + (value - prevValue) * this.avatarSmoothingFactor;
        this.blendshapeSmoothing[shapeName] = smoothed;
        return smoothed;
    }

    clearCalculationCache() {
        // Clear calculation cache to prevent memory leaks
        this.calculationCache = {};
    }

    createDetectionCanvas() {
        // Create a smaller canvas for faster face detection
        this.detectionCanvas = document.createElement('canvas');
        this.detectionCanvas.width = 320; // Reduced size for faster processing
        this.detectionCanvas.height = 240;
        this.detectionContext = this.detectionCanvas.getContext('2d');
        
        // Hide the detection canvas (it's just for processing)
        this.detectionCanvas.style.display = 'none';
        document.body.appendChild(this.detectionCanvas);
        
        console.log('✅ Detection canvas created (320x240) for faster face-api processing');
    }

    optimizeVideoFrame() {
        // Draw video frame to smaller detection canvas for faster processing
        if (!this.video || !this.detectionCanvas || this.video.videoWidth === 0) {
            return null;
        }
        
        try {
            // Calculate aspect ratio and draw with optimal scaling
            const videoAspect = this.video.videoWidth / this.video.videoHeight;
            const canvasAspect = this.detectionCanvas.width / this.detectionCanvas.height;
            
            let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
            
            if (videoAspect > canvasAspect) {
                drawHeight = this.detectionCanvas.height;
                drawWidth = drawHeight * videoAspect;
                offsetX = (this.detectionCanvas.width - drawWidth) / 2;
            } else {
                drawWidth = this.detectionCanvas.width;
                drawHeight = drawWidth / videoAspect;
                offsetY = (this.detectionCanvas.height - drawHeight) / 2;
            }
            
            // Clear and draw video frame
            this.detectionContext.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
            this.detectionContext.drawImage(this.video, offsetX, offsetY, drawWidth, drawHeight);
            
            return this.detectionCanvas;
        } catch (error) {
            console.warn('Video frame optimization failed:', error);
            return this.video; // Fallback to original video
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
