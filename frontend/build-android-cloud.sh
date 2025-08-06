#!/bin/bash

echo "🚀 Building Pessoa Android APK for Cloud Production (pessoa.theater)..."

# Save current environment if exists
if [ -f .env.production ]; then
    cp .env.production .env.production.backup
fi

# Set production environment for mylayer.org
cat > .env.production << EOF
# Production environment for Android APK
# Points to mylayer.org backend
VITE_API_BASE_URL=https://mylayer.org
VITE_WS_BASE_URL=wss://mylayer.org/api/collab
EOF

# Update Capacitor config for production
cat > capacitor.config.json << EOF
{
  "appId": "com.pessoa.app",
  "appName": "Pessoa",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "cleartext": false,
    "allowNavigation": ["https://mylayer.org/*", "https://www.mylayer.org/*", "https://91.99.69.115/*"]
  }
}
EOF

echo "📦 Building production bundle..."
npm run build -- --mode production

echo "🔄 Syncing with Capacitor..."
npx cap sync android

echo "📱 Building APK (this may take a few minutes)..."
cd android

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
        echo "   adb install -r $APK_PATH"
        echo ""
        echo "🔗 Your app will connect to: https://mylayer.org"
        echo "🔗 Backend IP: 91.99.69.115"
    else
        echo "❌ APK build completed but file not found"
    fi
else
    echo "❌ Build failed."
fi

# Return to frontend directory
cd ..

# Restore backup if it exists
if [ -f .env.production.backup ]; then
    echo "🔄 Restoring original .env.production..."
    mv .env.production.backup .env.production
fi