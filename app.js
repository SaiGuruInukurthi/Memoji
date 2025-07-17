/**
 * Memoji-Style Face Puppet Application
 * Real-time face tracking with 3D avatar animation
 */

class FacePuppetApp {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.engine = null;
        this.scene = null;
        this.camera = null;
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
        this.smoothingFactor = 0.4; // Increased from 0.3 for more responsive expressions
        this.previousExpressions = {};
        this.blendshapeSmoothing = {}; // For individual blendshape smoothing
        this.headRotationSmoothing = { yaw: 0, pitch: 0, roll: 0 }; // For head rotation smoothing
        
        // Enhanced expression thresholds
        this.expressionThresholds = {
            smile: 0.3,        // Lower threshold for easier smile detection
            surprise: 0.25,    // Lower threshold for eyebrow raise
            jawOpen: 0.15,     // Lower threshold for mouth opening
            eyeBlink: 0.3,     // Lowered from 0.6 for more sensitive blink detection
            frown: 0.3,        // Easier frown detection
            cheekPuff: 0.2     // Lower threshold for cheek expressions
        };
        
        // Blendshape mappings
        this.blendShapeNames = [
            'eyeBlinkLeft',
            'eyeBlinkRight', 
            'jawOpen',
            'mouthSmileLeft',
            'mouthSmileRight',
            'mouthFrownLeft',
            'mouthFrownRight',
            'browInnerUp',
            'browOuterUpLeft',
            'browOuterUpRight',
            'eyeLookInLeft',
            'eyeLookOutLeft',
            'eyeLookInRight',
            'eyeLookOutRight',
            'eyeLookUpLeft',
            'eyeLookDownLeft',
            'eyeLookUpRight',
            'eyeLookDownRight'
        ];
        
        // Camera panning state
        this.panX = 0;
        this.panY = 4.8;
        
        // Initialize the app
        this.init();
    }

    async init() {
        try {
            this.updateStatus('🚀 Initializing application...', 'loading');
            
            // Initialize DOM elements
            this.video = document.getElementById('video');
            this.canvas = document.getElementById('renderCanvas');
            this.overlayCanvas = document.getElementById('overlay');
            
            if (!this.video || !this.canvas || !this.overlayCanvas) {
                throw new Error('Required DOM elements not found');
            }
            
            console.log('✅ DOM elements initialized');
            
            // Check if Babylon.js is loaded
            if (typeof BABYLON === 'undefined') {
                throw new Error('Babylon.js library not loaded');
            }
            
            console.log('✅ Babylon.js library detected');
            
            // Initialize Babylon.js
            await this.initBabylon();
            
            // Load face-api.js models
            await this.loadFaceAPIModels();
            
            this.updateStatus('✅ Application ready! Click "Start Camera" to begin.', 'ready');
            this.isInitialized = true;
            
        } catch (error) {
            console.error('❌ Initialization error:', error);
            this.updateStatus('❌ Initialization failed: ' + error.message, 'error');
        }
    }

    async initBabylon() {
        try {
            // Create Babylon.js engine
            this.engine = new BABYLON.Engine(this.canvas, true, {
                preserveDrawingBuffer: true,
                stencil: true,
                antialias: true
            });

            // Create scene
            this.scene = new BABYLON.Scene(this.engine);
            
            // Set background color
            this.scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.2);

            // Setup camera with proper settings
            this.camera = new BABYLON.ArcRotateCamera(
                "camera",
                -Math.PI / 2,
                Math.PI / 2.5,
                6,
                BABYLON.Vector3.Zero(),
                this.scene
            );
            this.camera.attachControl(this.canvas, true);
            this.camera.setTarget(BABYLON.Vector3.Zero());
            this.camera.lowerRadiusLimit = 1;
            this.camera.upperRadiusLimit = 10;

            // Add better lighting for avatar
            const light = new BABYLON.HemisphericLight("hemiLight", new BABYLON.Vector3(0, 1, 0), this.scene);
            light.intensity = 0.7;

            const directionalLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-0.5, -1, -0.5), this.scene);
            directionalLight.intensity = 0.6;
            directionalLight.position = new BABYLON.Vector3(5, 10, 5);

            // Add fill light
            const fillLight = new BABYLON.DirectionalLight("fillLight", new BABYLON.Vector3(0.5, 0, 0.5), this.scene);
            fillLight.intensity = 0.3;

            console.log('🚀 Babylon.js engine initialized successfully');

            // Load avatar
            await this.loadAvatar();

            // Start render loop
            this.engine.runRenderLoop(() => {
                if (this.scene && this.scene.activeCamera) {
                    this.scene.render();
                    
                    // Update slider values if camera was moved manually (not by sliders)
                    if (!this.manualCameraControl && this.isTracking) {
                        this.syncSliderValues();
                    }
                }
            });

            // Handle resize
            window.addEventListener("resize", () => {
                if (this.engine) {
                    this.engine.resize();
                }
            });

            console.log('✅ Babylon.js initialization complete');

        } catch (error) {
            console.error('❌ Babylon.js initialization error:', error);
            throw new Error('Failed to initialize 3D engine: ' + error.message);
        }
    }

    async loadAvatar() {
        try {
            // Try to load custom avatar first
            const avatarPaths = [
                "./avatars/avatar.glb",
                "./avatars/test.glb",
                "./avatars/avatar.babylon",
                "./avatar.glb",
                "./test.glb",
                "./avatar.babylon"
            ];

            let loadedSuccessfully = false;

            for (const path of avatarPaths) {
                try {
                    console.log(`Attempting to load avatar from: ${path}`);
                    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", path, this.scene);
                    
                    if (result.meshes && result.meshes.length > 0) {
                        this.avatar = {
                            meshes: result.meshes,
                            morphTargets: this.findMorphTargets(result.meshes),
                            skeleton: result.skeletons[0] || null,
                            animations: result.animationGroups || []
                        };

                        // Optimize Ready Player Me avatar positioning
                        this.setupReadyPlayerMeAvatar(result);
                        
                        // ReadyPlayerMe avatars sometimes have specific materials that need activation
                        this.activateRPMFacialComponents();
                        
                        // Apply default camera positioning
                        this.applyCameraPanning();
                        this.syncSliderValues();

                        console.log('✅ Avatar loaded successfully from:', path);
                        console.log('📊 Avatar stats:');
                        console.log('  - Meshes:', result.meshes.length);
                        console.log('  - Skeleton:', result.skeletons.length > 0 ? 'Yes' : 'No');
                        console.log('  - Animation groups:', result.animationGroups.length);
                        console.log('  - Available morph targets:', Object.keys(this.avatar.morphTargets).length);
                        console.log('  - Morph target names:', Object.keys(this.avatar.morphTargets));
                        
                        // Update UI to show custom avatar is loaded
                        this.updateAvatarInfo(`🎭 Custom avatar loaded! (${Object.keys(this.avatar.morphTargets).length} blendshapes)`);
                        
                        loadedSuccessfully = true;
                        break;
                    }
                } catch (e) {
                    console.warn(`Could not load avatar from ${path}:`, e.message);
                    continue;
                }
            }

            if (!loadedSuccessfully) {
                // Create a fallback avatar
                this.createFallbackAvatar();
                this.updateAvatarInfo('🤖 Using fallback avatar (geometric shapes)');
                console.log('Using fallback avatar');
            }

        } catch (error) {
            console.error('Avatar loading error:', error);
            this.createFallbackAvatar();
        }
    }

    setupReadyPlayerMeAvatar(result) {
        let headMesh = null;
        let allHeadParts = []; // Store all head-related meshes for grouped animation
        
        // Define what we want to keep (head/face parts only) - more comprehensive
        const keepParts = [
            'head', 'hair', 'eyes', 'eye', 'eyebrows', 'eyebrow', 'eyelashes', 'eyelash', 
            'eyelids', 'eyelid', 'teeth', 'tooth', 'tongue', 'mouth', 'lips', 'lip', 
            'nose', 'nostril', 'ears', 'ear', 'beard', 'mustache', 'face', 'facial',
            'skull', 'jaw', 'forehead', 'cheek', 'chin', 'pupil', 'iris', 'cornea',
            'sclera', 'eyeball', 'upper', 'lower', 'left', 'right', 'inner', 'outer'
        ];
        
        // Define what we want to hide (body parts)
        const hideParts = [
            'body', 'shirt', 'top', 'torso', 'chest', 'shoulder', 'arm', 'hand',
            'finger', 'neck', 'neckline', 'throat', 'collar', 'sleeve', 'jacket', 'hoodie', 'tshirt',
            'clothing', 'outfit', 'pants', 'legs', 'feet', 'shoe', 'sock'
        ];
        
        // Debug: Log all mesh names first
        console.log('🔍 Analyzing all meshes in avatar:');
        result.meshes.forEach((mesh, index) => {
            console.log(`  ${index}: "${mesh.name}" (geometry: ${!!mesh.geometry}, parent: ${mesh.parent?.name || 'none'})`);
        });
        
        // First pass: identify and configure all meshes
        result.meshes.forEach(mesh => {
            const meshName = mesh.name.toLowerCase();
            
            // Skip root node
            if (mesh.name === "__root__" || !mesh.geometry) return;
            
            // Check if this is a head/face part we want to keep
            const isHeadPart = keepParts.some(part => meshName.includes(part));
            const isBodyPart = hideParts.some(part => meshName.includes(part));
            
            // Special case: if it contains both head and body terms, prioritize head
            const headTermCount = keepParts.filter(part => meshName.includes(part)).length;
            const bodyTermCount = hideParts.filter(part => meshName.includes(part)).length;
            
            if (isHeadPart && (headTermCount >= bodyTermCount)) {
                // Keep and configure head/face parts
                mesh.position.y = 0.2;
                mesh.position.x = 0;
                mesh.position.z = 0;
                
                // Scale appropriately for close-up face view
                mesh.scaling = new BABYLON.Vector3(3.0, 3.0, 3.0);
                
                // Rotate to face camera
                mesh.rotation.y = 0;
                
                // Force visibility
                mesh.setEnabled(true);
                mesh.visibility = 1;
                
                // Special handling for materials to ensure visibility
                if (mesh.material) {
                    if (mesh.material.diffuseTexture) {
                        mesh.material.diffuseTexture.hasAlpha = false;
                    }
                    mesh.material.transparencyMode = null;
                    mesh.material.alpha = 1.0;
                }
                
                // Add to head parts collection for grouped animation
                allHeadParts.push(mesh);
                
                // Store reference to main head mesh
                if (!headMesh && (meshName.includes('head') || meshName.includes('skull') || meshName.includes('face'))) {
                    headMesh = mesh;
                }
                
                console.log(`✅ Keeping head part: "${mesh.name}" (terms: ${headTermCount})`);
                
            } else if (isBodyPart && !isHeadPart) {
                // Hide body parts
                mesh.setEnabled(false);
                mesh.visibility = 0;
                console.log(`❌ Hiding body part: "${mesh.name}"`);
                
            } else if (!isHeadPart && !isBodyPart) {
                // For unrecognized parts, check parent relationship and be more inclusive
                const hasHeadParent = mesh.parent && 
                    keepParts.some(part => mesh.parent.name.toLowerCase().includes(part));
                
                // Also check if it might be an unnamed but important facial component
                const couldBeFacialPart = mesh.geometry && 
                    (mesh.getBoundingInfo().boundingBox.maximum.y > 0); // Above origin
                
                if (hasHeadParent || couldBeFacialPart) {
                    // Keep it as potential facial component
                    mesh.position.y = 0.2;
                    mesh.scaling = new BABYLON.Vector3(3.0, 3.0, 3.0);
                    mesh.setEnabled(true);
                    mesh.visibility = 1;
                    
                    // Force material visibility
                    if (mesh.material) {
                        mesh.material.alpha = 1.0;
                        mesh.material.transparencyMode = null;
                    }
                    
                    allHeadParts.push(mesh);
                    console.log(`⚠️ Keeping potential facial part: "${mesh.name}" (parent: ${mesh.parent?.name || 'none'})`);
                } else {
                    // Hide by default
                    mesh.setEnabled(false);
                    mesh.visibility = 0;
                    console.log(`🔄 Hiding unrecognized part: "${mesh.name}"`);
                }
            }
        });

        // Create a head group node for coordinated movement
        const headGroup = new BABYLON.TransformNode("headGroup", this.scene);
        headGroup.position = new BABYLON.Vector3(0, 0, 0);
        
        // Parent all head parts to the group for unified rotation
        allHeadParts.forEach(mesh => {
            mesh.setParent(headGroup);
        });

        // Store references
        this.avatar.headMesh = headMesh;
        this.avatar.headGroup = headGroup;
        this.avatar.allHeadParts = allHeadParts;
        
        // Enhanced lighting for better facial feature visibility
        const facialLight = new BABYLON.SpotLight(
            "facialLight", 
            new BABYLON.Vector3(0, 2, 2), 
            new BABYLON.Vector3(0, -1, -1), 
            Math.PI / 3, 
            2, 
            this.scene
        );
        facialLight.intensity = 0.8;
        facialLight.diffuse = new BABYLON.Color3(1, 0.95, 0.9); // Slightly warm light
        
        // Set up camera for close-up face view
        this.camera.setTarget(new BABYLON.Vector3(0, 0.8, 0));
        this.camera.radius = 2.4;
        this.camera.alpha = -Math.PI / 2;
        this.camera.beta = Math.PI / 2.1;
        this.camera.lowerRadiusLimit = 0.8;
        this.camera.upperRadiusLimit = 3.0;
        
        console.log(`🎭 Avatar configured for head-only view with ${allHeadParts.length} head parts grouped together`);
        console.log(`📋 Head parts: ${allHeadParts.map(m => m.name).join(', ')}`);
        
        // Debug function to verify critical facial components
        this.debugFacialComponents();
    }
    
    debugFacialComponents() {
        if (!this.avatar || !this.avatar.allHeadParts) return;
        
        console.log('🔍 FACIAL COMPONENTS ANALYSIS:');
        
        // Check for critical components
        const criticalComponents = {
            eyes: ['eye', 'eyeball', 'pupil', 'iris', 'sclera', 'cornea'],
            teeth: ['teeth', 'tooth', 'dental'],
            tongue: ['tongue'],
            eyelids: ['eyelid', 'lid'],
            eyebrows: ['eyebrow', 'brow'],
            mouth: ['mouth', 'lip']
        };
        
        Object.entries(criticalComponents).forEach(([component, keywords]) => {
            const foundParts = this.avatar.allHeadParts.filter(mesh => 
                keywords.some(keyword => mesh.name.toLowerCase().includes(keyword))
            );
            
            if (foundParts.length > 0) {
                console.log(`✅ ${component.toUpperCase()}: Found ${foundParts.length} parts`);
                foundParts.forEach(part => {
                    console.log(`   - "${part.name}" (visible: ${part.visibility}, enabled: ${part.isEnabled()})`);
                    
                    // Force visibility for critical components
                    if (part.visibility < 1 || !part.isEnabled()) {
                        part.setEnabled(true);
                        part.visibility = 1;
                        console.log(`   ⚡ Force-enabled: "${part.name}"`);
                    }
                });
            } else {
                console.log(`❌ ${component.toUpperCase()}: NOT FOUND`);
            }
        });
        
        // Check materials for transparency issues
        console.log('🎨 MATERIAL ANALYSIS:');
        this.avatar.allHeadParts.forEach(mesh => {
            if (mesh.material) {
                const mat = mesh.material;
                if (mat.alpha < 1 || mat.transparencyMode !== null) {
                    console.log(`⚠️ Transparency issue in "${mesh.name}": alpha=${mat.alpha}, transparency=${mat.transparencyMode}`);
                    // Fix transparency
                    mat.alpha = 1.0;
                    mat.transparencyMode = null;
                    console.log(`   ✅ Fixed transparency for "${mesh.name}"`);
                }
            }
        });
        
        // Log morph targets for expressions
        if (this.avatar.morphTargets) {
            console.log(`🎭 MORPH TARGETS: ${Object.keys(this.avatar.morphTargets).length} found`);
            const eyeTargets = Object.keys(this.avatar.morphTargets).filter(name => 
                name.includes('eye') || name.includes('blink')
            );
            const mouthTargets = Object.keys(this.avatar.morphTargets).filter(name => 
                name.includes('mouth') || name.includes('jaw') || name.includes('smile')
            );
            console.log(`👁️ Eye morph targets: ${eyeTargets.join(', ')}`);
            console.log(`👄 Mouth morph targets: ${mouthTargets.join(', ')}`);
        }
    }
    
    activateRPMFacialComponents() {
        if (!this.avatar) return;
        
        console.log('🔧 Activating ReadyPlayerMe facial components...');
        
        // ReadyPlayerMe specific component names
        const rpmComponents = [
            'EyeLeft', 'EyeRight', 'eyeLeft', 'eyeRight',
            'Teeth', 'teeth', 'TeethLower', 'TeethUpper',
            'Tongue', 'tongue',
            'EyeLashLeft', 'EyeLashRight', 'eyelashLeft', 'eyelashRight',
            'EyeBrowLeft', 'EyeBrowRight', 'eyebrowLeft', 'eyebrowRight',
            'Head', 'head'
        ];
        
        rpmComponents.forEach(componentName => {
            const mesh = this.scene.getMeshByName(componentName);
            if (mesh) {
                console.log(`✅ Found RPM component: ${componentName}`);
                
                // Ensure visibility
                mesh.setEnabled(true);
                mesh.visibility = 1;
                
                // Fix material if needed
                if (mesh.material) {
                    mesh.material.alpha = 1.0;
                    mesh.material.transparencyMode = null;
                    
                    // Special handling for eye materials
                    if (componentName.toLowerCase().includes('eye')) {
                        mesh.material.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                        console.log(`👁️ Enhanced eye material for ${componentName}`);
                    }
                }
                
                // Add to head group if not already included
                if (this.avatar.headGroup && mesh.parent !== this.avatar.headGroup) {
                    mesh.setParent(this.avatar.headGroup);
                    console.log(`🔗 Added ${componentName} to head group`);
                }
            }
        });
        
        // Also check for any meshes with eye/teeth/tongue in the name that we might have missed
        this.scene.meshes.forEach(mesh => {
            const name = mesh.name.toLowerCase();
            
            // Hide neck components specifically
            if (name.includes('neck') || name.includes('throat') || name.includes('neckline')) {
                console.log(`🚫 Hiding neck component: ${mesh.name}`);
                mesh.setEnabled(false);
                mesh.visibility = 0;
                return;
            }
            
            if ((name.includes('eye') || name.includes('teeth') || name.includes('tooth') || 
                 name.includes('tongue') || name.includes('dental')) && 
                 !mesh.name.includes('Socket')) {
                
                console.log(`🔍 Found additional facial component: ${mesh.name}`);
                mesh.setEnabled(true);
                mesh.visibility = 1;
                
                if (mesh.material) {
                    mesh.material.alpha = 1.0;
                    mesh.material.transparencyMode = null;
                }
                
                // Add to head group
                if (this.avatar.headGroup && mesh.parent !== this.avatar.headGroup) {
                    mesh.setParent(this.avatar.headGroup);
                }
            }
        });
    }

    findMorphTargets(meshes) {
        const morphTargets = {};
        
        meshes.forEach(mesh => {
            if (mesh.morphTargetManager) {
                for (let i = 0; i < mesh.morphTargetManager.numTargets; i++) {
                    const target = mesh.morphTargetManager.getTarget(i);
                    const name = target.name.toLowerCase();
                    morphTargets[name] = {
                        target: target,
                        mesh: mesh,
                        originalInfluence: target.influence
                    };
                }
            }
        });

        return morphTargets;
    }

    createFallbackAvatar() {
        // Create a simple sphere as fallback avatar
        const head = BABYLON.MeshBuilder.CreateSphere("head", {diameter: 1.5}, this.scene);
        const leftEye = BABYLON.MeshBuilder.CreateSphere("leftEye", {diameter: 0.15}, this.scene);
        const rightEye = BABYLON.MeshBuilder.CreateSphere("rightEye", {diameter: 0.15}, this.scene);
        const mouth = BABYLON.MeshBuilder.CreateBox("mouth", {width: 0.3, height: 0.1, depth: 0.1}, this.scene);

        // Position features
        leftEye.position = new BABYLON.Vector3(-0.3, 0.3, 0.6);
        rightEye.position = new BABYLON.Vector3(0.3, 0.3, 0.6);
        mouth.position = new BABYLON.Vector3(0, -0.2, 0.6);

        // Create materials
        const headMaterial = new BABYLON.StandardMaterial("headMat", this.scene);
        headMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.8, 0.7);
        head.material = headMaterial;

        const eyeMaterial = new BABYLON.StandardMaterial("eyeMat", this.scene);
        eyeMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        leftEye.material = eyeMaterial;
        rightEye.material = eyeMaterial;

        const mouthMaterial = new BABYLON.StandardMaterial("mouthMat", this.scene);
        mouthMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.4, 0.4);
        mouth.material = mouthMaterial;

        this.avatar = {
            meshes: [head, leftEye, rightEye, mouth],
            head: head,
            leftEye: leftEye,
            rightEye: rightEye,
            mouth: mouth,
            morphTargets: {},
            isFallback: true
        };

        console.log('Fallback avatar created');
    }

    async loadFaceAPIModels() {
        try {
            const MODEL_URL = './models';
            
            // Try to load models from different possible locations
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
                    console.log('Face API models loaded from:', path);
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
            console.error('Error loading face-api models:', error);
            throw new Error('Failed to load face detection models. Please check the models folder.');
        }
    }

    async startCamera() {
        try {
            if (!this.isInitialized) {
                throw new Error('Application not initialized');
            }

            this.updateStatus('📷 Starting camera...', 'loading');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            this.video.srcObject = stream;
            
            return new Promise((resolve) => {
                this.video.addEventListener('loadedmetadata', () => {
                    // Setup overlay canvas
                    this.overlayCanvas.width = this.video.videoWidth;
                    this.overlayCanvas.height = this.video.videoHeight;
                    
                    this.updateStatus('✅ Camera started! Face tracking active.', 'ready');
                    this.isTracking = true;
                    
                    // Start face tracking loop
                    this.trackFace();
                    
                    // Update UI
                    document.getElementById('startBtn').textContent = '📷 Stop Camera';
                    document.getElementById('startBtn').onclick = () => this.stopCamera();
                    document.getElementById('resetBtn').disabled = false;
                    document.getElementById('toggleDebugBtn').disabled = false;
                    
                    // Enable zoom controls
                    document.getElementById('zoomInBtn').disabled = false;
                    document.getElementById('zoomOutBtn').disabled = false;
                    
                    // Enable camera position controls
                    document.getElementById('cameraHorizontal').disabled = false;
                    document.getElementById('cameraVertical').disabled = false;
                    
                    // Initialize slider values to current camera position
                    this.updateSliderValues();
                    
                    resolve();
                });
            });

        } catch (error) {
            console.error('Camera error:', error);
            this.updateStatus('❌ Camera access failed: ' + error.message, 'error');
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
        
        // Update UI
        document.getElementById('startBtn').textContent = '🎬 Start Camera';
        document.getElementById('startBtn').onclick = () => this.startCamera();
        document.getElementById('resetBtn').disabled = true;
        document.getElementById('toggleDebugBtn').disabled = true;
        
        // Disable zoom controls
        document.getElementById('zoomInBtn').disabled = true;
        document.getElementById('zoomOutBtn').disabled = true;
        
        // Disable camera position controls
        document.getElementById('cameraHorizontal').disabled = true;
        document.getElementById('cameraVertical').disabled = true;
        
        // Clear overlay
        const ctx = this.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
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
                document.getElementById('faceInfo').textContent = 
                    `Face detected! Confidence: ${(detections.detection.score * 100).toFixed(1)}%`;

                // Log successful detection occasionally with more detail
                if (Math.random() < 0.01) { // 1% chance
                    console.log('🎭 Face tracking active - expressions:', 
                        Object.entries(this.expressions)
                            .filter(([_, value]) => value > 0.1)
                            .map(([name, value]) => `${name}:${(value*100).toFixed(1)}%`)
                            .join(', ')
                    );
                    
                    // Show available morph targets periodically
                    if (this.avatar && this.avatar.morphTargets) {
                        const eyeTargets = Object.keys(this.avatar.morphTargets).filter(key => 
                            key.includes('blink') || key.includes('eye')
                        );
                        console.log('👁️ Eye blendshapes found:', eyeTargets.length > 0 ? eyeTargets.join(', ') : 'NONE');
                    }
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
                document.getElementById('faceInfo').textContent = 'No face detected';
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
        this.avatar.leftEye.scaling.y = Math.max(0.1, 1 - blinkStrength * 2);
        this.avatar.rightEye.scaling.y = Math.max(0.1, 1 - blinkStrength * 2);

        // Animate mouth (smile/open)
        const smileStrength = expressions.happy || 0;
        const openStrength = expressions.surprised || 0;
        
        this.avatar.mouth.scaling.x = 1 + smileStrength * 0.5;
        this.avatar.mouth.scaling.y = 1 + openStrength * 2;

        // Head rotation based on face position
        if (this.landmarks) {
            const noseTip = this.landmarks.positions[30]; // Nose tip
            const faceCenter = this.landmarks.positions[33]; // Face center
            
            // Simple head rotation approximation
            const rotationY = (noseTip.x - faceCenter.x) * 0.01;
            this.avatar.head.rotation.y = -rotationY;
        }
    }

    animateBlendShapes(expressions) {
        if (!this.avatar.morphTargets) return;

        // Calculate precise blink values for each eye
        const leftBlinkStrength = this.calculateEyeBlinkStrength('left');
        const rightBlinkStrength = this.calculateEyeBlinkStrength('right');
        
        // Calculate mouth opening based on landmarks for more accuracy
        const mouthOpenValue = this.calculateMouthOpenness();
        
        // Enhanced mapping for Ready Player Me / ARKit compatible models
        const mappings = {
            // Individual eye blinking with enhanced detection methods
            'eyeBlinkLeft': Math.max(leftBlinkStrength, (expressions.neutral || 0) * 0.5),
            'eyeblinkleft': Math.max(leftBlinkStrength, (expressions.neutral || 0) * 0.5),
            'eyeBlink_L': Math.max(leftBlinkStrength, (expressions.neutral || 0) * 0.5),
            'EyeBlinkLeft': Math.max(leftBlinkStrength, (expressions.neutral || 0) * 0.5),
            
            'eyeBlinkRight': Math.max(rightBlinkStrength, (expressions.neutral || 0) * 0.5),
            'eyeblinkright': Math.max(rightBlinkStrength, (expressions.neutral || 0) * 0.5),
            'eyeBlink_R': Math.max(rightBlinkStrength, (expressions.neutral || 0) * 0.5),
            'EyeBlinkRight': Math.max(rightBlinkStrength, (expressions.neutral || 0) * 0.5),
            
            // Mouth expressions - combining landmark data with expression analysis WITH EXTREME AMPLIFICATION (2x more)
            'jawOpen': Math.max(mouthOpenValue * 5.0, expressions.surprised * 3.0 + (expressions.fearful || 0) * 2.0), // 2x amplification (2.5 -> 5.0)
            'jawopen': Math.max(mouthOpenValue * 5.0, expressions.surprised * 3.0),
            'JawOpen': Math.max(mouthOpenValue * 5.0, expressions.surprised * 3.0),
            'mouthOpen': Math.max(mouthOpenValue * 5.0, expressions.surprised * 2.4),
            
            // Enhanced smiling with asymmetric support AND EXTREME AMPLIFICATION (2x more)
            'mouthSmileLeft': (expressions.happy * 3.0) + this.calculateSmileAsymmetry('left'), // 2x amplification (1.5 -> 3.0)
            'mouthsmileleft': (expressions.happy * 3.0) + this.calculateSmileAsymmetry('left'),
            'mouthSmile_L': (expressions.happy * 3.0) + this.calculateSmileAsymmetry('left'),
            'MouthSmileLeft': (expressions.happy * 3.0) + this.calculateSmileAsymmetry('left'),
            
            'mouthSmileRight': (expressions.happy * 3.0) + this.calculateSmileAsymmetry('right'),
            'mouthsmileright': (expressions.happy * 3.0) + this.calculateSmileAsymmetry('right'),
            'mouthSmile_R': (expressions.happy * 3.0) + this.calculateSmileAsymmetry('right'),
            'MouthSmileRight': (expressions.happy * 3.0) + this.calculateSmileAsymmetry('right'),
            
            // Frowning with better emotion mapping
            'mouthFrownLeft': expressions.sad * 0.8 + (expressions.angry || 0) * 0.6 + (expressions.disgusted || 0) * 0.4,
            'mouthfrownleft': expressions.sad * 0.8 + (expressions.angry || 0) * 0.6,
            'mouthFrown_L': expressions.sad * 0.8 + (expressions.angry || 0) * 0.6,
            'MouthFrownLeft': expressions.sad * 0.8 + (expressions.angry || 0) * 0.6,
            
            'mouthFrownRight': expressions.sad * 0.8 + (expressions.angry || 0) * 0.6 + (expressions.disgusted || 0) * 0.4,
            'mouthfrownright': expressions.sad * 0.8 + (expressions.angry || 0) * 0.6,
            'mouthFrown_R': expressions.sad * 0.8 + (expressions.angry || 0) * 0.6,
            'MouthFrownRight': expressions.sad * 0.8 + (expressions.angry || 0) * 0.6,
            
            // Enhanced eyebrow movement with landmark-based calculation
            'browInnerUp': this.calculateBrowMovement('inner') + expressions.surprised * 0.6 + (expressions.fearful || 0) * 0.5,
            'browinnerup': this.calculateBrowMovement('inner') + expressions.surprised * 0.6,
            'BrowInnerUp': this.calculateBrowMovement('inner') + expressions.surprised * 0.6,
            
            'browOuterUpLeft': this.calculateBrowMovement('outerLeft') + expressions.surprised * 0.5,
            'browouterupleft': this.calculateBrowMovement('outerLeft') + expressions.surprised * 0.5,
            'browOuterUp_L': this.calculateBrowMovement('outerLeft') + expressions.surprised * 0.5,
            'BrowOuterUpLeft': this.calculateBrowMovement('outerLeft') + expressions.surprised * 0.5,
            
            'browOuterUpRight': this.calculateBrowMovement('outerRight') + expressions.surprised * 0.5,
            'browouterupright': this.calculateBrowMovement('outerRight') + expressions.surprised * 0.5,
            'browOuterUp_R': this.calculateBrowMovement('outerRight') + expressions.surprised * 0.5,
            'BrowOuterUpRight': this.calculateBrowMovement('outerRight') + expressions.surprised * 0.5,
            
            // Cheek and nose expressions
            'cheekPuff': (expressions.surprised || 0) * 0.4 + this.calculateCheekPuff(),
            'cheekSquintLeft': (expressions.happy || 0) * 0.3,
            'cheekSquintRight': (expressions.happy || 0) * 0.3,
            
            'noseSneerLeft': (expressions.disgusted || 0) * 0.7 + (expressions.angry || 0) * 0.3,
            'noseSneerRight': (expressions.disgusted || 0) * 0.7 + (expressions.angry || 0) * 0.3,
            'noseSneer_L': (expressions.disgusted || 0) * 0.7,
            'noseSneer_R': (expressions.disgusted || 0) * 0.7,
            
            // Advanced mouth shapes for better lip sync
            'mouthPucker': (expressions.surprised || 0) * 0.5 + this.calculateMouthPucker(),
            'mouthPress': (expressions.angry || 0) * 0.6 + this.calculateMouthPress(),
            'mouthRollLower': this.calculateMouthRoll('lower'),
            'mouthRollUpper': this.calculateMouthRoll('upper'),
            'mouthShrugLower': (expressions.sad || 0) * 0.4,
            'mouthShrugUpper': (expressions.sad || 0) * 0.3,
            
            // Lip corner movements
            'mouthLeft': this.calculateMouthCornerMovement('left'),
            'mouthRight': this.calculateMouthCornerMovement('right'),
            
            // Enhanced Ready Player Me specific blendshapes
            'viseme_aa': this.calculateViseme('aa', mouthOpenValue, expressions),
            'viseme_oh': this.calculateViseme('oh', mouthOpenValue, expressions),
            'viseme_ee': this.calculateViseme('ee', mouthOpenValue, expressions),
            'viseme_ou': this.calculateViseme('ou', mouthOpenValue, expressions),
            'viseme_ih': this.calculateViseme('ih', mouthOpenValue, expressions),
            'viseme_PP': this.calculateViseme('pp', mouthOpenValue, expressions),
            
            // TONGUE DETECTION - Enhanced tongue morph targets with face-api.js detection
            'tongueOut': this.calculateTongueOut(expressions, mouthOpenValue),
            'tongueout': this.calculateTongueOut(expressions, mouthOpenValue),
            'TongueOut': this.calculateTongueOut(expressions, mouthOpenValue),
            'tongue_out': this.calculateTongueOut(expressions, mouthOpenValue),
            'mouthRollLower': this.calculateTongueOut(expressions, mouthOpenValue) * 0.3, // Tongue can affect lower lip
            'mouthRollUpper': this.calculateTongueOut(expressions, mouthOpenValue) * 0.2,
            'tongueUp': this.calculateTongueMovement('up', expressions, mouthOpenValue),
            'tongueDown': this.calculateTongueMovement('down', expressions, mouthOpenValue),
            'tongueLeft': this.calculateTongueMovement('left', expressions, mouthOpenValue),
            'tongueRight': this.calculateTongueMovement('right', expressions, mouthOpenValue)
        };

        // Apply blend shape influences with smoothing
        let appliedCount = 0;
        let debugInfo = {};
        
        for (const [shapeName, influence] of Object.entries(mappings)) {
            const smoothedInfluence = this.smoothBlendshape(shapeName, influence);
            
            // Store debug info for important blendshapes
            if (shapeName.includes('eyeBlink') || shapeName.includes('mouthSmile') || shapeName.includes('jawOpen')) {
                debugInfo[shapeName] = {
                    raw: influence.toFixed(3),
                    smoothed: smoothedInfluence.toFixed(3),
                    applied: false
                };
            }
            
            const shapeKey = shapeName.toLowerCase();
            
            // CRITICAL FIX: Apply to ALL meshes that have this morph target, not just our stored ones
            if (this.scene && this.scene.meshes) {
                this.scene.meshes.forEach(mesh => {
                    if (mesh.morphTargetManager) {
                        // Check if this mesh has the target we're looking for
                        for (let i = 0; i < mesh.morphTargetManager.numTargets; i++) {
                            const target = mesh.morphTargetManager.getTarget(i);
                            if (target.name.toLowerCase() === shapeKey || target.name === shapeName) {
                                const clampedInfluence = Math.max(0, Math.min(1, smoothedInfluence));
                                target.influence = clampedInfluence;
                                appliedCount++;
                                
                                // Enhanced logging for mouth movements
                                if (shapeName.includes('mouth') || shapeName.includes('jaw')) {
                                    console.log(`✅ Applied ${(clampedInfluence*100).toFixed(1)}% ${shapeName} to ${mesh.name}`);
                                }
                                
                                if (debugInfo[shapeName]) {
                                    debugInfo[shapeName].applied = true;
                                }
                            }
                        }
                    }
                });
            }
            
            // Also apply to our stored morph targets (backup method)
            if (this.avatar.morphTargets[shapeKey]) {
                this.avatar.morphTargets[shapeKey].target.influence = 
                    Math.max(0, Math.min(1, smoothedInfluence));
                appliedCount++;
                if (debugInfo[shapeName]) debugInfo[shapeName].applied = true;
            }
            // Also try exact case match
            if (this.avatar.morphTargets[shapeName]) {
                this.avatar.morphTargets[shapeName].target.influence = 
                    Math.max(0, Math.min(1, smoothedInfluence));
                appliedCount++;
                if (debugInfo[shapeName]) debugInfo[shapeName].applied = true;
            }
        }

        // Apply head rotation based on face orientation
        this.animateHeadRotation();
        
        // Apply eye gaze direction
        this.animateEyeGaze();

        // Debug info (only log occasionally to avoid spam)
        if (appliedCount > 0 && Math.random() < 0.01) { // 1% chance to log
            console.log(`🎭 Applied ${appliedCount} blendshape influences`);
            console.log('📊 Key blendshapes:', debugInfo);
            console.log('📋 Available morph targets:', Object.keys(this.avatar.morphTargets));
        }
        
        // Focus on MOUTH TRACKING since it works
        const mouthOpen = mouthOpenValue;
        const smileStrength = expressions.happy || 0;
        
        // Enhanced mouth logging (every 1 second)
        if (!this.lastMouthLogTime || Date.now() - this.lastMouthLogTime > 1000) {
            console.log('👄 === MOUTH TRACKING DEBUG ===');
            console.log(`👄 MOUTH OPEN: ${(mouthOpen * 100).toFixed(1)}%`);
            console.log(`😊 SMILE: ${(smileStrength * 100).toFixed(1)}%`);
            console.log('👄 MOUTH-related targets:', Object.keys(this.avatar.morphTargets).filter(key => 
                key.toLowerCase().includes('mouth') || 
                key.toLowerCase().includes('jaw') ||
                key.toLowerCase().includes('smile') ||
                key.toLowerCase().includes('frown')
            ));
            
            // TONGUE AVAILABILITY CHECK
            const tongueTargets = Object.keys(this.avatar.morphTargets).filter(key => 
                key.toLowerCase().includes('tongue') ||
                key.toLowerCase().includes('lick') ||
                key.toLowerCase().includes('roll')
            );
            console.log('👅 TONGUE-related targets:', tongueTargets.length > 0 ? tongueTargets : 'NONE FOUND');
            
            // Test tongue detection
            const tongueOut = this.calculateTongueOut(expressions, mouthOpen);
            if (tongueOut > 0.05) {
                console.log(`👅 TONGUE DETECTION: ${(tongueOut * 100).toFixed(1)}% out`);
            }
            this.lastMouthLogTime = Date.now();
        }
        
        // Force visual test for mouth movements INCLUDING TONGUE
        if (mouthOpen > 0.2 || smileStrength > 0.2) {
            console.log(`👄 MOUTH MOVEMENT - Open: ${(mouthOpen * 100).toFixed(1)}%, Smile: ${(smileStrength * 100).toFixed(1)}%`);
            this.forceMouthTest(mouthOpen, smileStrength);
            
            // Test tongue detection and availability
            const tongueOut = this.calculateTongueOut(expressions, mouthOpen);
            if (tongueOut > 0.05) {
                console.log(`👅 TONGUE DETECTED: ${(tongueOut * 100).toFixed(1)}% - Testing tongue morph targets...`);
                this.forceTongueTest(tongueOut);
            }
        }
        
        // COMPREHENSIVE AVATAR CAPABILITY CHECK (every 3 seconds)
        if (!this.lastCapabilityCheck || Date.now() - this.lastCapabilityCheck > 3000) {
            console.log('🔍 === AVATAR CAPABILITY CHECK ===');
            console.log(`🤖 Avatar type: ${this.avatar.isFallback ? 'FALLBACK (geometric shapes)' : 'REAL AVATAR'}`);
            
            if (this.avatar.morphTargets) {
                const allTargets = Object.keys(this.avatar.morphTargets);
                console.log(`🎭 TOTAL morph targets: ${allTargets.length}`);
                console.log('📋 ALL targets:', allTargets);
                
                // Check specific mouth capabilities
                const mouthTargets = allTargets.filter(key => 
                    key.toLowerCase().includes('mouth') || 
                    key.toLowerCase().includes('jaw') ||
                    key.toLowerCase().includes('smile') ||
                    key.toLowerCase().includes('open')
                );
                
                if (mouthTargets.length > 0) {
                    console.log(`👄 MOUTH targets found (${mouthTargets.length}):`, mouthTargets);
                    
                    // Test if morph targets actually work
                    console.log('🧪 Testing first mouth target...');
                    const testTarget = mouthTargets[0];
                    if (this.avatar.morphTargets[testTarget]) {
                        const originalValue = this.avatar.morphTargets[testTarget].target.influence;
                        this.avatar.morphTargets[testTarget].target.influence = 0.8;
                        console.log(`✅ Applied 80% to ${testTarget}`);
                        
                        // Reset after 2 seconds
                        setTimeout(() => {
                            this.avatar.morphTargets[testTarget].target.influence = originalValue;
                            console.log(`🔄 Reset ${testTarget} to ${originalValue}`);
                        }, 2000);
                    }
                } else {
                    console.log('❌ NO MOUTH morph targets found!');
                    console.log('🔍 Looking for ANY targets with relevant keywords...');
                    
                    const relevantTargets = allTargets.filter(key => 
                        key.toLowerCase().includes('blend') ||
                        key.toLowerCase().includes('shape') ||
                        key.toLowerCase().includes('face') ||
                        key.toLowerCase().includes('expression')
                    );
                    console.log('🎯 Potentially relevant targets:', relevantTargets);
                }
            } else {
                console.log('❌ NO MORPH TARGETS AT ALL - Avatar may not support facial animation');
            }
            
            this.lastCapabilityCheck = Date.now();
        }
        
        // Always log blinking when it's detected - more comprehensive logging
        const leftBlink = leftBlinkStrength;
        const rightBlink = rightBlinkStrength;
        
        // Continuous logging for debugging (every 2 seconds)
        if (!this.lastBlinkLogTime || Date.now() - this.lastBlinkLogTime > 2000) {
            console.log('🔍 === COMPREHENSIVE BLINK DEBUG ===');
            console.log(`👁️ BLINK STATUS - Left: ${(leftBlink * 100).toFixed(1)}%, Right: ${(rightBlink * 100).toFixed(1)}%`);
            console.log('� ALL available morph targets:', Object.keys(this.avatar.morphTargets));
            console.log('👁️ EYE-related targets:', Object.keys(this.avatar.morphTargets).filter(key => 
                key.toLowerCase().includes('blink') || 
                key.toLowerCase().includes('eye') ||
                key.toLowerCase().includes('lid')
            ));
            
            // Check if we have landmarks
            if (this.landmarks) {
                const leftEyeLandmarks = this.landmarks.getLeftEye();
                const rightEyeLandmarks = this.landmarks.getRightEye();
                console.log(`👁️ LANDMARKS - Left eye points: ${leftEyeLandmarks?.length || 0}, Right eye points: ${rightEyeLandmarks?.length || 0}`);
            } else {
                console.log('❌ NO LANDMARKS AVAILABLE');
            }
            
            // Check if avatar has morph targets at all
            if (!this.avatar.morphTargets || Object.keys(this.avatar.morphTargets).length === 0) {
                console.log('❌ NO MORPH TARGETS FOUND - Using fallback avatar?', this.avatar.isFallback);
            }
            
            this.lastBlinkLogTime = Date.now();
        }
        
        // Log when significant blinking is detected + FORCE VISUAL TEST
        if (leftBlink > 0.3 || rightBlink > 0.3) {
            console.log(`👁️ STRONG BLINK DETECTED - Left: ${(leftBlink * 100).toFixed(1)}%, Right: ${(rightBlink * 100).toFixed(1)}%`);
            
            // FORCE VISUAL TEST - manually apply blinking to see if the avatar CAN blink
            this.forceBlinkTest(leftBlink, rightBlink);
        }
        
        // Test if ANY blink detection is happening
        if (leftBlink > 0.1 || rightBlink > 0.1) {
            console.log(`👁️ WEAK BLINK - Left: ${(leftBlink * 100).toFixed(1)}%, Right: ${(rightBlink * 100).toFixed(1)}%`);
        }
    }

    // Force blink test to verify avatar can visually blink
    forceBlinkTest(leftStrength, rightStrength) {
        if (!this.avatar) return;
        
        console.log('🧪 FORCE BLINK TEST ACTIVATED');
        
        if (this.avatar.isFallback) {
            // Test fallback avatar
            console.log('🤖 Testing fallback avatar eyes...');
            this.avatar.leftEye.scaling.y = Math.max(0.1, 1 - leftStrength);
            this.avatar.rightEye.scaling.y = Math.max(0.1, 1 - rightStrength);
        } else {
            // Test morph targets
            const eyeTargets = Object.keys(this.avatar.morphTargets).filter(key => 
                key.toLowerCase().includes('blink') || 
                key.toLowerCase().includes('eye')
            );
            
            if (eyeTargets.length > 0) {
                console.log('🎭 Testing morph targets:', eyeTargets);
                eyeTargets.forEach(target => {
                    const strength = target.toLowerCase().includes('left') ? leftStrength : rightStrength;
                    this.avatar.morphTargets[target].target.influence = strength;
                    console.log(`✅ Applied ${(strength*100).toFixed(1)}% to ${target}`);
                });
            } else {
                console.log('❌ NO EYE MORPH TARGETS TO TEST');
            }
        }
    }

    // Comprehensive morph target analysis
    analyzeMorphTargets() {
        console.log('🔍 === COMPREHENSIVE MORPH TARGET ANALYSIS ===');
        
        if (!this.avatar.morphTargets || Object.keys(this.avatar.morphTargets).length === 0) {
            console.log('❌ NO MORPH TARGETS FOUND');
            
            // Check if avatar has any morph target managers at all
            console.log('🔍 Checking avatar meshes for morph target managers...');
            if (this.avatar.allHeadParts) {
                this.avatar.allHeadParts.forEach(mesh => {
                    if (mesh.morphTargetManager) {
                        console.log(`✅ Found MorphTargetManager on ${mesh.name}:`, mesh.morphTargetManager);
                        console.log(`   - Targets: ${mesh.morphTargetManager.numTargets}`);
                        for (let i = 0; i < mesh.morphTargetManager.numTargets; i++) {
                            const target = mesh.morphTargetManager.getTarget(i);
                            console.log(`   - Target ${i}: ${target.name} (influence: ${target.influence})`);
                        }
                    } else {
                        console.log(`❌ No MorphTargetManager on ${mesh.name}`);
                    }
                });
            }
            return;
        }
        
        const allTargets = Object.keys(this.avatar.morphTargets);
        console.log(`🎭 TOTAL MORPH TARGETS: ${allTargets.length}`);
        
        // Detailed analysis of each morph target
        console.log('🔬 DETAILED MORPH TARGET ANALYSIS:');
        allTargets.forEach(targetName => {
            const targetData = this.avatar.morphTargets[targetName];
            console.log(`📋 ${targetName}:`);
            console.log(`   - Target object:`, targetData.target);
            console.log(`   - Current influence: ${targetData.target.influence}`);
            console.log(`   - Has positions: ${targetData.target.hasPositions}`);
            console.log(`   - Has normals: ${targetData.target.hasNormals}`);
            console.log(`   - Has tangents: ${targetData.target.hasTangents}`);
            console.log(`   - Has UVs: ${targetData.target.hasUVs}`);
            console.log(`   - Mesh:`, targetData.mesh?.name || 'Unknown');
            
            // Try to get the mesh's morph target manager
            if (targetData.mesh && targetData.mesh.morphTargetManager) {
                const manager = targetData.mesh.morphTargetManager;
                console.log(`   - Manager enabled: ${manager.areUpdatesFrozen === false}`);
                console.log(`   - Manager influences auto: ${manager.enableNormalMorphing}`);
                console.log(`   - Manager targets: ${manager.numTargets}`);
            }
        });
        
        // Categorize all targets
        const categories = {
            eye: allTargets.filter(key => 
                key.toLowerCase().includes('eye') || 
                key.toLowerCase().includes('blink') || 
                key.toLowerCase().includes('lid')),
            mouth: allTargets.filter(key => 
                key.toLowerCase().includes('mouth') || 
                key.toLowerCase().includes('jaw') || 
                key.toLowerCase().includes('smile') || 
                key.toLowerCase().includes('frown') || 
                key.toLowerCase().includes('open')),
            brow: allTargets.filter(key => 
                key.toLowerCase().includes('brow') || 
                key.toLowerCase().includes('eyebrow')),
            cheek: allTargets.filter(key => 
                key.toLowerCase().includes('cheek')),
            nose: allTargets.filter(key => 
                key.toLowerCase().includes('nose')),
            other: allTargets.filter(key => 
                !key.toLowerCase().includes('eye') && 
                !key.toLowerCase().includes('blink') && 
                !key.toLowerCase().includes('lid') && 
                !key.toLowerCase().includes('mouth') && 
                !key.toLowerCase().includes('jaw') && 
                !key.toLowerCase().includes('smile') && 
                !key.toLowerCase().includes('frown') && 
                !key.toLowerCase().includes('open') && 
                !key.toLowerCase().includes('brow') && 
                !key.toLowerCase().includes('cheek') && 
                !key.toLowerCase().includes('nose'))
        };
        
        // Log each category
        Object.entries(categories).forEach(([category, targets]) => {
            if (targets.length > 0) {
                console.log(`${category.toUpperCase()} (${targets.length}):`, targets);
            }
        });
        
        // Enhanced testing with dramatic values and visual feedback
        console.log('🧪 Testing morph target functionality with DRAMATIC values...');
        
        // Test each available target with extreme values
        allTargets.forEach((targetName, index) => {
            setTimeout(() => {
                const targetData = this.avatar.morphTargets[targetName];
                if (targetData && targetData.target) {
                    const originalValue = targetData.target.influence;
                    
                    // Apply extreme value for maximum visibility
                    targetData.target.influence = 1.0; // Full strength
                    console.log(`🎭 EXTREME TEST: Set '${targetName}' to 100% (was ${(originalValue*100).toFixed(1)}%)`);
                    
                    // Also try to force update the morph target manager
                    if (targetData.mesh && targetData.mesh.morphTargetManager) {
                        targetData.mesh.morphTargetManager.areUpdatesFrozen = false;
                        console.log(`🔄 Unfroze morph target manager for ${targetData.mesh.name}`);
                    }
                    
                    // Reset after 2 seconds
                    setTimeout(() => {
                        targetData.target.influence = originalValue;
                        console.log(`🔄 Reset '${targetName}' to ${(originalValue*100).toFixed(1)}%`);
                    }, 2000);
                } else {
                    console.log(`❌ Cannot test '${targetName}' - invalid target data`);
                }
            }, index * 2500); // 2.5 second intervals
        });
        
        return categories;
    }

    // Force mouth test to verify avatar can visually show mouth movements
    forceMouthTest(openStrength, smileStrength) {
        if (!this.avatar) return;
        
        console.log('🧪 FORCE MOUTH TEST ACTIVATED');
        console.log(`📊 Testing with: Open=${(openStrength*100).toFixed(1)}%, Smile=${(smileStrength*100).toFixed(1)}%`);
        
        if (this.avatar.isFallback) {
            // Test fallback avatar mouth
            console.log('🤖 Testing fallback avatar mouth...');
            if (this.avatar.mouth) {
                // Apply more dramatic scaling for visibility
                this.avatar.mouth.scaling.x = 1 + smileStrength * 1.5; // More dramatic smile
                this.avatar.mouth.scaling.y = 1 + openStrength * 2.5;  // More dramatic opening
                this.avatar.mouth.scaling.z = 1 + openStrength * 0.5;  // Depth change
                
                // Also change color for visual feedback
                if (this.avatar.mouth.material) {
                    const intensity = Math.max(openStrength, smileStrength);
                    this.avatar.mouth.material.diffuseColor = new BABYLON.Color3(
                        0.8 + intensity * 0.2, 
                        0.4 - intensity * 0.2, 
                        0.4 - intensity * 0.2
                    );
                }
                console.log(`✅ Applied scaling: x=${this.avatar.mouth.scaling.x.toFixed(2)}, y=${this.avatar.mouth.scaling.y.toFixed(2)}`);
            } else {
                console.log('❌ No mouth object found in fallback avatar');
            }
        } else {
            // Test morph targets for mouth
            console.log('🎭 Testing real avatar morph targets...');
            
            if (!this.avatar.morphTargets || Object.keys(this.avatar.morphTargets).length === 0) {
                console.log('❌ NO MORPH TARGETS AVAILABLE - Creating fallback visual test...');
                
                // Try to find and manually scale mouth-related meshes
                if (this.avatar.allHeadParts) {
                    const mouthMeshes = this.avatar.allHeadParts.filter(mesh => 
                        mesh.name.toLowerCase().includes('mouth') ||
                        mesh.name.toLowerCase().includes('lip') ||
                        mesh.name.toLowerCase().includes('teeth')
                    );
                    
                    if (mouthMeshes.length > 0) {
                        console.log(`🦷 Found mouth meshes: ${mouthMeshes.map(m => m.name).join(', ')}`);
                        mouthMeshes.forEach(mesh => {
                            mesh.scaling.y = 1 + openStrength * 0.5;
                            mesh.scaling.x = 1 + smileStrength * 0.3;
                        });
                    } else {
                        console.log('❌ No mouth meshes found either');
                    }
                }
                return;
            }
            
            const allTargets = Object.keys(this.avatar.morphTargets);
            console.log(`🎭 Available morph targets (${allTargets.length}):`, allTargets);
            
            // Test mouth-specific targets
            const mouthTargets = allTargets.filter(key => 
                key.toLowerCase().includes('mouth') || 
                key.toLowerCase().includes('jaw') ||
                key.toLowerCase().includes('smile') ||
                key.toLowerCase().includes('open') ||
                key.toLowerCase().includes('lip')
            );
            
            if (mouthTargets.length > 0) {
                console.log(`👄 Testing mouth morph targets (${mouthTargets.length}):`, mouthTargets);
                
                mouthTargets.forEach(target => {
                    let strength = 0;
                    if (target.toLowerCase().includes('open') || target.toLowerCase().includes('jaw')) {
                        strength = openStrength;
                        console.log(`🗣️ Applying ${(strength*100).toFixed(1)}% to OPEN target: ${target}`);
                    } else if (target.toLowerCase().includes('smile')) {
                        strength = smileStrength;
                        console.log(`😊 Applying ${(strength*100).toFixed(1)}% to SMILE target: ${target}`);
                    } else {
                        strength = Math.max(openStrength, smileStrength) * 0.5;
                        console.log(`👄 Applying ${(strength*100).toFixed(1)}% to GENERAL target: ${target}`);
                    }
                    
                    if (strength > 0 && this.avatar.morphTargets[target]) {
                        const oldValue = this.avatar.morphTargets[target].target.influence;
                        this.avatar.morphTargets[target].target.influence = strength;
                        console.log(`✅ Applied ${(strength*100).toFixed(1)}% to ${target} (was ${(oldValue*100).toFixed(1)}%)`);
                    }
                });
            } else {
                console.log('❌ NO MOUTH-SPECIFIC MORPH TARGETS FOUND');
                console.log('🔍 Trying ANY targets that might affect mouth...');
                
                // Try broader search
                const broadTargets = allTargets.filter(key => 
                    key.toLowerCase().includes('face') ||
                    key.toLowerCase().includes('expression') ||
                    key.toLowerCase().includes('blend') ||
                    key.toLowerCase().includes('shape')
                );
                
                if (broadTargets.length > 0) {
                    console.log(`🎯 Found broad targets: ${broadTargets.slice(0, 5).join(', ')}${broadTargets.length > 5 ? '...' : ''}`);
                    // Test first few
                    broadTargets.slice(0, 3).forEach(target => {
                        if (this.avatar.morphTargets[target]) {
                            this.avatar.morphTargets[target].target.influence = Math.max(openStrength, smileStrength) * 0.3;
                            console.log(`🧪 Testing ${target} with ${(Math.max(openStrength, smileStrength) * 30).toFixed(1)}%`);
                        }
                    });
                } else {
                    console.log('❌ NO SUITABLE MORPH TARGETS FOUND AT ALL');
                }
            }
        }
    }

    // Force tongue test to verify avatar can visually show tongue movements
    forceTongueTest(tongueStrength) {
        if (!this.avatar) return;
        
        console.log('🧪 FORCE TONGUE TEST ACTIVATED');
        console.log(`📊 Testing with tongue strength: ${(tongueStrength*100).toFixed(1)}%`);
        
        if (!this.avatar.morphTargets || Object.keys(this.avatar.morphTargets).length === 0) {
            console.log('❌ NO MORPH TARGETS AVAILABLE FOR TONGUE TEST');
            return;
        }
        
        const allTargets = Object.keys(this.avatar.morphTargets);
        console.log(`🎭 Available morph targets (${allTargets.length}):`, allTargets);
        
        // Test tongue-specific targets
        const tongueTargets = allTargets.filter(key => 
            key.toLowerCase().includes('tongue') ||
            key.toLowerCase().includes('lick') ||
            key.toLowerCase().includes('roll') && key.toLowerCase().includes('mouth')
        );
        
        if (tongueTargets.length > 0) {
            console.log(`👅 Testing tongue morph targets (${tongueTargets.length}):`, tongueTargets);
            
            tongueTargets.forEach(target => {
                if (this.avatar.morphTargets[target]) {
                    const testStrength = Math.min(1, tongueStrength * 2); // Amplify for visibility
                    this.avatar.morphTargets[target].target.influence = testStrength;
                    console.log(`✅ Applied ${target}: ${(testStrength*100).toFixed(1)}%`);
                    
                    // Force update morph target manager
                    const targetData = this.avatar.morphTargets[target];
                    if (targetData.mesh && targetData.mesh.morphTargetManager) {
                        const manager = targetData.mesh.morphTargetManager;
                        if (manager.areUpdatesFrozen) {
                            manager.areUpdatesFrozen = false;
                            console.log(`🔄 Unfroze morph target manager for ${targetData.mesh.name}`);
                        }
                    }
                } else {
                    console.log(`❌ Cannot apply ${target} - invalid target data`);
                }
            });
        } else {
            console.log('❌ NO TONGUE-SPECIFIC MORPH TARGETS FOUND');
            console.log('🔍 Checking for related mouth morph targets that might show tongue...');
            
            // Check for mouth roll targets that might show tongue
            const mouthRollTargets = allTargets.filter(key => 
                key.toLowerCase().includes('mouthroll') ||
                key.toLowerCase().includes('mouth_roll') ||
                key.toLowerCase().includes('liproll')
            );
            
            if (mouthRollTargets.length > 0) {
                console.log(`🔄 Testing mouth roll targets (might show tongue): ${mouthRollTargets.join(', ')}`);
                mouthRollTargets.forEach(target => {
                    if (this.avatar.morphTargets[target]) {
                        this.avatar.morphTargets[target].target.influence = tongueStrength;
                        console.log(`✅ Applied ${target} for tongue approximation: ${(tongueStrength*100).toFixed(1)}%`);
                    }
                });
            } else {
                console.log('❌ NO SUITABLE TARGETS FOUND FOR TONGUE SIMULATION');
            }
        }
        
        // Log what we found about tongue capabilities
        console.log('👅 === TONGUE CAPABILITY SUMMARY ===');
        console.log(`🎭 Total morph targets: ${allTargets.length}`);
        console.log(`👅 Tongue-specific targets: ${tongueTargets.length}`);
        console.log(`🔄 Mouth roll targets: ${allTargets.filter(k => k.toLowerCase().includes('roll')).length}`);
        console.log(`📊 Current tongue detection: ${(tongueStrength*100).toFixed(1)}%`);
        
        if (tongueTargets.length === 0) {
            console.log('💡 RECOMMENDATION: This avatar may not support tongue animations');
            console.log('💡 Consider using mouth roll or lip targets as approximation');
        }
    }
    calculateEyeBlinkStrength(eye) {
        if (!this.landmarks) return 0;
        
        try {
            const eyeLandmarks = eye === 'left' ? this.landmarks.getLeftEye() : this.landmarks.getRightEye();
            
            if (!eyeLandmarks || eyeLandmarks.length < 6) {
                console.warn(`⚠️ Insufficient ${eye} eye landmarks:`, eyeLandmarks?.length || 0);
                return 0;
            }
            
            // Enhanced Eye Aspect Ratio calculation with multiple methods
            const ear1 = this.getEyeAspectRatio(eyeLandmarks);
            
            // Alternative calculation using different landmark points for robustness
            const topEyelid = eyeLandmarks[1];
            const bottomEyelid = eyeLandmarks[5];
            const leftCorner = eyeLandmarks[0];
            const rightCorner = eyeLandmarks[3];
            
            const eyeHeight = this.distance(topEyelid, bottomEyelid);
            const eyeWidth = this.distance(leftCorner, rightCorner);
            const ear2 = eyeHeight / eyeWidth;
            
            // Use the average for better accuracy
            const avgEAR = (ear1 + ear2) / 2;
            
            // More sensitive thresholds for better detection
            const openThreshold = 0.3;   // Eyes fully open - increased sensitivity
            const closedThreshold = 0.12; // Eyes closed - more sensitive
            
            let blinkStrength;
            if (avgEAR <= closedThreshold) {
                blinkStrength = 1.0; // Fully closed
            } else if (avgEAR >= openThreshold) {
                blinkStrength = 0.0; // Fully open
            } else {
                // Smooth interpolation between closed and open
                blinkStrength = (openThreshold - avgEAR) / (openThreshold - closedThreshold);
            }
            
            // Apply amplification for better responsiveness
            const amplifiedStrength = Math.min(1, blinkStrength * 1.5);
            
            // Enhanced logging for debugging
            if (amplifiedStrength > 0.1) {
                console.log(`👁️ ${eye.toUpperCase()} EYE: EAR=${avgEAR.toFixed(3)}, blink=${(amplifiedStrength*100).toFixed(1)}%`);
            }
            
            return amplifiedStrength;
            
        } catch (error) {
            console.error(`❌ Blink calculation error for ${eye} eye:`, error);
            return 0;
        }
    }

    calculateMouthOpenness() {
        if (!this.landmarks) return 0;
        
        try {
            const mouth = this.landmarks.getMouth();
            
            // Validate mouth landmarks array
            if (!mouth || mouth.length < 20) {
                console.warn('⚠️ Insufficient mouth landmarks:', mouth?.length || 0);
                return this.expressions?.surprised * 0.8 || 0;
            }
            
            // Get multiple mouth measurement points for better accuracy
            const topLip = mouth[13]; // Upper lip center
            const bottomLip = mouth[19]; // Lower lip center
            const leftCorner = mouth[0]; // Left corner
            const rightCorner = mouth[6]; // Right corner
            
            // Additional points for enhanced precision
            const upperMid = mouth[14]; // Upper lip point
            const lowerMid = mouth[18]; // Lower lip point
            const upperLeft = mouth[12]; // Upper lip left
            const upperRight = mouth[16]; // Upper lip right
            const lowerLeft = mouth[20]; // Lower lip left
            const lowerRight = mouth[17]; // Lower lip right
            
            // Validate all required points exist and are valid
            const requiredPoints = [topLip, bottomLip, leftCorner, rightCorner, upperMid, lowerMid, upperLeft, upperRight, lowerLeft, lowerRight];
            const invalidPoints = requiredPoints.filter(point => !point || typeof point.x !== 'number' || typeof point.y !== 'number' || isNaN(point.x) || isNaN(point.y));
            
            if (invalidPoints.length > 0) {
                // Only warn occasionally to prevent spam
                if (Math.random() < 0.01) {
                    console.warn(`⚠️ Invalid mouth landmarks: ${invalidPoints.length}/${requiredPoints.length} points invalid`);
                }
                return this.expressions?.surprised * 0.8 || 0;
            }
            
            // Calculate multiple height measurements for robustness
            const mouthHeight1 = this.distance(topLip, bottomLip);
            const mouthHeight2 = this.distance(upperMid, lowerMid);
            const mouthHeight3 = this.distance(upperLeft, lowerLeft);
            const mouthHeight4 = this.distance(upperRight, lowerRight);
            
            // Average all height measurements
            const avgHeight = (mouthHeight1 + mouthHeight2 + mouthHeight3 + mouthHeight4) / 4;
            
            const mouthWidth = this.distance(leftCorner, rightCorner);
            
            // Validate calculations
            if (mouthWidth === 0 || isNaN(avgHeight) || isNaN(mouthWidth)) {
                console.warn('⚠️ Invalid mouth measurements:', { avgHeight, mouthWidth });
                return this.expressions?.surprised * 0.8 || 0;
            }
            
            // Enhanced normalization with more sensitive baseline
            const baselineRatio = 0.06; // Even more sensitive closed mouth ratio (reduced from 0.08)
            const heightToWidthRatio = avgHeight / mouthWidth;
            
            // Enhanced openness calculation with EXTREME amplification (2x more dramatic)
            let openness = Math.max(0, (heightToWidthRatio - baselineRatio) * 30); // EXTREME increase from 15 to 30 (2x more)
            
            // Apply smoothing to prevent jitter
            openness = Math.min(1, openness);
            
            // Add expression-based enhancement for better detection (2x boost)
            const expressionBoost = (this.expressions.surprised || 0) * 1.2 + // 2x increase from 0.6
                                  (this.expressions.fearful || 0) * 1.0 +   // 2x increase from 0.5
                                  (this.expressions.happy || 0) * 0.6;      // 2x increase from 0.3
            
            const finalOpenness = Math.min(1, openness + expressionBoost);
            
            // Enhanced logging for mouth detection (reduced frequency)
            if (finalOpenness > 0.05 && Math.random() < 0.1) { // Increased logging frequency to 10%
                console.log(`👄 MOUTH CALC: height=${avgHeight.toFixed(2)}, width=${mouthWidth.toFixed(2)}, ratio=${heightToWidthRatio.toFixed(3)}, openness=${(finalOpenness*100).toFixed(1)}%`);
            }
            
            return finalOpenness;
        } catch (error) {
            console.error('❌ Mouth openness calculation error:', error);
            return this.expressions?.surprised * 0.8 || 0;
        }
    }

    calculateSmileAsymmetry(side) {
        if (!this.landmarks) return 0;
        
        try {
            const mouth = this.landmarks.getMouth();
            const leftCorner = mouth[0];
            const rightCorner = mouth[6];
            const upperLip = mouth[13];
            
            // Calculate corner elevation relative to upper lip
            const leftElevation = upperLip.y - leftCorner.y;
            const rightElevation = upperLip.y - rightCorner.y;
            
            // Normalize and return asymmetry
            const maxElevation = Math.max(leftElevation, rightElevation);
            if (maxElevation === 0) return 0;
            
            if (side === 'left') {
                return Math.max(0, (leftElevation / maxElevation - 0.5) * 0.4);
            } else {
                return Math.max(0, (rightElevation / maxElevation - 0.5) * 0.4);
            }
        } catch (error) {
            return 0;
        }
    }

    calculateBrowMovement(region) {
        if (!this.landmarks) return 0;
        
        try {
            const positions = this.landmarks.positions;
            let browPoints, eyePoints;
            
            switch (region) {
                case 'inner':
                    browPoints = [positions[19], positions[24]]; // Inner brow points
                    eyePoints = [positions[39], positions[42]]; // Inner eye corners
                    break;
                case 'outerLeft':
                    browPoints = [positions[17], positions[18]]; // Left outer brow
                    eyePoints = [positions[36], positions[37]]; // Left eye outer
                    break;
                case 'outerRight':
                    browPoints = [positions[25], positions[26]]; // Right outer brow
                    eyePoints = [positions[43], positions[44]]; // Right eye outer
                    break;
                default:
                    return 0;
            }
            
            // Calculate average distance between brow and eye
            let avgDistance = 0;
            for (let i = 0; i < browPoints.length; i++) {
                avgDistance += this.distance(browPoints[i], eyePoints[i]);
            }
            avgDistance /= browPoints.length;
            
            // Normalize to typical distances (adjust based on your data)
            return Math.max(0, Math.min(1, (avgDistance - 15) / 10));
        } catch (error) {
            return 0;
        }
    }

    calculateCheekPuff() {
        if (!this.landmarks) return 0;
        
        try {
            const mouth = this.landmarks.getMouth();
            const nose = this.landmarks.getNose();
            const face = this.landmarks.getJawOutline();
            
            // Enhanced cheek puff detection using multiple measurements
            const mouthWidth = this.distance(mouth[0], mouth[6]);
            const noseWidth = this.distance(nose[0], nose[4]);
            
            // Get cheek reference points
            const leftCheek = face[1]; // Left side of face
            const rightCheek = face[15]; // Right side of face
            const cheekWidth = this.distance(leftCheek, rightCheek);
            
            // Calculate multiple ratios
            const mouthToNoseRatio = mouthWidth / noseWidth;
            const cheekToNoseRatio = cheekWidth / noseWidth;
            
            // Combine measurements with different weights
            const mouthExpansion = Math.max(0, (mouthToNoseRatio - 1.8) / 0.5);
            const cheekExpansion = Math.max(0, (cheekToNoseRatio - 2.8) / 0.7);
            
            // Weight mouth expansion more heavily as it's more reliable
            const combinedPuff = (mouthExpansion * 0.7 + cheekExpansion * 0.3);
            
            return Math.max(0, Math.min(1, combinedPuff));
        } catch (error) {
            return 0;
        }
    }

    calculateMouthPucker() {
        if (!this.landmarks) return 0;
        
        try {
            const mouth = this.landmarks.getMouth();
            const leftCorner = mouth[0];
            const rightCorner = mouth[6];
            const upperLip = mouth[13];
            const lowerLip = mouth[19];
            
            // Enhanced pucker detection with multiple measurements
            const width = this.distance(leftCorner, rightCorner);
            const height = this.distance(upperLip, lowerLip);
            
            // Additional lip measurements for better accuracy
            const upperMid = mouth[14];
            const lowerMid = mouth[18];
            const innerHeight = this.distance(upperMid, lowerMid);
            
            // Calculate lip compression from multiple angles
            const outerRatio = width / height;
            const innerRatio = width / innerHeight;
            const avgRatio = (outerRatio + innerRatio) / 2;
            
            // Enhanced pucker calculation with adaptive thresholds
            const basePucker = Math.max(0, (3.5 - avgRatio) / 1.5);
            
            // Add lip pursing detection based on corner movement
            const expectedWidth = height * 2.8; // Normal lip width ratio
            const compression = Math.max(0, (expectedWidth - width) / expectedWidth);
            
            // Combine measurements
            const pucker = Math.min(1, (basePucker * 0.6 + compression * 0.4));
            
            return Math.max(0, pucker - 0.1); // Remove baseline noise
        } catch (error) {
            return 0;
        }
    }

    calculateMouthPress() {
        if (!this.landmarks) return 0;
        
        try {
            const mouth = this.landmarks.getMouth();
            const upperLip = mouth[13];
            const lowerLip = mouth[19];
            
            // Very small distance indicates pressed lips
            const lipDistance = this.distance(upperLip, lowerLip);
            return Math.max(0, Math.min(1, (8 - lipDistance) / 6));
        } catch (error) {
            return 0;
        }
    }

    calculateMouthRoll(lipType) {
        if (!this.landmarks) return 0;
        
        try {
            const mouth = this.landmarks.getMouth();
            // This is a simplified approximation - would need more detailed landmark analysis
            const openness = this.calculateMouthOpenness();
            return lipType === 'upper' ? openness * 0.3 : openness * 0.2;
        } catch (error) {
            return 0;
        }
    }

    calculateMouthCornerMovement(side) {
        if (!this.landmarks) return 0;
        
        try {
            const mouth = this.landmarks.getMouth();
            const leftCorner = mouth[0];
            const rightCorner = mouth[6];
            const centerUpper = mouth[13];
            
            // Calculate horizontal displacement from center
            const centerX = centerUpper.x;
            const displacement = side === 'left' ? 
                (centerX - leftCorner.x) / 20 : 
                (rightCorner.x - centerX) / 20;
            
            return Math.max(0, Math.min(1, displacement - 0.5));
        } catch (error) {
            return 0;
        }
    }

    calculateViseme(type, mouthOpenness, expressions) {
        // Basic viseme approximation based on mouth shape and expressions
        const baseIntensity = mouthOpenness * 0.5;
        
        switch (type) {
            case 'aa': return Math.max(baseIntensity, expressions.surprised * 0.7);
            case 'oh': return Math.max(baseIntensity * 0.8, expressions.surprised * 0.5);
            case 'ee': return Math.max(baseIntensity * 0.3, expressions.happy * 0.4);
            case 'ou': return Math.max(baseIntensity * 0.6, this.calculateMouthPucker() * 0.7);
            case 'ih': return baseIntensity * 0.4;
            case 'pp': return this.calculateMouthPress() * 0.8;
            default: return 0;
        }
    }

    // TONGUE DETECTION FUNCTIONS
    calculateTongueOut(expressions, mouthOpenness) {
        if (!this.landmarks) return 0;
        
        try {
            // Enhanced tongue detection using multiple methods
            const mouth = this.landmarks.getMouth();
            
            if (!mouth || mouth.length < 20) {
                console.warn('⚠️ Insufficient mouth landmarks for tongue detection');
                return 0;
            }
            
            // Method 1: Analyze mouth shape changes that indicate tongue protrusion
            const upperLip = mouth[13];
            const lowerLip = mouth[19];
            const leftCorner = mouth[0];
            const rightCorner = mouth[6];
            
            // Calculate mouth cavity depth approximation
            const mouthCenter = {
                x: (leftCorner.x + rightCorner.x) / 2,
                y: (upperLip.y + lowerLip.y) / 2
            };
            
            // Method 2: Look for specific mouth shape patterns
            const mouthWidth = this.distance(leftCorner, rightCorner);
            const mouthHeight = this.distance(upperLip, lowerLip);
            const aspectRatio = mouthHeight / mouthWidth;
            
            // Tongue out typically creates a more oval/elongated mouth shape
            const tongueShapeIndicator = Math.max(0, (aspectRatio - 0.3) * 2);
            
            // Method 3: Combine with expression analysis
            // Surprised + open mouth could indicate tongue visibility
            const expressionIndicator = (expressions.surprised || 0) * mouthOpenness * 1.5;
            
            // Method 4: Check for mouth protrusion (approximated)
            const protrusionIndicator = this.calculateMouthProtrusion();
            
            // Combine all methods with weights
            const tongueOut = Math.min(1, 
                tongueShapeIndicator * 0.4 + 
                expressionIndicator * 0.3 + 
                protrusionIndicator * 0.3
            );
            
            // Enhanced logging for tongue detection
            if (tongueOut > 0.1 && Math.random() < 0.05) { // 5% logging chance
                console.log('👅 TONGUE DETECTION:');
                console.log(`   Shape indicator: ${tongueShapeIndicator.toFixed(3)}`);
                console.log(`   Expression indicator: ${expressionIndicator.toFixed(3)}`);
                console.log(`   Protrusion indicator: ${protrusionIndicator.toFixed(3)}`);
                console.log(`   Final tongue out: ${(tongueOut * 100).toFixed(1)}%`);
            }
            
            return tongueOut;
            
        } catch (error) {
            console.error('❌ Tongue detection error:', error);
            return 0;
        }
    }

    calculateTongueMovement(direction, expressions, mouthOpenness) {
        if (!this.landmarks) return 0;
        
        try {
            const mouth = this.landmarks.getMouth();
            const tongueOutStrength = this.calculateTongueOut(expressions, mouthOpenness);
            
            if (tongueOutStrength < 0.1) return 0; // No tongue movement if not protruding
            
            // Approximate tongue direction based on mouth asymmetry
            const leftCorner = mouth[0];
            const rightCorner = mouth[6];
            const upperLip = mouth[13];
            const lowerLip = mouth[19];
            
            const mouthCenter = {
                x: (leftCorner.x + rightCorner.x) / 2,
                y: (upperLip.y + lowerLip.y) / 2
            };
            
            switch (direction) {
                case 'left':
                    // Check if mouth is shifted left
                    const leftShift = Math.max(0, (mouthCenter.x - leftCorner.x - 20) / 10);
                    return tongueOutStrength * Math.min(1, leftShift);
                    
                case 'right':
                    // Check if mouth is shifted right
                    const rightShift = Math.max(0, (rightCorner.x - mouthCenter.x - 20) / 10);
                    return tongueOutStrength * Math.min(1, rightShift);
                    
                case 'up':
                    // Check if upper lip is more prominent
                    const upwardTrend = Math.max(0, (upperLip.y - mouthCenter.y + 5) / 8);
                    return tongueOutStrength * Math.min(1, upwardTrend);
                    
                case 'down':
                    // Check if lower lip is more prominent
                    const downwardTrend = Math.max(0, (mouthCenter.y - lowerLip.y + 5) / 8);
                    return tongueOutStrength * Math.min(1, downwardTrend);
                    
                default:
                    return 0;
            }
            
        } catch (error) {
            console.error(`❌ Tongue ${direction} movement calculation error:`, error);
            return 0;
        }
    }

    calculateMouthProtrusion() {
        if (!this.landmarks) return 0;
        
        try {
            const mouth = this.landmarks.getMouth();
            const nose = this.landmarks.getNose();
            
            // Simple protrusion approximation using nose-to-mouth distance
            const noseTip = nose[nose.length - 1];
            const mouthCenter = mouth[13]; // Upper lip center
            
            const distance = this.distance(noseTip, mouthCenter);
            
            // Normalize based on typical face proportions
            // Closer mouth to nose might indicate protrusion
            return Math.max(0, Math.min(1, (25 - distance) / 10));
            
        } catch (error) {
            return 0;
        }
    }

    // GLOBAL TESTING FUNCTIONS - Call these from browser console
    
    // Test tongue detection manually
    testTongueDetection() {
        console.log('🧪 === MANUAL TONGUE DETECTION TEST ===');
        
        if (!this.landmarks) {
            console.log('❌ No face landmarks available - make sure camera is active and face is detected');
            return;
        }
        
        const expressions = this.expressions || {};
        const mouthOpen = this.calculateMouthOpenness();
        const tongueOut = this.calculateTongueOut(expressions, mouthOpen);
        
        console.log(`📊 Current readings:`);
        console.log(`   Mouth openness: ${(mouthOpen * 100).toFixed(1)}%`);
        console.log(`   Tongue detection: ${(tongueOut * 100).toFixed(1)}%`);
        console.log(`   Expressions:`, expressions);
        
        if (tongueOut > 0.05) {
            console.log('👅 TONGUE DETECTED! Testing morph targets...');
            this.forceTongueTest(tongueOut);
        } else {
            console.log('👅 No significant tongue movement detected');
            console.log('💡 Try sticking your tongue out more dramatically');
        }
        
        return { mouthOpen, tongueOut, expressions };
    }
    
    // Check avatar tongue capabilities
    checkTongueCapabilities() {
        console.log('🔍 === AVATAR TONGUE CAPABILITIES ===');
        
        if (!this.avatar || !this.avatar.morphTargets) {
            console.log('❌ No avatar or morph targets available');
            return;
        }
        
        const allTargets = Object.keys(this.avatar.morphTargets);
        console.log(`🎭 Total morph targets: ${allTargets.length}`);
        
        // Check for tongue-specific targets
        const tongueTargets = allTargets.filter(key => 
            key.toLowerCase().includes('tongue') ||
            key.toLowerCase().includes('lick')
        );
        
        const mouthRollTargets = allTargets.filter(key => 
            key.toLowerCase().includes('mouthroll') ||
            key.toLowerCase().includes('mouth_roll') ||
            key.toLowerCase().includes('liproll') ||
            (key.toLowerCase().includes('roll') && key.toLowerCase().includes('mouth'))
        );
        
        console.log(`👅 Tongue-specific targets (${tongueTargets.length}):`, tongueTargets);
        console.log(`🔄 Mouth roll targets (${mouthRollTargets.length}):`, mouthRollTargets);
        
        if (tongueTargets.length === 0 && mouthRollTargets.length === 0) {
            console.log('❌ NO TONGUE CAPABILITIES FOUND');
            console.log('💡 This Ready Player Me avatar may not support tongue animations');
        } else {
            console.log('✅ Found potential tongue animation capabilities!');
        }
        
        // Test all tongue-related targets
        console.log('🧪 Testing all tongue-related targets at 50%...');
        [...tongueTargets, ...mouthRollTargets].forEach(target => {
            if (this.avatar.morphTargets[target]) {
                this.avatar.morphTargets[target].target.influence = 0.5;
                console.log(`✅ Applied ${target} at 50%`);
                
                // Reset after 3 seconds
                setTimeout(() => {
                    if (this.avatar.morphTargets[target]) {
                        this.avatar.morphTargets[target].target.influence = 0;
                        console.log(`🔄 Reset ${target}`);
                    }
                }, 3000);
            }
        });
        
        return { tongueTargets, mouthRollTargets, total: allTargets.length };
    }
    
    // Force maximum tongue test
    maxTongueTest() {
        console.log('🚀 === MAXIMUM TONGUE TEST ===');
        this.forceTongueTest(1.0); // Test with maximum strength
    }

    smoothBlendshape(shapeName, targetValue) {
        // Initialize smoothing storage if needed
        if (!this.blendshapeSmoothing) {
            this.blendshapeSmoothing = {};
        }
        
        // Get previous value
        const prevValue = this.blendshapeSmoothing[shapeName] || 0;
        
        // Adaptive smoothing based on expression type
        let smoothingFactor = 0.7; // Default
        
        // Different smoothing for different expression types
        if (shapeName.includes('blink') || shapeName.includes('Blink')) {
            smoothingFactor = 0.8; // More responsive for blinking
        } else if (shapeName.includes('smile') || shapeName.includes('Smile')) {
            smoothingFactor = 0.75; // Responsive for smiles
        } else if (shapeName.includes('jaw') || shapeName.includes('Jaw') || shapeName.includes('mouth')) {
            smoothingFactor = 0.7; // Moderate for mouth movements
        } else if (shapeName.includes('brow') || shapeName.includes('Brow')) {
            smoothingFactor = 0.65; // Slightly slower for eyebrows
        }
        
        // Apply smoothing
        const smoothedValue = prevValue + (targetValue - prevValue) * smoothingFactor;
        
        // Store for next frame
        this.blendshapeSmoothing[shapeName] = smoothedValue;
        
        return smoothedValue;
    }

    animateHeadRotation() {
        if (!this.landmarks) return;
        
        try {
            // Use head group for unified movement, fallback to individual head mesh
            let targetForRotation = this.avatar.headGroup || this.avatar.headMesh || this.avatar.head;
            
            if (!targetForRotation) {
                // For fallback avatar, use individual head
                if (this.avatar.isFallback && this.avatar.head) {
                    targetForRotation = this.avatar.head;
                } else {
                    return; // No head to animate
                }
            }
            
            // Calculate head rotation from facial landmarks
            const nose = this.landmarks.getNose();
            const leftEye = this.landmarks.getLeftEye();
            const rightEye = this.landmarks.getRightEye();
            
            // Calculate yaw (left/right rotation)
            const eyeCenterLeft = this.getEyeCenter(leftEye);
            const eyeCenterRight = this.getEyeCenter(rightEye);
            const noseTip = nose[nose.length - 1]; // Nose tip
            
            // Yaw calculation (left/right rotation) - modest increase in sensitivity
            const eyeLineCenter = {
                x: (eyeCenterLeft.x + eyeCenterRight.x) / 2,
                y: (eyeCenterLeft.y + eyeCenterRight.y) / 2
            };
            const yawAngle = (noseTip.x - eyeLineCenter.x) * 0.012; // Increased from 0.01 to 0.012 (20% increase)
            
            // Pitch calculation (up/down) - modest increase in sensitivity
            const eyeToNoseDistance = this.distance(eyeLineCenter, noseTip);
            const pitchAngle = (eyeToNoseDistance - 35) * 0.006; // Increased from 0.005 to 0.006 (20% increase)
            
            // Roll calculation (tilt) - modest increase in sensitivity
            const eyeAngle = Math.atan2(
                eyeCenterRight.y - eyeCenterLeft.y,
                eyeCenterRight.x - eyeCenterLeft.x
            );
            const rollAngle = eyeAngle * 0.55; // Increased from 0.5 to 0.55 (10% increase)
            
            // Apply smoothed rotation with moderately responsive smoothing
            if (!this.headRotationSmoothing) {
                this.headRotationSmoothing = { yaw: 0, pitch: 0, roll: 0 };
            }
            
            const smoothFactor = 0.65; // Increased from 0.6 to 0.65 for slightly more responsiveness
            this.headRotationSmoothing.yaw += (yawAngle - this.headRotationSmoothing.yaw) * smoothFactor;
            this.headRotationSmoothing.pitch += (pitchAngle - this.headRotationSmoothing.pitch) * smoothFactor;
            this.headRotationSmoothing.roll += (rollAngle - this.headRotationSmoothing.roll) * smoothFactor;
            
            // Apply rotation to the target (head group or individual head)
            // Flip yaw to match mirrored video feed with increased range
            const maxYaw = Math.PI * 0.4; // Allow up to ~72 degrees rotation
            const maxPitch = Math.PI * 0.25; // Allow up to ~45 degrees up/down
            const maxRoll = Math.PI * 0.2; // Allow up to ~36 degrees tilt
            
            targetForRotation.rotation.y = Math.max(-maxYaw, Math.min(maxYaw, this.headRotationSmoothing.yaw));
            targetForRotation.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, this.headRotationSmoothing.pitch));
            targetForRotation.rotation.z = Math.max(-maxRoll, Math.min(maxRoll, -this.headRotationSmoothing.roll));
            
            // Debug logging for head rotation (occasionally)
            if (Math.random() < 0.01) { // 1% chance to log
                console.log(`🎯 Head Rotation - Yaw: ${(this.headRotationSmoothing.yaw * 180 / Math.PI).toFixed(1)}°, Pitch: ${(this.headRotationSmoothing.pitch * 180 / Math.PI).toFixed(1)}°, Roll: ${(this.headRotationSmoothing.roll * 180 / Math.PI).toFixed(1)}°`);
            }
            
            // Log which target is being rotated (occasionally)
            if (Math.random() < 0.001) { // Very rare logging
                console.log(`Head rotation applied to: ${targetForRotation.name || 'head'}`);
            }
            
        } catch (error) {
            console.warn('Head rotation calculation error:', error);
        }
    }

    animateEyeGaze() {
        if (!this.landmarks) return;
        
        try {
            const leftEye = this.landmarks.getLeftEye();
            const rightEye = this.landmarks.getRightEye();
            
            // Calculate gaze direction (simplified)
            const leftGaze = this.calculateEyeGazeDirection(leftEye);
            const rightGaze = this.calculateEyeGazeDirection(rightEye);
            
            // Apply to eye look blendshapes
            const gazeInfluence = 0.4;
            
            // Horizontal gaze
            if (this.avatar.morphTargets['eyelookleft'] || this.avatar.morphTargets['eyeLookLeft']) {
                const leftLookValue = Math.max(0, -leftGaze.x * gazeInfluence);
                this.setMorphTarget(['eyelookleft', 'eyeLookLeft'], leftLookValue);
            }
            
            if (this.avatar.morphTargets['eyelookright'] || this.avatar.morphTargets['eyeLookRight']) {
                const rightLookValue = Math.max(0, leftGaze.x * gazeInfluence);
                this.setMorphTarget(['eyelookright', 'eyeLookRight'], rightLookValue);
            }
            
            // Vertical gaze
            if (this.avatar.morphTargets['eyelookup'] || this.avatar.morphTargets['eyeLookUp']) {
                const upLookValue = Math.max(0, -leftGaze.y * gazeInfluence);
                this.setMorphTarget(['eyelookup', 'eyeLookUp'], upLookValue);
            }
            
            if (this.avatar.morphTargets['eyelookdown'] || this.avatar.morphTargets['eyeLookDown']) {
                const downLookValue = Math.max(0, leftGaze.y * gazeInfluence);
                this.setMorphTarget(['eyelookdown', 'eyeLookDown'], downLookValue);
            }
            
        } catch (error) {
            console.warn('Eye gaze calculation error:', error);
        }
    }

    calculateEyeGazeDirection(eyeLandmarks) {
        // Simplified gaze calculation - in a real implementation you'd need pupil detection
        const eyeCenter = this.getEyeCenter(eyeLandmarks);
        const eyeRect = this.getEyeBoundingRect(eyeLandmarks);
        
        // Approximate gaze based on eye center relative to eye bounds
        const relativeX = (eyeCenter.x - eyeRect.centerX) / eyeRect.width;
        const relativeY = (eyeCenter.y - eyeRect.centerY) / eyeRect.height;
        
        return { x: relativeX, y: relativeY };
    }

    getEyeBoundingRect(eyeLandmarks) {
        const xs = eyeLandmarks.map(p => p.x);
        const ys = eyeLandmarks.map(p => p.y);
        
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        return {
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    setMorphTarget(names, value) {
        for (const name of names) {
            if (this.avatar.morphTargets[name.toLowerCase()]) {
                this.avatar.morphTargets[name.toLowerCase()].target.influence = 
                    Math.max(0, Math.min(1, value));
            }
            if (this.avatar.morphTargets[name]) {
                this.avatar.morphTargets[name].target.influence = 
                    Math.max(0, Math.min(1, value));
            }
        }
    }

    getEyeCenter(eyeLandmarks) {
        let sumX = 0, sumY = 0;
        eyeLandmarks.forEach(point => {
            sumX += point.x;
            sumY += point.y;
        });
        return {
            x: sumX / eyeLandmarks.length,
            y: sumY / eyeLandmarks.length
        };
    }

    updateExpressionIndicators() {
        if (!this.expressions) return;

        // Enhanced expression detection with adaptive thresholds
        const indicators = {
            'expr-smile': this.expressions.happy > this.expressionThresholds.smile,
            'expr-mouth-open': this.expressions.surprised > this.expressionThresholds.surprise || 
                              (this.expressions.fearful || 0) > 0.3 || 
                              this.calculateMouthOpenness() > this.expressionThresholds.jawOpen,
            'expr-blink-left': this.calculateEyeBlinkStrength('left') > this.expressionThresholds.eyeBlink,
            'expr-blink-right': this.calculateEyeBlinkStrength('right') > this.expressionThresholds.eyeBlink,
            'expr-eyebrow-raise': this.expressions.surprised > this.expressionThresholds.surprise || 
                                 (this.expressions.fearful || 0) > 0.25 ||
                                 this.calculateBrowMovement('inner') > 0.3,
            'expr-surprise': this.expressions.surprised > 0.4,
            'expr-frown': this.expressions.sad > this.expressionThresholds.frown || 
                         (this.expressions.angry || 0) > 0.35,
            'expr-angry': (this.expressions.angry || 0) > 0.4,
            'expr-disgusted': (this.expressions.disgusted || 0) > 0.4,
            'expr-fearful': (this.expressions.fearful || 0) > 0.4
        };

        for (const [id, isActive] of Object.entries(indicators)) {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle('active', isActive);
                
                // Add intensity-based styling
                if (isActive && element.style) {
                    const intensity = this.getExpressionIntensity(id);
                    element.style.opacity = Math.max(0.6, intensity);
                }
            }
        }
    }
    
    getExpressionIntensity(indicatorId) {
        if (!this.expressions) return 0.6;
        
        switch(indicatorId) {
            case 'expr-smile': return this.expressions.happy;
            case 'expr-surprise': return this.expressions.surprised;
            case 'expr-frown': return Math.max(this.expressions.sad, this.expressions.angry || 0);
            case 'expr-angry': return this.expressions.angry || 0;
            case 'expr-disgusted': return this.expressions.disgusted || 0;
            case 'expr-fearful': return this.expressions.fearful || 0;
            case 'expr-mouth-open': return Math.max(this.expressions.surprised, this.calculateMouthOpenness());
            case 'expr-blink-left': return this.calculateEyeBlinkStrength('left');
            case 'expr-blink-right': return this.calculateEyeBlinkStrength('right');
            case 'expr-eyebrow-raise': return Math.max(this.expressions.surprised, this.calculateBrowMovement('inner'));
            default: return 0.6;
        }
    }

    calculateBlinkStrength() {
        // This method is now deprecated in favor of calculateEyeBlinkStrength
        // Keeping for backward compatibility
        if (!this.landmarks) return 0;
        
        try {
            const leftEye = this.landmarks.getLeftEye();
            const rightEye = this.landmarks.getRightEye();
            
            const leftEAR = this.getEyeAspectRatio(leftEye);
            const rightEAR = this.getEyeAspectRatio(rightEye);
            
            // Average eye aspect ratio
            const avgEAR = (leftEAR + rightEAR) / 2;
            
            // Convert to blink strength (lower EAR = more closed = higher blink strength)
            const blinkStrength = Math.max(0, 1 - (avgEAR / 0.25)); // Updated threshold
            
            return Math.min(1, blinkStrength * 1.3); // Updated amplification
        } catch (error) {
            // Fallback to neutral expression if landmark processing fails
            return this.expressions?.neutral > 0.7 ? 1 : 0;
        }
    }

    getEyeAspectRatio(eyeLandmarks) {
        if (!eyeLandmarks || eyeLandmarks.length < 6) return 0.3; // Default open eye ratio
        
        // Calculate vertical distances
        const vertical1 = this.distance(eyeLandmarks[1], eyeLandmarks[5]);
        const vertical2 = this.distance(eyeLandmarks[2], eyeLandmarks[4]);
        
        // Calculate horizontal distance
        const horizontal = this.distance(eyeLandmarks[0], eyeLandmarks[3]);
        
        // Eye aspect ratio
        if (horizontal === 0) return 0.3; // Avoid division by zero
        const ear = (vertical1 + vertical2) / (2 * horizontal);
        return ear;
    }

    distance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    clearExpressionIndicators() {
        const indicators = document.querySelectorAll('.expression-indicator');
        indicators.forEach(indicator => indicator.classList.remove('active'));
    }

    drawDebugOverlay() {
        if (!this.faceDetections || !this.overlayCanvas) return;

        const ctx = this.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // Draw face detection box
        const detection = this.faceDetections.detection;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(detection.box.x, detection.box.y, detection.box.width, detection.box.height);

        // Draw landmarks
        if (this.landmarks) {
            ctx.fillStyle = '#ff0000';
            this.landmarks.positions.forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                ctx.fill();
            });
        }

        // Draw expression values
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(`Happy: ${(this.expressions.happy * 100).toFixed(1)}%`, 10, 20);
        ctx.fillText(`Surprised: ${(this.expressions.surprised * 100).toFixed(1)}%`, 10, 35);
        ctx.fillText(`Sad: ${(this.expressions.sad * 100).toFixed(1)}%`, 10, 50);
    }

    updateStatus(message, type) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
    }

    updateAvatarInfo(message) {
        const avatarInfoElement = document.getElementById('avatarInfo');
        if (avatarInfoElement) {
            avatarInfoElement.textContent = message;
        }
    }

    resetAvatar() {
        if (!this.avatar) return;

        if (this.avatar.isFallback) {
            // Reset fallback avatar
            this.avatar.leftEye.scaling = new BABYLON.Vector3(1, 1, 1);
            this.avatar.rightEye.scaling = new BABYLON.Vector3(1, 1, 1);
            this.avatar.mouth.scaling = new BABYLON.Vector3(1, 1, 1);
            if (this.avatar.head) {
                this.avatar.head.rotation = BABYLON.Vector3.Zero();
            }
        } else {
            // Reset blend shapes
            Object.values(this.avatar.morphTargets).forEach(morphTarget => {
                morphTarget.target.influence = morphTarget.originalInfluence;
            });
            
            // Reset head group rotation (this will reset all head parts together)
            if (this.avatar.headGroup) {
                this.avatar.headGroup.rotation = BABYLON.Vector3.Zero();
            } else if (this.avatar.headMesh) {
                // Fallback to individual head mesh if no group
                this.avatar.headMesh.rotation = BABYLON.Vector3.Zero();
            }
        }

        // Reset camera position for head-only view
        this.camera.setTarget(new BABYLON.Vector3(0, 0.8, 0)); // Higher target for face
        this.camera.alpha = -Math.PI / 2;
        this.camera.beta = Math.PI / 2.1;
        this.camera.radius = 1.2; // Closer for face view

        // Reset pan values
        this.panX = 0;
        this.panY = 0;

        // Reset all smoothing systems
        this.previousExpressions = {};
        this.blendshapeSmoothing = {};
        this.headRotationSmoothing = { yaw: 0, pitch: 0, roll: 0 };

        // Update slider values to match reset camera position
        this.updateSliderValues();

        console.log('Avatar and smoothing systems reset - head group coordinated');
    }

    toggleDebug() {
        this.debugMode = !this.debugMode;
        const btn = document.getElementById('toggleDebugBtn');
        btn.textContent = this.debugMode ? '🐛 Hide Debug' : '🐛 Show Debug';
        
        if (!this.debugMode) {
            const ctx = this.overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        }
    }

    // Zoom controls
    zoomIn() {
        if (this.camera) {
            this.camera.radius = Math.max(this.camera.lowerRadiusLimit, this.camera.radius - 0.2);
            console.log('Zoomed in, radius:', this.camera.radius.toFixed(2));
        }
    }

    zoomOut() {
        if (this.camera) {
            this.camera.radius = Math.min(this.camera.upperRadiusLimit, this.camera.radius + 0.2);
            console.log('Zoomed out, radius:', this.camera.radius.toFixed(2));
        }
    }

    // Camera position controls - TRUE PANNING
    updateCameraHorizontal(value) {
        if (this.camera) {
            this.manualCameraControl = true;
            this.panX = parseFloat(value);
            this.applyCameraPanning();
            console.log('Camera pan X:', this.panX.toFixed(2));
            setTimeout(() => {
                this.manualCameraControl = false;
            }, 500);
        }
    }

    updateCameraVertical(value) {
        if (this.camera) {
            this.manualCameraControl = true;
            this.panY = parseFloat(value);
            this.applyCameraPanning();
            console.log('Camera pan Y:', this.panY.toFixed(2));
            setTimeout(() => {
                this.manualCameraControl = false;
            }, 500);
        }
    }

    applyCameraPanning() {
        if (!this.camera) return;
        
        // Store original camera parameters
        const originalAlpha = this.camera.alpha;
        const originalBeta = this.camera.beta;
        const originalRadius = this.camera.radius;
        const originalTarget = new BABYLON.Vector3(0, 0.5, 0); // Default target
        
        // Calculate camera's right and up vectors for panning
        const cameraMatrix = this.camera.getViewMatrix();
        const right = new BABYLON.Vector3(cameraMatrix.m[0], cameraMatrix.m[4], cameraMatrix.m[8]);
        const up = new BABYLON.Vector3(cameraMatrix.m[1], cameraMatrix.m[5], cameraMatrix.m[9]);
        
        // Apply panning offset to target
        const panOffset = right.scale(this.panX).add(up.scale(this.panY));
        const newTarget = originalTarget.add(panOffset);
        
        // Update camera target
        this.camera.setTarget(newTarget);
        
        // Restore camera orientation and distance
        this.camera.alpha = originalAlpha;
        this.camera.beta = originalBeta;
        this.camera.radius = originalRadius;
    }

    updateSliderValues() {
        if (this.camera) {
            // Update sliders with current pan values
            const horizontalSlider = document.getElementById('cameraHorizontal');
            const horizontalValue = document.getElementById('horizontalValue');
            if (horizontalSlider && horizontalValue) {
                horizontalSlider.value = this.panX.toFixed(1);
                horizontalValue.textContent = this.panX.toFixed(1);
            }

            // Update vertical slider
            const verticalSlider = document.getElementById('cameraVertical');
            const verticalValue = document.getElementById('verticalValue');
            if (verticalSlider && verticalValue) {
                verticalSlider.value = this.panY.toFixed(1);
                verticalValue.textContent = this.panY.toFixed(1);
            }
        }
    }

    syncSliderValues() {
        this.updateSliderValues();
    }

    // Test function to manually trigger blinking for debugging
    testBlinking() {
        if (!this.avatar || !this.avatar.morphTargets) {
            console.log('❌ No avatar or morph targets available for blink test');
            return;
        }
        
        console.log('🧪 TESTING BLINKING MANUALLY...');
        console.log('📋 All available morph targets:', Object.keys(this.avatar.morphTargets));
        
        // Test all possible blink-related morph targets
        const blinkTargets = Object.keys(this.avatar.morphTargets).filter(key => 
            key.toLowerCase().includes('blink') || 
            key.toLowerCase().includes('eye')
        );
        
        console.log('👁️ Found eye/blink targets:', blinkTargets);
        
        if (blinkTargets.length === 0) {
            console.log('❌ No blink-related morph targets found!');
            // Try to apply to fallback avatar if available
            if (this.avatar.isFallback && this.avatar.leftEye && this.avatar.rightEye) {
                console.log('🤖 Testing fallback avatar eye scaling...');
                this.avatar.leftEye.scaling = new BABYLON.Vector3(1, 0.1, 1);
                this.avatar.rightEye.scaling = new BABYLON.Vector3(1, 0.1, 1);
                setTimeout(() => {
                    this.avatar.leftEye.scaling = new BABYLON.Vector3(1, 1, 1);
                    this.avatar.rightEye.scaling = new BABYLON.Vector3(1, 1, 1);
                    console.log('🔄 Fallback blink test complete');
                }, 1000);
            }
            return;
        }
        
        // Apply full blink for 1.5 seconds
        blinkTargets.forEach(target => {
            this.avatar.morphTargets[target].target.influence = 1.0;
            console.log(`✅ Applied full blink to: ${target}`);
        });
        
        // Reset after 1.5 seconds
        setTimeout(() => {
            blinkTargets.forEach(target => {
                this.avatar.morphTargets[target].target.influence = 0.0;
            });
            console.log('🔄 Reset blink test - eyes should be open now');
        }, 1500);
    }

    // Auto-blink test function to verify morph targets
    startAutoBlinkTest() {
        if (this.autoBlinkInterval) {
            clearInterval(this.autoBlinkInterval);
            console.log('🔄 Stopped auto-blink test');
            return;
        }
        
        console.log('🤖 Starting auto-blink test - blinks every 3 seconds');
        this.autoBlinkInterval = setInterval(() => {
            this.testBlinking();
        }, 3000);
    }

    // Check if the avatar has functional eyelids
    checkEyelidCapability() {
        console.log('🔍 === EYELID CAPABILITY CHECK ===');
        
        if (!this.avatar) {
            console.log('❌ No avatar loaded');
            return false;
        }
        
        if (this.avatar.isFallback) {
            console.log('🤖 Fallback avatar: Has scalable eye meshes');
            console.log('👁️ Left eye mesh:', !!this.avatar.leftEye);
            console.log('👁️ Right eye mesh:', !!this.avatar.rightEye);
            return !!this.avatar.leftEye && !!this.avatar.rightEye;
        }
        
        // Check for blendshape-based eyelids
        const allTargets = Object.keys(this.avatar.morphTargets || {});
        console.log('📋 Total morph targets:', allTargets.length);
        
        const eyeTargets = allTargets.filter(key => 
            key.toLowerCase().includes('blink') || 
            key.toLowerCase().includes('eye') ||
            key.toLowerCase().includes('lid')
        );
        
        console.log('👁️ Eye-related targets:', eyeTargets.length);
        console.log('👁️ Eye target names:', eyeTargets);
        
        // Test if morph targets actually work
        if (eyeTargets.length > 0) {
            console.log('🧪 Testing morph target functionality...');
            eyeTargets.forEach(target => {
                const morphTarget = this.avatar.morphTargets[target];
                if (morphTarget && morphTarget.target) {
                    console.log(`✅ ${target}: Functional morph target`);
                } else {
                    console.log(`❌ ${target}: Broken morph target`);
                }
            });
            return true;
        } else {
            console.log('❌ No eye morph targets found');
            return false;
        }
    }
}

// Global functions for HTML buttons
function startApp() {
    if (window.app && window.app.isTracking) {
        window.app.stopCamera();
    } else {
        window.app.startCamera();
    }
}

function resetAvatar() {
    if (window.app) {
        window.app.resetAvatar();
    }
}

function toggleDebug() {
    if (window.app) {
        window.app.toggleDebug();
    }
}

function zoomIn() {
    if (window.app) {
        window.app.zoomIn();
    }
}

function zoomOut() {
    if (window.app) {
        window.app.zoomOut();
    }
}

function updateCameraHorizontal(value) {
    if (window.app) {
        window.app.updateCameraHorizontal(value);
        document.getElementById('horizontalValue').textContent = parseFloat(value).toFixed(1);
    }
}

function updateCameraVertical(value) {
    if (window.app) {
        window.app.updateCameraVertical(value);
        document.getElementById('verticalValue').textContent = parseFloat(value).toFixed(1);
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FacePuppetApp();
    
    // Make testing functions globally accessible
    window.testTongueDetection = () => window.app.testTongueDetection();
    window.checkTongueCapabilities = () => window.app.checkTongueCapabilities();
    window.maxTongueTest = () => window.app.maxTongueTest();
    window.analyzeMorphTargets = () => window.app.analyzeMorphTargets();
    window.forceMouthTest = (open = 0.8, smile = 0.5) => window.app.forceMouthTest(open, smile);
});

// Global functions for testing
function testBlinking() {
    if (window.app) {
        window.app.testBlinking();
    } else {
        console.log('❌ App not initialized yet');
    }
}

function startAutoBlinkTest() {
    if (window.app) {
        window.app.startAutoBlinkTest();
    } else {
        console.log('❌ App not initialized yet');
    }
}

function checkEyelids() {
    if (window.app) {
        window.app.checkEyelidCapability();
    } else {
        console.log('❌ App not initialized yet');
    }
}

function debugBlinking() {
    if (window.app) {
        console.log('🔍 === REAL-TIME BLINK DEBUG ===');
        if (window.app.landmarks) {
            const leftBlink = window.app.calculateEyeBlinkStrength('left');
            const rightBlink = window.app.calculateEyeBlinkStrength('right');
            console.log(`Current blink: Left ${(leftBlink*100).toFixed(1)}%, Right ${(rightBlink*100).toFixed(1)}%`);
            
            // Force test the current values
            window.app.forceBlinkTest(leftBlink, rightBlink);
        } else {
            console.log('❌ No face landmarks detected');
        }
    } else {
        console.log('❌ App not initialized yet');
    }
}

// Enhanced debugging functions
function checkMorphTargets() {
    if (window.app && window.app.avatar) {
        return window.app.analyzeMorphTargets();
    } else {
        console.log('❌ App or avatar not available');
    }
}

// Enhanced debugging functions
function checkMorphTargets() {
    if (window.app && window.app.avatar) {
        return window.app.analyzeMorphTargets();
    } else {
        console.log('❌ App or avatar not available');
    }
}

function forceAvatarActivation() {
    if (window.app && window.app.avatar) {
        console.log('🔋 === FORCING AVATAR ACTIVATION ===');
        
        // Check if we're dealing with a ReadyPlayerMe avatar
        if (window.app.scene) {
            console.log('🔍 Searching ALL scene meshes for morph capabilities...');
            
            window.app.scene.meshes.forEach((mesh, index) => {
                console.log(`Mesh ${index}: ${mesh.name}`);
                
                if (mesh.morphTargetManager) {
                    console.log(`  ✅ HAS MorphTargetManager with ${mesh.morphTargetManager.numTargets} targets`);
                    
                    // Log all morph targets for this mesh
                    for (let i = 0; i < mesh.morphTargetManager.numTargets; i++) {
                        const target = mesh.morphTargetManager.getTarget(i);
                        console.log(`    - ${target.name}: ${target.influence}`);
                    }
                    
                    // Try to enable the manager
                    mesh.morphTargetManager.areUpdatesFrozen = false;
                    mesh.morphTargetManager.enableNormalMorphing = true;
                    console.log(`  🔄 Activated morph target manager for ${mesh.name}`);
                    
                } else {
                    console.log(`  ❌ No MorphTargetManager`);
                }
                
                // Check material properties
                if (mesh.material) {
                    console.log(`  🎨 Material: ${mesh.material.name || 'unnamed'}`);
                } else {
                    console.log(`  ❌ No material`);
                }
            });
        }
        
        // Try to rebuild morph targets
        console.log('🔄 Attempting to rebuild morph target system...');
        if (window.app.avatar.allHeadParts) {
            const newMorphTargets = window.app.findMorphTargets(window.app.avatar.allHeadParts);
            console.log('🎭 Rebuilt morph targets:', Object.keys(newMorphTargets));
            window.app.avatar.morphTargets = newMorphTargets;
        }
        
    } else {
        console.log('❌ App or avatar not available');
    }
}

function testAllMeshMorphTargets() {
    if (window.app && window.app.scene) {
        console.log('🔥 === TESTING ALL MESH MORPH TARGETS ===');
        
        window.app.scene.meshes.forEach(mesh => {
            if (mesh.morphTargetManager && mesh.morphTargetManager.numTargets > 0) {
                console.log(`🎭 Testing ${mesh.name} with ${mesh.morphTargetManager.numTargets} targets:`);
                
                for (let i = 0; i < mesh.morphTargetManager.numTargets; i++) {
                    const target = mesh.morphTargetManager.getTarget(i);
                    const originalInfluence = target.influence;
                    
                    // Test with extreme value
                    target.influence = 1.0;
                    console.log(`  📈 Set ${target.name} to 100% on ${mesh.name}`);
                    
                    // Reset after 2 seconds
                    setTimeout(() => {
                        target.influence = originalInfluence;
                        console.log(`  🔄 Reset ${target.name} on ${mesh.name}`);
                    }, 2000);
                }
            }
        });
    }
}

function syncMorphTargetsAcrossAllMeshes() {
    if (window.app && window.app.scene) {
        console.log('🔄 === SYNCING MORPH TARGETS ACROSS ALL MESHES ===');
        
        // Get current mouth values
        const mouthOpenValue = window.app.calculateMouthOpenness();
        const smileValue = window.app.expressions?.happy || 0;
        
        console.log(`Applying: mouthOpen=${(mouthOpenValue*100).toFixed(1)}%, smile=${(smileValue*100).toFixed(1)}%`);
        
        window.app.scene.meshes.forEach(mesh => {
            if (mesh.morphTargetManager) {
                for (let i = 0; i < mesh.morphTargetManager.numTargets; i++) {
                    const target = mesh.morphTargetManager.getTarget(i);
                    
                    if (target.name.toLowerCase().includes('mouthopen') || target.name.toLowerCase().includes('jawopen')) {
                        target.influence = mouthOpenValue;
                        console.log(`✅ Applied ${(mouthOpenValue*100).toFixed(1)}% mouthOpen to ${mesh.name}`);
                    }
                    
                    if (target.name.toLowerCase().includes('mouthsmile') || target.name.toLowerCase().includes('smile')) {
                        target.influence = smileValue;
                        console.log(`✅ Applied ${(smileValue*100).toFixed(1)}% smile to ${mesh.name}`);
                    }
                }
            }
        });
    }
}

function testExtremeValues() {
    if (window.app && window.app.avatar && window.app.avatar.morphTargets) {
        console.log('💥 === EXTREME VALUE TEST ===');
        
        const targets = Object.keys(window.app.avatar.morphTargets);
        targets.forEach(targetName => {
            const targetData = window.app.avatar.morphTargets[targetName];
            if (targetData && targetData.target) {
                console.log(`🎯 Testing ${targetName} with extreme values...`);
                
                // Test sequence: 0% -> 100% -> 0%
                const originalValue = targetData.target.influence;
                
                setTimeout(() => {
                    targetData.target.influence = 0.0;
                    console.log(`📉 ${targetName}: 0%`);
                }, 0);
                
                setTimeout(() => {
                    targetData.target.influence = 1.0;
                    console.log(`📈 ${targetName}: 100%`);
                }, 1000);
                
                setTimeout(() => {
                    targetData.target.influence = 0.5;
                    console.log(`📊 ${targetName}: 50%`);
                }, 2000);
                
                setTimeout(() => {
                    targetData.target.influence = originalValue;
                    console.log(`🔄 ${targetName}: reset to ${(originalValue*100).toFixed(1)}%`);
                }, 3000);
            }
        });
    }
}

function checkAvatarGeometry() {
    if (window.app && window.app.avatar) {
        console.log('🔍 === AVATAR GEOMETRY CHECK ===');
        
        if (window.app.avatar.allHeadParts) {
            window.app.avatar.allHeadParts.forEach(mesh => {
                console.log(`📐 ${mesh.name}:`);
                console.log(`  - Vertices: ${mesh.getTotalVertices()}`);
                console.log(`  - Indices: ${mesh.getTotalIndices()}`);
                console.log(`  - Visible: ${mesh.isVisible}`);
                console.log(`  - Enabled: ${mesh.isEnabled()}`);
                console.log(`  - Position: ${mesh.position.toString()}`);
                console.log(`  - Scaling: ${mesh.scaling.toString()}`);
                
                if (mesh.morphTargetManager) {
                    console.log(`  - MorphTargets: ${mesh.morphTargetManager.numTargets}`);
                    console.log(`  - Updates frozen: ${mesh.morphTargetManager.areUpdatesFrozen}`);
                }
            });
        }
        
        // Check if avatar is actually rendering
        console.log('🎬 Render info:');
        console.log(`Scene render count: ${window.app.scene.getRenderedMeshes().length}`);
        console.log(`Active meshes: ${window.app.scene.getActiveMeshes().length}`);
    }
}

function checkEyeTargets() {
    if (window.app && window.app.avatar && window.app.avatar.morphTargets) {
        const allTargets = Object.keys(window.app.avatar.morphTargets);
        const eyeTargets = allTargets.filter(key => 
            key.toLowerCase().includes('eye') || 
            key.toLowerCase().includes('blink') ||
            key.toLowerCase().includes('lid')
        );
        
        console.log('👁️ === EYE TARGETS CHECK ===');
        console.log(`Total targets: ${allTargets.length}`);
        console.log(`Eye-related: ${eyeTargets.length}`);
        console.log('Eye targets:', eyeTargets);
        
        if (eyeTargets.length === 0) {
            console.log('❌ NO EYE TARGETS FOUND!');
            console.log('🔍 Checking for any targets with similar names...');
            
            const possibleEyeTargets = allTargets.filter(key => 
                key.toLowerCase().includes('shut') ||
                key.toLowerCase().includes('close') ||
                key.toLowerCase().includes('wink') ||
                key.toLowerCase().includes('squint') ||
                key.includes('Eye') ||
                key.includes('Blink')
            );
            
            if (possibleEyeTargets.length > 0) {
                console.log('🎯 Possible eye-related targets:', possibleEyeTargets);
            } else {
                console.log('❌ NO POSSIBLE EYE TARGETS FOUND');
                console.log('📋 All available targets:', allTargets);
            }
        } else {
            // Test each eye target
            eyeTargets.forEach(target => {
                const morphTarget = window.app.avatar.morphTargets[target];
                if (morphTarget && morphTarget.target) {
                    console.log(`✅ ${target}: influence=${morphTarget.target.influence}`);
                } else {
                    console.log(`❌ ${target}: NOT WORKING`);
                }
            });
        }
    } else {
        console.log('❌ Avatar or morphTargets not available');
    }
}

function testAllTargets() {
    if (window.app && window.app.avatar && window.app.avatar.morphTargets) {
        const allTargets = Object.keys(window.app.avatar.morphTargets);
        console.log('🧪 === TESTING ALL MORPH TARGETS ===');
        
        allTargets.forEach((target, index) => {
            setTimeout(() => {
                const morphTarget = window.app.avatar.morphTargets[target];
                if (morphTarget && morphTarget.target) {
                    const originalValue = morphTarget.target.influence;
                    morphTarget.target.influence = 0.7;
                    console.log(`🎭 Testing ${target}: set to 0.7`);
                    
                    setTimeout(() => {
                        morphTarget.target.influence = originalValue;
                    }, 1000);
                }
            }, index * 1200);
        });
    }
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.app && window.app.isTracking) {
        window.app.stopCamera();
    }
});

// Global mouth testing functions for easy console access
function testMouth() {
    if (window.app) {
        console.log('🧪 === MOUTH TESTING ===');
        window.app.forceMouthTest(0.8, 0.6); // Test with strong values
    } else {
        console.log('❌ App not initialized yet');
    }
}

function checkMouthTargets() {
    if (window.app && window.app.avatar) {
        console.log('👄 === COMPREHENSIVE AVATAR ANALYSIS ===');
        const avatar = window.app.avatar;
        
        console.log(`🤖 Avatar type: ${avatar.isFallback ? 'FALLBACK (geometric)' : 'REAL AVATAR'}`);
        
        if (avatar.isFallback) {
            console.log('🔧 Fallback avatar components:');
            console.log(`  - Head: ${!!avatar.head}`);
            console.log(`  - Mouth: ${!!avatar.mouth}`);
            console.log(`  - Left Eye: ${!!avatar.leftEye}`);
            console.log(`  - Right Eye: ${!!avatar.rightEye}`);
            
            if (avatar.mouth) {
                console.log('🧪 Testing fallback mouth scaling...');
                avatar.mouth.scaling = new BABYLON.Vector3(1.5, 2, 1);
                setTimeout(() => {
                    avatar.mouth.scaling = new BABYLON.Vector3(1, 1, 1);
                    console.log('🔄 Reset fallback mouth');
                }, 2000);
            }
        } else {
            if (avatar.morphTargets) {
                const allTargets = Object.keys(avatar.morphTargets);
                console.log(`🎭 TOTAL morph targets: ${allTargets.length}`);
                
                if (allTargets.length > 0) {
                    console.log('📋 ALL available targets:', allTargets);
                    
                    // Categorize targets
                    const categories = {
                        mouth: allTargets.filter(key => key.toLowerCase().includes('mouth')),
                        jaw: allTargets.filter(key => key.toLowerCase().includes('jaw')),
                        smile: allTargets.filter(key => key.toLowerCase().includes('smile')),
                        lip: allTargets.filter(key => key.toLowerCase().includes('lip')),
                        open: allTargets.filter(key => key.toLowerCase().includes('open')),
                        blink: allTargets.filter(key => key.toLowerCase().includes('blink')),
                        eye: allTargets.filter(key => key.toLowerCase().includes('eye')),
                        brow: allTargets.filter(key => key.toLowerCase().includes('brow')),
                        other: allTargets.filter(key => 
                            !key.toLowerCase().includes('mouth') && 
                            !key.toLowerCase().includes('jaw') && 
                            !key.toLowerCase().includes('smile') &&
                            !key.toLowerCase().includes('lip') &&
                            !key.toLowerCase().includes('open') &&
                            !key.toLowerCase().includes('blink') &&
                            !key.toLowerCase().includes('eye') &&
                            !key.toLowerCase().includes('brow')
                        )
                    };
                    
                    Object.entries(categories).forEach(([category, targets]) => {
                        if (targets.length > 0) {
                            console.log(`${category.toUpperCase()}: ${targets.join(', ')}`);
                        }
                    });
                    
                    // Test mouth targets specifically
                    const mouthTargets = [...categories.mouth, ...categories.jaw, ...categories.smile, ...categories.lip, ...categories.open];
                    
                    if (mouthTargets.length > 0) {
                        console.log(`\n🧪 Testing ${mouthTargets.length} mouth-related targets:`);
                        
                        mouthTargets.forEach((target, index) => {
                            setTimeout(() => {
                                console.log(`Testing ${target}...`);
                                if (avatar.morphTargets[target]) {
                                    const original = avatar.morphTargets[target].target.influence;
                                    avatar.morphTargets[target].target.influence = 0.8;
                                    
                                    setTimeout(() => {
                                        avatar.morphTargets[target].target.influence = original;
                                        console.log(`Reset ${target}`);
                                    }, 1000);
                                }
                            }, index * 1500);
                        });
                    } else {
                        console.log('❌ NO MOUTH-RELATED TARGETS FOUND!');
                        console.log('🔍 This avatar may not support facial animation');
                        
                        // Try testing ANY target to see if morph system works
                        if (allTargets.length > 0) {
                            console.log('🧪 Testing first available target to check if morph system works...');
                            const testTarget = allTargets[0];
                            const original = avatar.morphTargets[testTarget].target.influence;
                            avatar.morphTargets[testTarget].target.influence = 0.8;
                            console.log(`Applied 80% to ${testTarget}`);
                            
                            setTimeout(() => {
                                avatar.morphTargets[testTarget].target.influence = original;
                                console.log(`Reset ${testTarget}`);
                            }, 2000);
                        }
                    }
                } else {
                    console.log('❌ Avatar has morphTargets object but no actual targets');
                }
            } else {
                console.log('❌ NO MORPH TARGETS OBJECT - Avatar does not support facial animation');
                
                // Check if we can manually manipulate meshes
                if (avatar.allHeadParts) {
                    console.log(`🦴 Found ${avatar.allHeadParts.length} head parts:`, avatar.allHeadParts.map(m => m.name));
                    
                    const mouthMeshes = avatar.allHeadParts.filter(mesh => 
                        mesh.name.toLowerCase().includes('mouth') ||
                        mesh.name.toLowerCase().includes('lip') ||
                        mesh.name.toLowerCase().includes('teeth') ||
                        mesh.name.toLowerCase().includes('tongue')
                    );
                    
                    if (mouthMeshes.length > 0) {
                        console.log(`👄 Found mouth meshes: ${mouthMeshes.map(m => m.name).join(', ')}`);
                        console.log('🧪 Testing manual mesh scaling...');
                        
                        mouthMeshes.forEach(mesh => {
                            const original = mesh.scaling.clone();
                            mesh.scaling.y = 1.5; // Open mouth
                            mesh.scaling.x = 1.2; // Wider
                            
                            setTimeout(() => {
                                mesh.scaling = original;
                                console.log(`Reset ${mesh.name} scaling`);
                            }, 2000);
                        });
                    } else {
                        console.log('❌ No mouth meshes found either');
                    }
                }
            }
        }
    } else {
        console.log('❌ App not initialized yet');
    }
}

function debugMouth() {
    if (window.app) {
        console.log('👄 === MOUTH DEBUG INFO ===');
        
        if (window.app.landmarks) {
            const mouth = window.app.landmarks.getMouth();
            console.log('👄 Mouth landmarks count:', mouth.length);
            
            const openness = window.app.calculateMouthOpenness();
            console.log('👄 Current mouth openness:', (openness * 100).toFixed(1) + '%');
            
            if (window.app.expressions) {
                console.log('😊 Happy expression:', (window.app.expressions.happy * 100).toFixed(1) + '%');
                console.log('😮 Surprised expression:', (window.app.expressions.surprised * 100).toFixed(1) + '%');
                console.log('😢 Sad expression:', (window.app.expressions.sad * 100).toFixed(1) + '%');
                console.log('😠 Angry expression:', (window.app.expressions.angry * 100).toFixed(1) + '%');
            }
        } else {
            console.log('❌ No landmarks available');
        }
        
        if (window.app.avatar && window.app.avatar.morphTargets) {
            const mouthTargets = Object.keys(window.app.avatar.morphTargets).filter(key => 
                key.toLowerCase().includes('mouth') || 
                key.toLowerCase().includes('jaw') ||
                key.toLowerCase().includes('smile')
            );
            console.log('Available mouth targets:', mouthTargets);
        }
    } else {
        console.log('❌ App not initialized yet');
    }
}

function startAutoMouthTest() {
    if (window.app) {
        window.mouthTestInterval = setInterval(() => {
            if (window.app.landmarks) {
                const openness = window.app.calculateMouthOpenness();
                const smile = window.app.expressions?.happy || 0;
                
                if (openness > 0.1 || smile > 0.1) {
                    console.log(`👄 AUTO TEST - Open: ${(openness*100).toFixed(1)}%, Smile: ${(smile*100).toFixed(1)}%`);
                    window.app.forceMouthTest(openness, smile);
                }
            }
        }, 500); // Test every 500ms
        console.log('🔄 Auto mouth testing started! Use stopAutoMouthTest() to stop.');
    } else {
        console.log('❌ App not initialized yet');
    }
}

// Remove the duplicate app creation - it's now handled in DOMContentLoaded
function stopAutoMouthTest() {
    if (window.mouthTestInterval) {
        clearInterval(window.mouthTestInterval);
        window.mouthTestInterval = null;
        console.log('⏹️ Auto mouth testing stopped.');
    }
}
