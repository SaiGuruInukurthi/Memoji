const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'", 
                "'unsafe-eval'", 
                "https://unpkg.com", 
                "https://cdn.jsdelivr.net",
                "https://cdn.babylonjs.com" // Keep for backward compatibility
            ],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https:", "wss:"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:", "mediastream:"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false, // Required for camera access
    permissionsPolicy: {
        camera: ["'self'"],
        microphone: ["'self'"]
    }
}));

// Enable CORS for all routes
app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000'],
    credentials: true
}));

// Enable gzip compression
app.use(compression());

// Serve static files with proper MIME types
app.use(express.static('.', {
    setHeaders: (res, filePath) => {
        // Set proper MIME types for specific files
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.glb')) {
            res.setHeader('Content-Type', 'model/gltf-binary');
        } else if (filePath.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        
        // Cache static assets for better performance
        if (filePath.includes('/models/') || filePath.includes('/avatars/')) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
        }
    }
}));

// API endpoints
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        app: 'Face Avatar App',
        version: '1.0.0',
        features: [
            'Enhanced mouth sensitivity (2x)',
            'Comprehensive tongue detection',
            'Real-time face tracking',
            'Ready Player Me avatar support'
        ],
        timestamp: new Date().toISOString()
    });
});

app.get('/api/models', (req, res) => {
    const fs = require('fs');
    const modelsPath = path.join(__dirname, 'models');
    
    try {
        const files = fs.readdirSync(modelsPath);
        const models = files.filter(file => 
            file.endsWith('.json') || 
            file.startsWith('face_') || 
            file.startsWith('tiny_face_')
        );
        
        res.json({
            available: models.length > 0,
            models: models,
            path: '/models/'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Could not read models directory',
            message: error.message
        });
    }
});

app.get('/api/avatars', (req, res) => {
    const fs = require('fs');
    const avatarsPath = path.join(__dirname, 'avatars');
    
    try {
        const files = fs.readdirSync(avatarsPath);
        const avatars = files.filter(file => 
            file.endsWith('.glb') || 
            file.endsWith('.gltf')
        );
        
        res.json({
            available: avatars.length > 0,
            avatars: avatars,
            path: '/avatars/'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Could not read avatars directory',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        uptime: process.uptime(),
        engine: 'Three.js',
        performance: 'optimized'
    });
});

// Route for MediaPipe version (new default - best accuracy)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-mediapipe.html'));
});

// Route for Three.js version (legacy)
app.get('/threejs', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-threejs.html'));
});

// Route for original Babylon.js version (backward compatibility)
app.get('/babylon', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Direct MediaPipe route
app.get('/mediapipe', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-mediapipe.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.originalUrl} not found`
    });
});

// Start server
app.listen(PORT, () => {
    console.log('\n🚀 ===============================================');
    console.log('     Face Avatar App - Node.js Server');
    console.log('  ===============================================');
    console.log(`🌐 Server running on: http://localhost:${PORT}`);
    console.log(`📱 Local access: http://127.0.0.1:${PORT}`);
    console.log('🎭 Features:');
    console.log('   ✅ Enhanced mouth sensitivity (2x)');
    console.log('   ✅ Comprehensive tongue detection');
    console.log('   ✅ Real-time face tracking');
    console.log('   ✅ Ready Player Me avatar support');
    console.log('\n📋 Available endpoints:');
    console.log(`   🔍 Status: http://localhost:${PORT}/api/status`);
    console.log(`   🤖 Models: http://localhost:${PORT}/api/models`);
    console.log(`   👤 Avatars: http://localhost:${PORT}/api/avatars`);
    console.log(`   💓 Health: http://localhost:${PORT}/health`);
    console.log('\n🛑 Press Ctrl+C to stop the server');
    console.log('===============================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    process.exit(0);
});
