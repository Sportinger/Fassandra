#!/bin/bash
set -e

# 📦 Push Current Build Script
# Pushes already-built local images to production server
# Use this when you've already built images and just want to deploy them

echo "📦 Push current build to production server..."
echo "⚡ No rebuild - just push already-built images!"
echo ""

# Check if user provided a specific image tag
if [ "$1" != "" ]; then
    IMAGE_TAG="$1"
    echo "📋 Using provided image tag: ${IMAGE_TAG}"
else
    # Show available local images and let user choose
    echo "🔍 Available local images:"
    echo ""
    
    # List backend images
    echo "Backend images:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | grep "pessoa-backend" || echo "  No backend images found"
    echo ""
    
    # List frontend images  
    echo "Frontend images:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | grep "pessoa-frontend" || echo "  No frontend images found"
    echo ""
    
    read -p "Enter image tag to push (e.g., local-main-abc123-20250128-143500): " IMAGE_TAG
    
    if [ "$IMAGE_TAG" = "" ]; then
        echo "❌ No image tag provided"
        exit 1
    fi
fi

# Check if images exist locally
BACKEND_IMAGE="ghcr.io/sportinger/pessoa-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="ghcr.io/sportinger/pessoa-frontend:${IMAGE_TAG}"

if ! docker image inspect "$BACKEND_IMAGE" >/dev/null 2>&1; then
    echo "❌ Backend image not found: $BACKEND_IMAGE"
    echo "   Build it first with: ./scripts/build_and_push.sh"
    exit 1
fi

if ! docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1; then
    echo "❌ Frontend image not found: $FRONTEND_IMAGE"
    echo "   Build it first with: ./scripts/build_and_push.sh"
    exit 1
fi

echo ""
echo "✅ Both images found locally"
echo "  Backend: $BACKEND_IMAGE"
echo "  Frontend: $FRONTEND_IMAGE"
echo ""

echo "🚀 Pushing images to registry..."
docker push "$BACKEND_IMAGE"
docker push "$FRONTEND_IMAGE"

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
echo "🎉 Push current build completed!"
echo "   Your images are now live at: https://mylayer.org:8443"
echo "   Image tag: ${IMAGE_TAG}"
echo "" 