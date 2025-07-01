#!/bin/bash

# Setup script to enable HTTPS for the frontend application

set -e

echo "🚀 Setting up HTTPS for your frontend application..."
echo ""

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL is required but not installed. Please install it first:"
    echo "   - Ubuntu/Debian: sudo apt-get install openssl"
    echo "   - macOS: brew install openssl"
    echo "   - Windows: Download from https://slproweb.com/products/Win32OpenSSL.html"
    exit 1
fi

echo "✅ OpenSSL found"

# Make the certificate generation script executable
chmod +x generate-ssl-certs.sh

# Generate SSL certificates
echo "📋 Step 1: Generating SSL certificates..."
./generate-ssl-certs.sh

echo ""
echo "📋 Step 2: Setting up environment..."

# Copy the HTTPS environment file
if [ -f "env.https" ]; then
    echo "   Creating backup of current env.local..."
    cp env.local env.local.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    echo "   Setting up HTTPS environment variables..."
    cp env.https env.local
    echo "✅ Environment configured for HTTPS"
else
    echo "❌ env.https file not found!"
    exit 1
fi

echo ""
echo "📋 Step 3: Updating Docker configuration..."

# Backup existing docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    echo "   Creating backup of current docker-compose.yml..."
    cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)
fi

# Use the HTTPS docker-compose file
cp docker-compose.https.yml docker-compose.yml
echo "✅ Docker Compose configured for HTTPS"

echo ""
echo "🎉 HTTPS setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Stop your current containers: docker-compose down"
echo "   2. Rebuild and start with HTTPS: docker-compose up --build"
echo "   3. Access your application at: https://192.168.2.111:8443"
echo ""
echo "⚠️  Important notes:"
echo "   • Your browser will show a security warning for self-signed certificates"
echo "   • Click 'Advanced' -> 'Proceed to site' to continue"
echo "   • For production, replace self-signed certificates with proper SSL certificates"
echo ""
echo "🔄 To revert to HTTP:"
echo "   • Restore from backup files (*.backup.*)"
echo "   • Or run: git checkout env.local docker-compose.yml" 