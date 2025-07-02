#!/bin/bash
set -e

# 🚀 Fast Development Deployment Script
# Builds locally (much faster than GitHub Actions) and deploys to production

echo "🏗️  Fast local build + deploy to production server..."
echo "⚡ This is ~3x faster than waiting for GitHub Actions!"
echo ""

# Get current git info for tagging
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT_SHA=$(git rev-parse --short HEAD)
IMAGE_TAG="local-${BRANCH}-${COMMIT_SHA}"

echo "📋 Build Info:"
echo "  Branch: ${BRANCH}"
echo "  Commit: ${COMMIT_SHA}"
echo "  Image Tag: ${IMAGE_TAG}"
echo ""

# Check if we have uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes!"
    echo "   Commit your changes first for consistent deployments."
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted"
        exit 1
    fi
fi

echo "📦 Building images locally..."

# Build backend
echo "  🔧 Building backend..."
docker build \
    --build-arg DATABASE_URL="postgres://pessoa_user:pessoa_password@db:5432/pessoa_db" \
    -t ghcr.io/sportinger/pessoa-backend:${IMAGE_TAG} \
    ./backend

# Build frontend  
echo "  🎨 Building frontend..."
docker build \
    --build-arg VITE_API_BASE_URL="https://mylayer.org:8443" \
    --build-arg VITE_WS_BASE_URL="wss://mylayer.org:8443/api/collab" \
    -t ghcr.io/sportinger/pessoa-frontend:${IMAGE_TAG} \
    -f ./frontend/Dockerfile.https \
    ./frontend

echo ""
echo "🚀 Pushing images to registry..."
docker push ghcr.io/sportinger/pessoa-backend:${IMAGE_TAG}
docker push ghcr.io/sportinger/pessoa-frontend:${IMAGE_TAG}

echo ""
echo "🌐 Deploying to production server..."
ssh roman@mylayer.org << EOF
    cd /opt/pessoa
    
    echo "📥 Updating server configuration..."
    
    # Update .env with new image tag
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" .env
    echo "Updated IMAGE_TAG to: ${IMAGE_TAG}"
    
    echo "📦 Pulling new images..."
    docker compose -f docker-compose.hetzner-github-actions.yml pull
    
    echo "🔄 Restarting services..."
    docker compose -f docker-compose.hetzner-github-actions.yml up -d
    
    echo ""
    echo "✅ Deployment complete!"
    echo "🌐 Site: https://mylayer.org:8443"
    echo "🧪 Test: https://pessoa.com.de:8443"
    echo ""
    
    # Show status
    docker compose -f docker-compose.hetzner-github-actions.yml ps
EOF

echo ""
echo "🎉 Fast deployment completed!"
echo "   Build + Deploy time: Much faster than GitHub Actions"
echo "   Your changes are now live at: https://mylayer.org:8443"
echo "" 