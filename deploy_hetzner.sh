#!/bin/bash

# Hetzner Production Deployment Script (NON-INTERACTIVE)
# Usage: ./deploy_hetzner.sh

set -e

echo "🌐 Starting Hetzner Production Deployment (Automatic)..."

# Check if we're in the right directory
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Error: docker-compose.prod.yml not found. Please run from project root."
    exit 1
fi

# Create/update Hetzner environment file
echo "📝 Setting up Hetzner production environment..."
cat > .env.hetzner << EOF
# Hetzner Production Environment
APP_HOSTNAME=pessoa.theater
APP_DOMAIN=pessoa.theater
FRONTEND_PORT=80
BACKEND_PORT=3001
DATABASE_PORT=5432
PGADMIN_PORT=5050

# API URLs for production
VITE_API_BASE_URL=https://pessoa.theater
VITE_WS_BASE_URL=wss://pessoa.theater/api/collab

# CORS Origins for production
CORS_ORIGINS=https://pessoa.theater,https://www.pessoa.theater
ALLOWED_ORIGINS=https://pessoa.theater,https://www.pessoa.theater

# Database configuration
DATABASE_URL=postgresql://postgres:password@db:5432/pessoa_db
POSTGRES_DB=pessoa_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# PgAdmin configuration
PGADMIN_DEFAULT_EMAIL=admin@pessoa.theater
PGADMIN_DEFAULT_PASSWORD=admin123

# Environment
ENVIRONMENT=production
RUST_LOG=info

# GitHub Container Registry
DOCKER_REGISTRY=ghcr.io/sportinger
IMAGE_TAG=latest
EOF

# Check if we're running locally (for build and push) or on server (for deploy only)
if [ "$1" = "--deploy-only" ]; then
    echo "🚀 Deploy-only mode: Skipping build and push..."
    DEPLOY_ONLY=true
else
    echo "🔨 Full deployment: Will build, push, and deploy..."
    DEPLOY_ONLY=false
fi

if [ "$DEPLOY_ONLY" = false ]; then
    # Build production images locally (using runtime stage for smaller images)
    echo "🔨 Building production images locally..."
    
    # Build backend with runtime stage (small optimized image)
    echo "🔨 Building backend (runtime stage)..."
    docker build -f backend/Dockerfile --target runtime -t pessoa-1-backend:latest ./backend
    
    # Build frontend (production with HTTPS)
    echo "🔨 Building frontend (production with HTTPS)..."
    docker build -f frontend/Dockerfile.prod \
        --build-arg VITE_API_BASE_URL=https://pessoa.theater \
        --build-arg VITE_WS_BASE_URL=wss://pessoa.theater/api/collab \
        -t pessoa-1-frontend:latest ./frontend
    
    # Tag and push to registry (GitHub Container Registry) - AUTOMATIC
    echo "🏷️  Tagging and pushing images to GitHub Container Registry..."
    
    # Tag images for GitHub Container Registry
    docker tag pessoa-1-backend:latest ghcr.io/sportinger/pessoa-backend:latest
    docker tag pessoa-1-frontend:latest ghcr.io/sportinger/pessoa-frontend:latest
    
    echo "🔑 Pushing images to GitHub Container Registry..."
    docker push ghcr.io/sportinger/pessoa-backend:latest
    docker push ghcr.io/sportinger/pessoa-frontend:latest
    echo "✅ Images pushed to registry!"
    
    # Deploy to Hetzner server - AUTOMATIC
    echo "📡 Deploying to Hetzner server..."
    
    # Copy environment and docker-compose to server
    scp .env.hetzner roman@pessoa.theater:/opt/pessoa/.env
    scp docker-compose.prod.yml roman@pessoa.theater:/opt/pessoa/
    scp deploy_hetzner.sh roman@pessoa.theater:/opt/pessoa/
    
    # Run deployment on server
    ssh roman@pessoa.theater "cd /opt/pessoa && chmod +x deploy_hetzner.sh && ./deploy_hetzner.sh --deploy-only"
    
else
    # Deploy-only mode (run this on the server) - AUTOMATIC
    echo "🚀 Deploying on Hetzner server..."
    
    # Stop any existing production containers
    echo "📦 Stopping existing production containers..."
    docker-compose -f docker-compose.prod.yml --env-file .env down 2>/dev/null || true
    
    # Pull latest images from registry - AUTOMATIC
    echo "📥 Pulling latest images from registry..."
    docker-compose -f docker-compose.prod.yml --env-file .env pull
    
    # Start production services
    echo "🚀 Starting production services..."
    docker-compose -f docker-compose.prod.yml --env-file .env up -d
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to be ready..."
    sleep 15
    
    # Check if services are running
    echo "🔍 Checking service status..."
    docker-compose -f docker-compose.prod.yml --env-file .env ps
    
    # Test production endpoints
    echo "🧪 Testing production endpoints..."
    sleep 5
    
    # Test backend
    if curl -f -s -k https://pessoa.theater/api/health >/dev/null 2>&1; then
        echo "✅ Backend HTTPS is running!"
    elif curl -f -s http://pessoa.theater/api/health >/dev/null 2>&1; then
        echo "✅ Backend HTTP is running!"
    else
        echo "⚠️  Backend may still be starting up..."
    fi
    
    # Test frontend
    if curl -f -s -k https://pessoa.theater >/dev/null 2>&1; then
        echo "✅ Frontend HTTPS is running!"
    elif curl -f -s http://pessoa.theater >/dev/null 2>&1; then
        echo "✅ Frontend HTTP is running!"
    else
        echo "⚠️  Frontend may still be starting up..."
    fi
    
    echo ""
    echo "🎉 Hetzner deployment complete!"
    echo "🌐 Frontend: https://pessoa.theater (or http://pessoa.theater)"
    echo "🔧 Backend API: https://pessoa.theater/api (or http://pessoa.theater/api)"
    echo "🗄️  PgAdmin: http://pessoa.theater:5050"
    echo ""
    echo "📋 To view logs: docker-compose -f docker-compose.prod.yml --env-file .env logs -f"
    echo "🛑 To stop: docker-compose -f docker-compose.prod.yml --env-file .env down"
fi 