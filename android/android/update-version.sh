#!/bin/bash

# Version update script for Theater Editor

echo "================================================"
echo "Theater Editor - Version Update Tool"
echo "================================================"
echo ""

# Read current version from build.gradle
CURRENT_VERSION_CODE=$(grep "versionCode" app/build.gradle | head -1 | awk '{print $2}')
CURRENT_VERSION_NAME=$(grep "versionName" app/build.gradle | head -1 | awk '{print $2}' | tr -d '"')

echo "Current version:"
echo "  Version Code: $CURRENT_VERSION_CODE"
echo "  Version Name: $CURRENT_VERSION_NAME"
echo ""

# Parse current version name (e.g., 1.0.0)
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION_NAME"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

echo "Select version bump type:"
echo "1) Patch (1.0.0 -> 1.0.1) - Bug fixes"
echo "2) Minor (1.0.0 -> 1.1.0) - New features"
echo "3) Major (1.0.0 -> 2.0.0) - Breaking changes"
echo "4) Custom version"
echo -n "Enter choice (1-4): "
read CHOICE

case $CHOICE in
    1)
        PATCH=$((PATCH + 1))
        ;;
    2)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    3)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    4)
        echo -n "Enter new version name (e.g., 1.2.3): "
        read NEW_VERSION_NAME
        IFS='.' read -ra VERSION_PARTS <<< "$NEW_VERSION_NAME"
        MAJOR=${VERSION_PARTS[0]}
        MINOR=${VERSION_PARTS[1]}
        PATCH=${VERSION_PARTS[2]}
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

NEW_VERSION_NAME="$MAJOR.$MINOR.$PATCH"
NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))

echo ""
echo "New version will be:"
echo "  Version Code: $NEW_VERSION_CODE"
echo "  Version Name: $NEW_VERSION_NAME"
echo ""
echo -n "Proceed with update? (y/n): "
read CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Version update cancelled"
    exit 0
fi

# Update build.gradle
sed -i "s/versionCode $CURRENT_VERSION_CODE/versionCode $NEW_VERSION_CODE/" app/build.gradle
sed -i "s/versionName \"$CURRENT_VERSION_NAME\"/versionName \"$NEW_VERSION_NAME\"/" app/build.gradle

# Update package.json in frontend
cd ..
if [ -f "package.json" ]; then
    # Update version in package.json
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION_NAME\"/" package.json
    echo "✅ Updated package.json"
fi

cd android

echo ""
echo "✅ Version updated successfully!"
echo ""
echo "New version:"
echo "  Version Code: $NEW_VERSION_CODE (Play Store internal version)"
echo "  Version Name: $NEW_VERSION_NAME (User-visible version)"
echo ""
echo "Remember to:"
echo "1. Test the app thoroughly"
echo "2. Update release notes"
echo "3. Commit the version changes"
echo "4. Tag the release in git: git tag v$NEW_VERSION_NAME"