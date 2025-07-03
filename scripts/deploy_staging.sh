#!/bin/bash
set -e

# 🧪 Staging Build + Push + Deploy Script
# For testing experimental features before production
# Deploys to port 8444 instead of 8443

echo "🧪 Development build + push + deploy to dev server..."
echo "⚡ Safe development environment for experimental features!"
echo ""

# Get current git info for tagging
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT_SHA=$(git rev-parse --short HEAD)
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
IMAGE_TAG="staging-${BRANCH}-${COMMIT_SHA}-${TIMESTAMP}"

echo "📋 Development Build Info:"
echo "  Branch: ${BRANCH}"
echo "  Commit: ${COMMIT_SHA}"
echo "  Image Tag: ${IMAGE_TAG}"
echo "  Timestamp: ${TIMESTAMP}"
echo "  Target: https://mylayer.org:8444 (Dev Environment)"
echo ""

# Check if we have uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes!"
    echo "   This is OK for development - testing experimental features."
    echo "   Continuing automatically..."
fi

echo "📦 Building development images locally..."

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
echo "🚀 Pushing development images to registry..."
docker push ghcr.io/sportinger/pessoa-backend:${IMAGE_TAG}
docker push ghcr.io/sportinger/pessoa-frontend:${IMAGE_TAG}

echo ""
echo "🌐 Deploying to development server..."
ssh roman@mylayer.org << EOF
    cd ~/pessoa-staging
    
    echo "📥 Updating development server configuration..."
    
    # Update .env with new image tag
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" .env
    echo "Updated development IMAGE_TAG to: ${IMAGE_TAG}"
    
    echo "📦 Pulling new development images..."
    docker compose -f docker-compose.staging.yml pull
    
    echo "🔄 Restarting development services..."
    docker compose -f docker-compose.staging.yml up -d
    
    echo ""
    echo "✅ Development deployment complete!"
    echo "🧪 Development Site: https://mylayer.org:8444"
    echo "🌐 Production Site: https://pessoa.theater"
    echo ""
    
    # Show status
    docker compose -f docker-compose.staging.yml ps
EOF

echo ""
echo "🎉 Development build + push + deploy completed!"
echo "   🧪 Development: https://mylayer.org:8444"
echo "   🌐 Production: https://pessoa.theater"
echo "   Image tag: ${IMAGE_TAG}"
echo ""
echo "💡 Test your changes on development first, then use ./scripts/build_and_push.sh for production!"
echo "" 