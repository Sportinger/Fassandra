#!/bin/bash

# Build script for testing APK on your phone

echo "================================================"
echo "Theater Editor - Test APK Build"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if keystore exists
if [ ! -f "theater-editor-release.keystore" ]; then
    echo -e "${YELLOW}⚠️  No release keystore found, building debug APK instead${NC}"
    BUILD_TYPE="Debug"
    GRADLE_TASK="assembleDebug"
    OUTPUT_PATH="app/build/outputs/apk/debug/app-debug.apk"
else
    echo -e "${GREEN}✅ Release keystore found, building signed APK${NC}"
    BUILD_TYPE="Release"
    GRADLE_TASK="assembleRelease"
    OUTPUT_PATH="app/build/outputs/apk/release/app-release.apk"
fi

echo ""
echo -e "${YELLOW}Building $BUILD_TYPE APK...${NC}"

# Clean previous builds
./gradlew clean

# Build the APK
./gradlew $GRADLE_TASK

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 BUILD SUCCESSFUL!${NC}"
    echo ""
    echo "$BUILD_TYPE APK location:"
    echo "  $OUTPUT_PATH"
    echo ""
    
    # Show file size
    if [ -f "$OUTPUT_PATH" ]; then
        SIZE=$(ls -lh "$OUTPUT_PATH" | awk '{print $5}')
        echo "APK file size: $SIZE"
        echo ""
        echo "To install on your phone:"
        echo "1. Enable 'Install from Unknown Sources' in your phone settings"
        echo "2. Transfer the APK file to your phone via:"
        echo "   - Email it to yourself"
        echo "   - Upload to Google Drive/Dropbox"
        echo "   - Use adb: adb install $OUTPUT_PATH"
        echo "   - Use a file transfer app"
        echo ""
        
        # Copy to an easy-to-find location
        cp "$OUTPUT_PATH" "../theater-editor-test.apk"
        echo "APK also copied to: frontend/theater-editor-test.apk"
    fi
else
    echo ""
    echo -e "${RED}❌ Build failed!${NC}"
    echo "Please check the error messages above."
    exit 1
fi