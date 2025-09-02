#!/bin/bash

set -e
echo "🚀 Building Fassandra Android APK for Production (fassandra.de)..."

# Resolve directories
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
ANDROID_DIR="$REPO_ROOT/android"

# Ensure production environment is set correctly (in frontend)
cat > "$FRONTEND_DIR/.env.production" << EOF
# Production environment for Android APK
# Points to fassandra.de backend
VITE_API_BASE_URL=https://fassandra.de
VITE_WS_BASE_URL=wss://fassandra.de/api/collab
EOF

# Update Capacitor config for production (in frontend)
cat > "$FRONTEND_DIR/capacitor.config.json" << EOF
{
  "appId": "com.fassandra.app",
  "appName": "Fassandra",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "cleartext": false,
    "allowNavigation": ["https://fassandra.de/*", "https://91.99.69.115/*"]
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

# Build APK
./gradlew assembleDebug

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
        echo "🔗 Your app will connect to: https://fassandra.de"
    else
        echo "❌ APK build completed but file not found"
    fi
else
    echo "❌ Build failed."
fi
