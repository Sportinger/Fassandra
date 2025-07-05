#!/bin/bash

# Enhanced Hetzner Production Deployment Script
# Usage: ./deploy_hetzner.sh [target] [options]

set -e

# Default values
TARGET="all"
NO_CACHE=false
RESET_DB=false
CLEAN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        all|frontend|backend|db)
            TARGET="$1"
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --reset-db)
            RESET_DB=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --deploy-only)
            DEPLOY_ONLY=true
            shift
            ;;
        --help)
            echo "🌐 Hetzner Production Deployment Script"
            echo ""
            echo "Usage: ./deploy_hetzner.sh [target] [options]"
            echo ""
            echo "Targets:"
            echo "  all        Rebuild everything (default)"
            echo "  frontend   Rebuild just frontend"
            echo "  backend    Rebuild just backend"
            echo "  db         Reset database only"
            echo ""
            echo "Options:"
            echo "  --no-cache     Force rebuild without Docker cache"
            echo "  --reset-db     Reset database (drop volumes)"
            echo "  --clean        Clean up old containers/images first"
            echo "  --deploy-only  Skip build/push, deploy only (for server)"
            echo "  --help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./deploy_hetzner.sh                           # Default: rebuild all, keep DB"
            echo "  ./deploy_hetzner.sh all --reset-db --no-cache # Full rebuild + DB reset + no cache"
            echo "  ./deploy_hetzner.sh frontend --no-cache       # Just frontend, no cache"
            echo "  ./deploy_hetzner.sh backend                   # Just backend, with cache"
            echo "  ./deploy_hetzner.sh db --reset                # Just reset database"
            echo "  ./deploy_hetzner.sh all --clean               # Full rebuild + cleanup"
            exit 0
            ;;
        *)
            echo "❌ Unknown parameter: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🌐 Starting Hetzner Production Deployment..."
echo "📋 Target: $TARGET"
echo "🔧 Options: no-cache=$NO_CACHE, reset-db=$RESET_DB, clean=$CLEAN"

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
if [ "$DEPLOY_ONLY" = true ]; then
    echo "🚀 Deploy-only mode: Skipping build and push..."
else
    echo "🔨 Full deployment: Will build, push, and deploy..."
fi

if [ "$DEPLOY_ONLY" != true ]; then
    # Clean up if requested
    if [ "$CLEAN" = true ]; then
        echo "🧹 Cleaning up old containers and images..."
        docker system prune -f
    fi

    # Set build options
    BUILD_OPTS=""
    if [ "$NO_CACHE" = true ]; then
        BUILD_OPTS="--no-cache"
    fi

    # Build production images locally based on target
    case $TARGET in
        "all")
            echo "🔨 Building all production images locally..."
            
            # Build backend with runtime stage (small optimized image)
            echo "🔨 Building backend (runtime stage)..."
            docker build $BUILD_OPTS -f backend/Dockerfile --target runtime -t pessoa-1-backend:latest ./backend
            
            # Build frontend (production with HTTPS)
            echo "🔨 Building frontend (production with HTTPS)..."
            docker build $BUILD_OPTS -f frontend/Dockerfile.prod \
                --build-arg VITE_API_BASE_URL=https://pessoa.theater \
                --build-arg VITE_WS_BASE_URL=wss://pessoa.theater/api/collab \
                -t pessoa-1-frontend:latest ./frontend
            ;;
        "frontend")
            echo "🔨 Building frontend only (production with HTTPS)..."
            docker build $BUILD_OPTS -f frontend/Dockerfile.prod \
                --build-arg VITE_API_BASE_URL=https://pessoa.theater \
                --build-arg VITE_WS_BASE_URL=wss://pessoa.theater/api/collab \
                -t pessoa-1-frontend:latest ./frontend
            ;;
        "backend")
            echo "🔨 Building backend only (runtime stage)..."
            docker build $BUILD_OPTS -f backend/Dockerfile --target runtime -t pessoa-1-backend:latest ./backend
            ;;
        "db")
            echo "🗄️ Database-only deployment - skipping image builds..."
            ;;
    esac
    
    # Tag and push to registry (GitHub Container Registry) - AUTOMATIC
    if [ "$TARGET" != "db" ]; then
        echo "🏷️  Tagging and pushing images to GitHub Container Registry..."
        
        # Tag and push based on what was built
        case $TARGET in
            "all")
                docker tag pessoa-1-backend:latest ghcr.io/sportinger/pessoa-backend:latest
                docker tag pessoa-1-frontend:latest ghcr.io/sportinger/pessoa-frontend:latest
                echo "🔑 Pushing both images to GitHub Container Registry..."
                docker push ghcr.io/sportinger/pessoa-backend:latest
                docker push ghcr.io/sportinger/pessoa-frontend:latest
                ;;
            "frontend")
                docker tag pessoa-1-frontend:latest ghcr.io/sportinger/pessoa-frontend:latest
                echo "🔑 Pushing frontend image to GitHub Container Registry..."
                docker push ghcr.io/sportinger/pessoa-frontend:latest
                ;;
            "backend")
                docker tag pessoa-1-backend:latest ghcr.io/sportinger/pessoa-backend:latest
                echo "🔑 Pushing backend image to GitHub Container Registry..."
                docker push ghcr.io/sportinger/pessoa-backend:latest
                ;;
        esac
        echo "✅ Images pushed to registry!"
    fi
    
    # Deploy to Hetzner server - AUTOMATIC
    echo "📡 Deploying to Hetzner server..."
    
    # Copy environment and docker-compose to server
    scp .env.hetzner roman@pessoa.theater:/opt/pessoa/.env
    scp docker-compose.prod.yml roman@pessoa.theater:/opt/pessoa/
    scp deploy_hetzner.sh roman@pessoa.theater:/opt/pessoa/
    
    # Run deployment on server with same parameters
    DEPLOY_CMD="cd /opt/pessoa && chmod +x deploy_hetzner.sh && ./deploy_hetzner.sh $TARGET --deploy-only"
    if [ "$RESET_DB" = true ]; then
        DEPLOY_CMD="$DEPLOY_CMD --reset-db"
    fi
    ssh roman@pessoa.theater "$DEPLOY_CMD"
    
else
    # Deploy-only mode (run this on the server) - AUTOMATIC
    echo "🚀 Deploying on Hetzner server..."
    
    # Stop any existing production containers
    echo "📦 Stopping existing production containers..."
    docker-compose -f docker-compose.prod.yml --env-file .env down 2>/dev/null || true
    
    # Reset database if requested
    if [ "$RESET_DB" = true ]; then
        echo "🗄️ Resetting database volumes..."
        docker-compose -f docker-compose.prod.yml --env-file .env down -v 2>/dev/null || true
        docker volume rm prod_postgres_data 2>/dev/null || true
    fi
    
    # Handle database-only reset
    if [ "$TARGET" = "db" ]; then
        echo "🗄️ Resetting database only..."
        docker-compose -f docker-compose.prod.yml --env-file .env down 2>/dev/null || true
        docker volume rm prod_postgres_data 2>/dev/null || true
        docker-compose -f docker-compose.prod.yml --env-file .env up -d db
        echo "✅ Database reset complete!"
        exit 0
    fi
    
    # Pull latest images from registry - AUTOMATIC (only what's needed)
    echo "📥 Pulling latest images from registry..."
    case $TARGET in
        "all")
            docker-compose -f docker-compose.prod.yml --env-file .env pull
            ;;
        "frontend")
            docker-compose -f docker-compose.prod.yml --env-file .env pull frontend
            ;;
        "backend")
            docker-compose -f docker-compose.prod.yml --env-file .env pull backend
            ;;
    esac
    
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
    echo "�� Frontend: https://pessoa.theater (or http://pessoa.theater)"
    echo "🔧 Backend API: https://pessoa.theater/api (or http://pessoa.theater/api)"
    echo "🗄️  PgAdmin: http://pessoa.theater:5050"
    echo ""
    echo "📋 To view logs: docker-compose -f docker-compose.prod.yml --env-file .env logs -f"
    echo "🛑 To stop: docker-compose -f docker-compose.prod.yml --env-file .env down"
fi 