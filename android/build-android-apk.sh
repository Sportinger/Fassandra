#!/bin/bash

set -e
echo "🚀 Building Fassandra Android APK..."

# Resolve directories
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
ANDROID_DIR="$REPO_ROOT/android"

# Get local IP for backend connection
LOCAL_IP=$(hostname -I | awk '{print $1}')

# Update production environment with local backend (in frontend)
cat > "$FRONTEND_DIR/.env.production" << EOF
# Production environment for Android APK
VITE_API_BASE_URL=http://$LOCAL_IP:3000
VITE_BACKEND_URL=http://$LOCAL_IP:3000
VITE_WS_URL=ws://$LOCAL_IP:3000
EOF

# Update Capacitor config JSON used for native app assets
cat > "$FRONTEND_DIR/capacitor.config.json" << EOF
{
  "appId": "com.pessoa.app",
  "appName": "Fassandra",
  "webDir": "dist",
  "server": {
    "androidScheme": "http",
    "cleartext": true,
    "allowNavigation": ["http://$LOCAL_IP:3000/*"]
  }
}
EOF

echo "📦 Building production bundle..."
pushd "$FRONTEND_DIR" >/dev/null
npx vite build --mode production

echo "🔄 Syncing with Capacitor..."
npx cap sync android
popd >/dev/null

echo "📱 Building APK (this may take a few minutes)..."
cd "$ANDROID_DIR"

# Use bundled gradle with Java 17 workaround
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=~/Android/Sdk

# Try to build with workarounds
./gradlew assembleDebug -Pandroid.injected.build.model.only.versioned=3

if [ $? -eq 0 ]; then
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
    if [ -f "$APK_PATH" ]; then
        echo "✅ APK built successfully!"
        echo "📍 Location: android/$APK_PATH"
        echo ""
        echo "📲 To install on your phone:"
        echo "1. adb install $APK_PATH"
        echo "   OR"
        echo "2. Copy the APK to your phone and install manually"
        echo ""
        echo "🔗 Your app will connect to backend at: http://$LOCAL_IP:3000"
    else
        echo "❌ APK build completed but file not found"
    fi
else
    echo "❌ Build failed. Trying alternative approach..."
    echo ""
    echo "🔧 Alternative: Use Capacitor Live Update"
    echo "1. Install the Ionic DevApp on your phone"
    echo "2. Run: ionic serve --external"
    echo "3. Open DevApp and connect to: http://$LOCAL_IP:8100"
fi
