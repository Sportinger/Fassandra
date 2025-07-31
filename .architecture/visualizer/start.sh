#!/bin/bash

echo "🏛️  Starting Pessoa Architecture Visualizer..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🚀 Starting server on http://localhost:3456"
echo ""
npm start 