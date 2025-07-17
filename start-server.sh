#!/bin/bash

echo "========================================="
echo "   Face Avatar App - Node.js Server"
echo "========================================="
echo

# Check if Node.js is installed
if command -v node >/dev/null 2>&1; then
    echo "✅ Node.js found! Version: $(node --version)"
    echo
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing npm packages..."
        npm install
        echo
    fi
    
    echo "🚀 Starting Face Avatar App server on port 8000..."
    echo
    echo "🌐 Open your browser and go to: http://localhost:8000"
    echo "📱 Or try: http://127.0.0.1:8000"
    echo
    echo "🛑 Press Ctrl+C to stop the server"
    echo
    
    # Start the server
    npm start
    
else
    echo "❌ Node.js not found!"
    echo
    echo "Please install Node.js from: https://nodejs.org/download"
    echo
    echo "Alternative options:"
    echo "1. Use Python if available:"
    echo "   python3 -m http.server 8000"
    echo
    echo "2. Use VS Code with Live Server extension:"
    echo "   - Install 'Live Server' extension"
    echo "   - Right-click index.html and select 'Open with Live Server'"
    echo
fi
