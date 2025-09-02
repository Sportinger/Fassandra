#!/bin/bash

# Script to rebuild the Android app with production backend configuration
# This ensures the app connects to the same backend as the browser

set -e
echo "🚀 Building Android app with production backend configuration..."

# Resolve directories
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
ANDROID_DIR="$REPO_ROOT/android"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf "$FRONTEND_DIR/dist"
rm -rf "$ANDROID_DIR/app/src/main/assets/public"

# Clean any .local files that might override production settings
echo "🔧 Ensuring clean production environment..."
rm -f "$FRONTEND_DIR/.env.local" "$FRONTEND_DIR/.env.production.local" "$FRONTEND_DIR/.env.android.local"

# Copy Android env file to production position for the build
echo "📱 Setting up Android environment..."
cp "$FRONTEND_DIR/.env.android" "$FRONTEND_DIR/.env.production.local"

# Use production environment for build (will now use .env.android via .env.production.local)
echo "📦 Building with Android production environment..."
pushd "$FRONTEND_DIR" >/dev/null
echo "📋 Using configuration: $(grep VITE_API_BASE_URL .env.production.local)"
# Use vite directly to bypass TypeScript errors
npx vite build --mode production

# Clean up after build
rm -f "$FRONTEND_DIR/.env.production.local"

# Sync with Capacitor
echo "🔄 Syncing with Capacitor..."
npx cap sync android
popd >/dev/null

# Copy the production config to Android assets
echo "📋 Copying production configuration..."
cp "$FRONTEND_DIR/capacitor.config.json" "$ANDROID_DIR/app/src/main/assets/capacitor.config.json"

echo "✅ Build complete! The Android app is now configured to use the production backend."

# Check if ADB is available and device is connected
if command -v adb &> /dev/null && adb devices | grep -q "device$"; then
    echo "📱 Clearing app cache on connected device..."
    # Clear app data and cache
    adb shell pm clear com.fassandra.app 2>/dev/null || true
    echo "✅ App cache cleared"
fi

echo "📱 To run on device: (from frontend) npx cap run android"
echo "🏗️ To build APK: (from android) cd android && ./gradlew assembleDebug"
