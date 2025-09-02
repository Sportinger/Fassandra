#!/bin/bash

# Build script for Theater Editor release AAB (Android App Bundle)

echo "================================================"
echo "Theater Editor - Release Build Script"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if keystore exists
if [ ! -f "theater-editor-release.keystore" ]; then
    echo -e "${RED}❌ Error: Keystore file not found!${NC}"
    echo ""
    echo "Please run ./generate-keystore.sh first to create your release keystore."
    exit 1
fi

if [ ! -f "keystore.properties" ]; then
    echo -e "${RED}❌ Error: keystore.properties file not found!${NC}"
    echo ""
    echo "Please run ./generate-keystore.sh first to create your keystore configuration."
    exit 1
fi

# Step 1: Build the React app
echo -e "${YELLOW}Step 1: Building React app...${NC}"
cd ..
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ React build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ React app built successfully${NC}"
echo ""

# Step 2: Sync with Capacitor
echo -e "${YELLOW}Step 2: Syncing with Capacitor...${NC}"
npx cap sync android
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Capacitor sync failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Capacitor sync completed${NC}"
echo ""

# Step 3: Build the AAB
echo -e "${YELLOW}Step 3: Building Android App Bundle (AAB)...${NC}"
cd android

# Clean previous builds
./gradlew clean

# Build the release AAB
./gradlew bundleRelease

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 BUILD SUCCESSFUL!${NC}"
    echo ""
    echo "Release AAB location:"
    echo "  app/build/outputs/bundle/release/app-release.aab"
    echo ""
    echo "Next steps:"
    echo "1. Upload the AAB file to Google Play Console"
    echo "2. Fill in the store listing details"
    echo "3. Complete the content rating questionnaire"
    echo "4. Set up pricing and distribution"
    echo "5. Submit for review"
    echo ""
    
    # Show file size
    AAB_FILE="app/build/outputs/bundle/release/app-release.aab"
    if [ -f "$AAB_FILE" ]; then
        SIZE=$(ls -lh "$AAB_FILE" | awk '{print $5}')
        echo "AAB file size: $SIZE"
    fi
else
    echo ""
    echo -e "${RED}❌ Build failed!${NC}"
    echo "Please check the error messages above."
    exit 1
fi