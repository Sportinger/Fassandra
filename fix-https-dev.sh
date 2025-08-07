#!/bin/bash

echo "🔧 Fixing HTTPS Development Environment"
echo "========================================"

# Step 1: Install DOMPurify in the running container as a quick fix
echo "📦 Installing DOMPurify in running container..."
docker exec dev_pessoa_frontend npm install dompurify@3.2.6 @types/dompurify@3.0.5

# Step 2: Restart the container to apply changes
echo "🔄 Restarting frontend container..."
docker restart dev_pessoa_frontend

echo ""
echo "✅ Quick fix applied!"
echo ""
echo "The container now has DOMPurify installed."
echo "HTTPS should work again at: https://192.168.2.111:8080"
echo ""
echo "⚠️  Note: This is a temporary fix. For a permanent solution:"
echo "   Run: ./deploy.dev.sh --no-cache"
echo ""
echo "📝 To accept the self-signed certificate:"
echo "   1. Open https://192.168.2.111:8080 in your browser"
echo "   2. Click 'Advanced' and accept the certificate"
echo ""