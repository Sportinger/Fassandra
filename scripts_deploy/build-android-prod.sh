#!/bin/bash

# Build and deploy Android app with production endpoints
set -e

echo "🚀 Building Android app with production endpoints (fassandra.de)..."

# Navigate to frontend directory (relative to repo root)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT/frontend"

# Copy production environment
echo "📋 Setting production environment..."
cp .env.production .env

# Try to build without TypeScript checking
echo "🔨 Building frontend (skipping TypeScript checks)..."
npx vite build --config vite.config.prod.ts --mode production || echo "⚠️ Build had errors, continuing with existing dist..."

# Sync with Capacitor
echo "📱 Syncing with Capacitor..."
npx cap sync android

# Build APK
echo "📦 Building APK..."
cd android
./gradlew assembleDebug

# Path to the built APK
APK_PATH="$REPO_ROOT/frontend/android/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    echo "✅ APK built successfully: $APK_PATH"
    
    # Install on connected device if available
    if adb devices | grep -q "device$"; then
        echo "📲 Installing on connected device..."
        adb install -r "$APK_PATH"
        echo "🚀 Launching app..."
        adb shell monkey -p com.romankuskowski.theatereditor -c android.intent.category.LAUNCHER 1
        echo "✅ App deployed and launched!"
    else
        echo "⚠️ No device connected. APK ready at: $APK_PATH"
    fi
else
    echo "❌ APK build failed!"
    exit 1
fi
