#!/bin/bash
set -e

# 🚀 Local Build + Push + Deploy Script
# Complete local workflow: Build -> Push -> Deploy
# No GitHub Actions needed!

echo "🏗️  Local build + push + deploy to production server..."
echo "⚡ Full control over your deployment process!"
echo ""

# Get current git info for tagging
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT_SHA=$(git rev-parse --short HEAD)
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
IMAGE_TAG="local-${BRANCH}-${COMMIT_SHA}-${TIMESTAMP}"

echo "📋 Build Info:"
echo "  Branch: ${BRANCH}"
echo "  Commit: ${COMMIT_SHA}"
echo "  Image Tag: ${IMAGE_TAG}"
echo "  Timestamp: ${TIMESTAMP}"
echo ""

# Check if we have uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes!"
    echo "   Commit your changes first for consistent deployments."
    echo "   Continuing automatically..."
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
    --build-arg VITE_API_BASE_URL="" \
    --build-arg VITE_WS_BASE_URL="" \
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
echo "🎉 Local build + push + deploy completed!"
echo "   Your changes are now live at: https://mylayer.org:8443"
echo "   Image tag: ${IMAGE_TAG}"
echo "" 