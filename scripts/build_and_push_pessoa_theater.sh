#!/bin/bash
set -e

# 🚀 Pessoa.Theater Production Deployment Script
# Single production deployment - no dev environment
# Local build + push + deploy workflow

echo "🎭 Pessoa.Theater Production Deployment"
echo "🌐 Target: https://pessoa.theater"
echo "⚡ Local build + push + deploy workflow"
echo ""

# Get current git info for tagging
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT_SHA=$(git rev-parse --short HEAD)
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
IMAGE_TAG="prod-${BRANCH}-${COMMIT_SHA}-${TIMESTAMP}"

echo "📋 Build Info:"
echo "  Branch: ${BRANCH}"
echo "  Commit: ${COMMIT_SHA}"
echo "  Image Tag: ${IMAGE_TAG}"
echo "  Timestamp: ${TIMESTAMP}"
echo "  Target: https://pessoa.theater"
echo ""

# Check if we have uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes!"
    echo "   Commit your changes first for consistent deployments."
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled."
        exit 1
    fi
fi

echo "📦 Building images locally..."

# Build backend
echo "  🔧 Building backend..."
docker build \
    --build-arg DATABASE_URL="postgres://pessoa_user:password@db:5432/pessoa_db" \
    -t ghcr.io/sportinger/pessoa-backend:${IMAGE_TAG} \
    -t ghcr.io/sportinger/pessoa-backend:latest \
    ./backend

# Build frontend  
echo "  🎨 Building frontend..."
docker build \
    --build-arg VITE_API_BASE_URL="https://pessoa.theater" \
    --build-arg VITE_WS_BASE_URL="wss://pessoa.theater/api/collab" \
    -t ghcr.io/sportinger/pessoa-frontend:${IMAGE_TAG} \
    -t ghcr.io/sportinger/pessoa-frontend:latest \
    -f ./frontend/Dockerfile.https \
    ./frontend

echo ""
echo "🚀 Pushing images to registry..."
docker push ghcr.io/sportinger/pessoa-backend:${IMAGE_TAG}
docker push ghcr.io/sportinger/pessoa-backend:latest
docker push ghcr.io/sportinger/pessoa-frontend:${IMAGE_TAG}
docker push ghcr.io/sportinger/pessoa-frontend:latest

echo ""
echo "🌐 Deploying to pessoa.theater production server..."
ssh roman@pessoa.theater << EOF
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
    echo "🌐 Production Site: https://pessoa.theater"
    echo ""
    
    # Show status
    echo "📊 Container Status:"
    docker compose -f docker-compose.hetzner-github-actions.yml ps
    
    echo ""
    echo "🔍 Quick Health Check:"
    sleep 5
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://pessoa.theater || echo "❌ Site not responding"
EOF

echo ""
echo "🎉 Pessoa.Theater deployment completed!"
echo "   🌐 Production: https://pessoa.theater"
echo "   🛠️  pgAdmin: https://pessoa.theater:5050"
echo "   🏷️  Image tag: ${IMAGE_TAG}"
echo ""
echo "🔗 Next steps:"
echo "   1. Test the site: https://pessoa.theater"
echo "   2. Check pgAdmin: https://pessoa.theater:5050"
echo "   3. Monitor logs: ssh roman@pessoa.theater 'cd /opt/pessoa && docker compose logs -f'"
echo "" 