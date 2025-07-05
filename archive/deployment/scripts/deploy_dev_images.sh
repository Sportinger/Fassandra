#!/bin/bash
set -e

# 🚀 Deploy Dev Branch Images from GitHub Actions
# Uses pre-built images from GitHub Actions (no local building required)

echo "📦 Deploying dev branch images from GitHub Actions..."
echo "⚡ Using pre-built images - super fast deployment!"
echo ""

echo "🌐 Deploying to production server..."
ssh roman@mylayer.org << 'EOF'
    cd /opt/pessoa
    
    echo "📥 Updating server configuration for dev images..."
    
    # Update .env to use dev tag
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=dev/" .env
    echo "Updated IMAGE_TAG to: dev"
    
    echo "📦 Pulling dev images from registry..."
    docker compose -f docker-compose.hetzner-github-actions.yml pull
    
    echo "🔄 Restarting services..."
    docker compose -f docker-compose.hetzner-github-actions.yml up -d
    
    echo ""
    echo "✅ Dev deployment complete!"
    echo "🌐 Site: https://mylayer.org:8443"
    echo "🧪 Test: https://pessoa.com.de:8443"
    echo ""
    
    # Show status
    echo "📊 Container Status:"
    docker compose -f docker-compose.hetzner-github-actions.yml ps
    
    echo ""
    echo "📋 Current Images:"
    docker images | grep pessoa | head -5
EOF

echo ""
echo "🎉 Dev branch deployment completed!"
echo "   Your dev branch changes are now live!"
echo "" 