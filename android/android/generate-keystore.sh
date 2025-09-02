#!/bin/bash

# Script to generate a release keystore for the Theater Editor app
# This keystore will be used to sign the app for Play Store release

echo "================================================"
echo "Theater Editor - Release Keystore Generator"
echo "================================================"
echo ""
echo "This script will create a keystore for signing your app."
echo "Keep this keystore file and passwords SAFE - you'll need them for all future updates!"
echo ""

# Default values
KEYSTORE_NAME="theater-editor-release.keystore"
KEY_ALIAS="theater-editor-key"
VALIDITY_DAYS=10950  # 30 years

# Prompt for keystore password
echo -n "Enter keystore password (min 6 characters): "
read -s KEYSTORE_PASSWORD
echo ""

echo -n "Confirm keystore password: "
read -s KEYSTORE_PASSWORD_CONFIRM
echo ""

if [ "$KEYSTORE_PASSWORD" != "$KEYSTORE_PASSWORD_CONFIRM" ]; then
    echo "Error: Passwords don't match!"
    exit 1
fi

if [ ${#KEYSTORE_PASSWORD} -lt 6 ]; then
    echo "Error: Password must be at least 6 characters!"
    exit 1
fi

# Prompt for key password (can be same as keystore password)
echo -n "Enter key password (press Enter to use same as keystore password): "
read -s KEY_PASSWORD
echo ""

if [ -z "$KEY_PASSWORD" ]; then
    KEY_PASSWORD=$KEYSTORE_PASSWORD
fi

# Prompt for developer information
echo ""
echo "Enter your developer information for the certificate:"
echo -n "Your full name: "
read DEVELOPER_NAME

echo -n "Organizational unit (e.g., Development): "
read ORG_UNIT

echo -n "Organization name: "
read ORG_NAME

echo -n "City/Locality: "
read CITY

echo -n "State/Province: "
read STATE

echo -n "Country code (2 letters, e.g., US, GB, DE): "
read COUNTRY

# Generate the keystore
echo ""
echo "Generating keystore..."

keytool -genkey -v \
    -keystore "$KEYSTORE_NAME" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity $VALIDITY_DAYS \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    -dname "CN=$DEVELOPER_NAME, OU=$ORG_UNIT, O=$ORG_NAME, L=$CITY, ST=$STATE, C=$COUNTRY"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Keystore generated successfully!"
    echo ""
    echo "IMPORTANT - Save this information securely:"
    echo "==========================================="
    echo "Keystore file: $KEYSTORE_NAME"
    echo "Key alias: $KEY_ALIAS"
    echo "Keystore password: [KEEP SECURE]"
    echo "Key password: [KEEP SECURE]"
    echo ""
    
    # Create keystore.properties file
    echo "Creating keystore.properties file..."
    cat > keystore.properties << EOF
storePassword=$KEYSTORE_PASSWORD
keyPassword=$KEY_PASSWORD
keyAlias=$KEY_ALIAS
storeFile=../$KEYSTORE_NAME
EOF
    
    echo "✅ keystore.properties file created"
    echo ""
    echo "⚠️  SECURITY NOTES:"
    echo "1. Add 'keystore.properties' and '*.keystore' to .gitignore"
    echo "2. Back up your keystore file in a secure location"
    echo "3. Never share your keystore or passwords"
    echo "4. You MUST use this same keystore for all future app updates"
    echo ""
    echo "Next steps:"
    echo "1. The build.gradle has been configured to use this keystore"
    echo "2. Run './build-release.sh' to build the release AAB"
else
    echo ""
    echo "❌ Error generating keystore. Please try again."
    exit 1
fi