#!/bin/bash

# Script to run Pessoa app on Android device in development mode

set -e
echo "🚀 Starting Pessoa Android Development Server..."

# Resolve directories
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
ANDROID_DIR="$REPO_ROOT/android"

# Kill any existing vite processes on port 5173
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "📡 Using IP: $LOCAL_IP"

# Update .env.android with current IP (in frontend)
cat > "$FRONTEND_DIR/.env.android" << EOF
# Environment variables for Android development
# This file is used when running the app on Android devices

# Point to your local backend running in Docker
VITE_API_BASE_URL=http://$LOCAL_IP:3000
VITE_BACKEND_URL=http://$LOCAL_IP:3000

# WebSocket URL for real-time collaboration
VITE_WS_URL=ws://$LOCAL_IP:3000
EOF

# Update Capacitor config with current IP (in frontend)
cat > "$FRONTEND_DIR/capacitor.config.json" << EOF
{
  "appId": "com.pessoa.app",
  "appName": "Pessoa",
  "webDir": "dist",
  "server": {
    "androidScheme": "http",
    "cleartext": true,
    "url": "http://$LOCAL_IP:5173",
    "allowNavigation": ["*"]
  }
}
EOF

# Start Vite dev server with Android environment
echo "🔧 Starting Vite dev server with Android configuration..."
echo "📡 Backend URL: http://$LOCAL_IP:3000"
echo "📱 Frontend URL: http://$LOCAL_IP:5173"

# Load Android environment variables and start Vite
pushd "$FRONTEND_DIR" >/dev/null
npx vite --host --port 5173 --mode android &
VITE_PID=$!

# Wait for server to start
sleep 3

# Check if device is connected
if ! adb devices | grep -q "device$"; then
    echo "❌ No Android device connected. Please connect your device with USB debugging enabled."
    kill $VITE_PID 2>/dev/null
    popd >/dev/null
    exit 1
fi

echo "📱 Device connected!"
echo ""
echo "✅ Development server running at: http://$LOCAL_IP:5173"
echo "🔗 Backend API available at: http://$LOCAL_IP:3000"
echo ""
echo "📌 Next steps:"
echo "1. Open Chrome on your Android device"
echo "2. Navigate to: http://$LOCAL_IP:5173"
echo "3. You should see the Pessoa app connected to your local backend!"
echo ""
echo "Press Ctrl+C to stop the server"

# Cleanup function
cleanup() {
    echo "🛑 Stopping servers..."
    kill $VITE_PID 2>/dev/null
    popd >/dev/null
    exit 0
}

# Set up trap for Ctrl+C
trap cleanup INT

# Keep script running
wait $VITE_PID
