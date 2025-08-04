#!/bin/bash

# Custom Hetzner Deployment Script for mylayer.org
# Usage: ./deploy_mylayer.sh [target] [options]

set -e

# Default values
TARGET="all"
NO_CACHE=false
RESET_DB=false
CLEAN=false
DIRECT_DEPLOY=false
DEPLOY_ONLY=false
SERVER_IP="91.99.69.115"
DOMAIN="mylayer.org"
SSH_USER="admin"

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
        --direct)
            DIRECT_DEPLOY=true
            shift
            ;;
        --server-ip)
            SERVER_IP="$2"
            shift 2
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --help)
            echo "🌐 Hetzner mylayer.org Deployment Script"
            echo ""
            echo "Usage: ./deploy_mylayer.sh [target] [options]"
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
            echo "  --direct       Deploy directly without registry"
            echo "  --server-ip    Specify server IP (default: 91.99.69.115)"
            echo "  --domain       Specify domain (default: mylayer.org)"
            echo "  --help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./deploy_mylayer.sh                    # Full deployment"
            echo "  ./deploy_mylayer.sh all --reset-db     # Full rebuild + DB reset"
            echo "  ./deploy_mylayer.sh frontend           # Just frontend"
            echo "  ./deploy_mylayer.sh --direct           # Direct deploy without registry"
            exit 0
            ;;
        *)
            echo "❌ Unknown parameter: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🌐 Starting mylayer.org Deployment..."
echo "📋 Target: $TARGET"
echo "🖥️  Server: $SERVER_IP"
echo "🌍 Domain: $DOMAIN"
echo "🔧 Options: no-cache=$NO_CACHE, reset-db=$RESET_DB, clean=$CLEAN, direct=$DIRECT_DEPLOY"

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.mylayer.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run from project root."
    exit 1
fi

# Create/update mylayer environment file
echo "📝 Setting up mylayer production environment..."
cat > .env.mylayer << EOF
# mylayer.org Production Environment
APP_HOSTNAME=$DOMAIN
APP_DOMAIN=$DOMAIN
FRONTEND_PORT=80
BACKEND_PORT=3001
DATABASE_PORT=5432
PGADMIN_PORT=5050

# API URLs for production
VITE_API_BASE_URL=https://$DOMAIN
VITE_WS_BASE_URL=wss://$DOMAIN/api/collab

# CORS Origins for production
CORS_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
ALLOWED_ORIGINS=https://$DOMAIN,https://www.$DOMAIN

# Database configuration (using secure passwords from .env.mylayer)
DATABASE_URL=postgresql://postgres:xKj9mP2sL4nB6vQ8@db:5432/pessoa_db
POSTGRES_DB=pessoa_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=xKj9mP2sL4nB6vQ8

# Authentication
JWT_SECRET=vro6jKvuV03lUpvFY9sdE0UJAWEcwE5P2ONqA+I7pp8=
ADMIN_EMAIL=admin@$DOMAIN
ADMIN_USERNAME=admin
ADMIN_PASSWORD=b5a4c38afdfa2b1ecf2c7867a0e34757

# PgAdmin configuration
PGADMIN_DEFAULT_EMAIL=admin@$DOMAIN
PGADMIN_DEFAULT_PASSWORD=pg_b5a4c38afdfa2b1e

# AI Integration
GEMINI_API_KEY=AIzaSyCGkJudo4e0YEgZZKQ8xXTPBOTB3cQCY_g
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent

# Environment
ENVIRONMENT=production
RUST_LOG=info

# Container prefix
CONTAINER_PREFIX=mylayer_
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
            
            # Build backend with runtime stage
            echo "🔨 Building backend (runtime stage)..."
            DOCKER_BUILDKIT=1 docker build $BUILD_OPTS -f backend/Dockerfile --target runtime -t mylayer-backend:latest ./backend
            
            # Build frontend for mylayer.org
            echo "🔨 Building frontend for $DOMAIN..."
            DOCKER_BUILDKIT=1 docker build $BUILD_OPTS -f frontend/Dockerfile.prod.simple \
                --build-arg VITE_API_BASE_URL=https://$DOMAIN \
                --build-arg VITE_WS_BASE_URL=wss://$DOMAIN/api/collab \
                -t mylayer-frontend:latest ./frontend
            ;;
        "frontend")
            echo "🔨 Building frontend only for $DOMAIN..."
            DOCKER_BUILDKIT=1 docker build $BUILD_OPTS -f frontend/Dockerfile.prod.simple \
                --build-arg VITE_API_BASE_URL=https://$DOMAIN \
                --build-arg VITE_WS_BASE_URL=wss://$DOMAIN/api/collab \
                -t mylayer-frontend:latest ./frontend
            ;;
        "backend")
            echo "🔨 Building backend only..."
            DOCKER_BUILDKIT=1 docker build $BUILD_OPTS -f backend/Dockerfile --target runtime -t mylayer-backend:latest ./backend
            ;;
        "db")
            echo "🗄️ Database-only deployment - skipping image builds..."
            ;;
    esac
    
    # Save images for direct transfer to server
    if [ "$TARGET" != "db" ]; then
        echo "💾 Saving images for transfer to server..."
        case $TARGET in
            "all")
                docker save mylayer-backend:latest | gzip > mylayer-backend.tar.gz
                docker save mylayer-frontend:latest | gzip > mylayer-frontend.tar.gz
                ;;
            "frontend")
                docker save mylayer-frontend:latest | gzip > mylayer-frontend.tar.gz
                ;;
            "backend")
                docker save mylayer-backend:latest | gzip > mylayer-backend.tar.gz
                ;;
        esac
        echo "✅ Images saved for deployment!"
    fi
    
    # Deploy to Hetzner server
    echo "📡 Deploying to Hetzner server $SERVER_IP..."
    
    # Ensure directory exists in /home/admin/app
    echo "📁 Ensuring /home/admin/app directory exists..."
    ssh $SSH_USER@$SERVER_IP "mkdir -p /home/admin/app"
    
    # Copy environment and docker compose to server
    echo "📋 Copying configuration files..."
    scp .env.mylayer $SSH_USER@$SERVER_IP:/home/admin/app/.env
    scp docker-compose.mylayer.yml $SSH_USER@$SERVER_IP:/home/admin/app/docker-compose.yml
    scp deploy-mylayer.sh $SSH_USER@$SERVER_IP:/home/admin/app/
    scp nginx-mylayer-prod.conf $SSH_USER@$SERVER_IP:/home/admin/app/
    
    # Transfer images to server
    echo "📦 Transferring images to server..."
    case $TARGET in
        "all")
            scp mylayer-backend.tar.gz $SSH_USER@$SERVER_IP:/home/admin/app/
            scp mylayer-frontend.tar.gz $SSH_USER@$SERVER_IP:/home/admin/app/
            ;;
        "frontend")
            scp mylayer-frontend.tar.gz $SSH_USER@$SERVER_IP:/home/admin/app/
            ;;
        "backend")
            scp mylayer-backend.tar.gz $SSH_USER@$SERVER_IP:/home/admin/app/
            ;;
    esac
    
    # Clean up local tar files
    echo "🧹 Cleaning up local image files..."
    rm -f mylayer-*.tar.gz
    
    # Run deployment on server
    DEPLOY_CMD="cd /home/admin/app && chmod +x deploy-mylayer.sh && ./deploy-mylayer.sh $TARGET --deploy-only --domain $DOMAIN --server-ip $SERVER_IP"
    if [ "$RESET_DB" = true ]; then
        DEPLOY_CMD="$DEPLOY_CMD --reset-db"
    fi
    
    echo "🚀 Executing deployment on server..."
    ssh $SSH_USER@$SERVER_IP "$DEPLOY_CMD"
    
else
    # Deploy-only mode (run this on the server)
    echo "🚀 Deploying on server $SERVER_IP..."
    
    # Create directory if it doesn't exist and navigate to it
    mkdir -p /home/admin/app
    cd /home/admin/app
    
    # Stop any existing containers
    echo "📦 Stopping existing containers..."
    docker compose down 2>/dev/null || true
    
    # Reset database if requested
    if [ "$RESET_DB" = true ]; then
        echo "🗄️ Resetting database volumes..."
        docker compose down -v 2>/dev/null || true
        docker volume rm mylayer_postgres_data 2>/dev/null || true
    fi
    
    # Handle database-only reset
    if [ "$TARGET" = "db" ]; then
        echo "🗄️ Resetting database only..."
        docker compose down 2>/dev/null || true
        docker volume rm mylayer_postgres_data 2>/dev/null || true
        docker compose up -d db
        echo "✅ Database reset complete!"
        exit 0
    fi
    
    # Load images from transferred files
    echo "📥 Loading images from transferred files..."
    case $TARGET in
        "all")
            echo "🔄 Loading backend image..."
            docker load < mylayer-backend.tar.gz
            echo "🔄 Loading frontend image..."
            docker load < mylayer-frontend.tar.gz
            ;;
        "frontend")
            echo "🔄 Loading frontend image..."
            docker load < mylayer-frontend.tar.gz
            ;;
        "backend")
            echo "🔄 Loading backend image..."
            docker load < mylayer-backend.tar.gz
            ;;
    esac
    echo "✅ Images loaded successfully!"
    
    # Clean up transferred files
    echo "🧹 Cleaning up transferred image files..."
    rm -f mylayer-*.tar.gz
    
    # Start production services
    echo "🚀 Starting production services..."
    docker compose up -d
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to be ready..."
    sleep 15
    
    # Check if services are running
    echo "🔍 Checking service status..."
    docker compose ps
    
    # Test endpoints
    echo "🧪 Testing production endpoints..."
    sleep 5
    
    # Test backend
    if curl -f -s -k https://$DOMAIN/api/health >/dev/null 2>&1; then
        echo "✅ Backend HTTPS is running!"
    elif curl -f -s http://$SERVER_IP:3001/health >/dev/null 2>&1; then
        echo "✅ Backend HTTP is running!"
    else
        echo "⚠️  Backend may still be starting up..."
    fi
    
    # Test frontend
    if curl -f -s -k https://$DOMAIN >/dev/null 2>&1; then
        echo "✅ Frontend HTTPS is running!"
    elif curl -f -s http://$SERVER_IP >/dev/null 2>&1; then
        echo "✅ Frontend HTTP is running!"
    else
        echo "⚠️  Frontend may still be starting up..."
    fi
    
    echo ""
    echo "🎉 mylayer.org deployment complete!"
    echo "🌐 Frontend: https://$DOMAIN (or http://$SERVER_IP)"
    echo "🔧 Backend API: https://$DOMAIN/api (or http://$SERVER_IP:3001)"
    echo "🗄️  PgAdmin: http://$SERVER_IP:5050"
    echo ""
    echo "📋 To view logs: docker compose logs -f"
    echo "🛑 To stop: docker compose down"
fi 