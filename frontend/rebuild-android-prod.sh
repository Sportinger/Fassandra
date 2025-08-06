#!/bin/bash

# Script to rebuild the Android app with production backend configuration
# This ensures the app connects to the same backend as the browser

echo "🚀 Building Android app with production backend configuration..."

# Navigate to frontend directory
cd "$(dirname "$0")"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist
rm -rf android/app/src/main/assets/public

# Clean any .local files that might override production settings
echo "🔧 Ensuring clean production environment..."
rm -f .env.local .env.production.local .env.android.local

# Copy Android env file to production position for the build
echo "📱 Setting up Android environment..."
cp .env.android .env.production.local

# Use production environment for build (will now use .env.android via .env.production.local)
echo "📦 Building with Android production environment..."
echo "📋 Using configuration: $(grep VITE_API_BASE_URL .env.production.local)"
npm run build -- --mode production

# Clean up after build
rm -f .env.production.local

# Sync with Capacitor
echo "🔄 Syncing with Capacitor..."
npx cap sync android

# Copy the production config to Android assets
echo "📋 Copying production configuration..."
cp capacitor.config.json android/app/src/main/assets/capacitor.config.json

echo "✅ Build complete! The Android app is now configured to use the production backend."
echo "📱 To run on device: npx cap run android"
echo "🏗️ To build APK: cd android && ./gradlew assembleDebug"