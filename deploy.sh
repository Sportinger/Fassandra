#!/bin/bash

# Deploy script for Caddy-based mylayer.org deployment
# Usage: ./deploy-caddy.sh [options]

set -e

# Default values
TARGET="all"
NO_CACHE=false
RESET_DB=false
CLEAN=false
DEPLOY_ONLY=false
SERVER_IP="91.99.69.115"
DOMAIN="mylayer.org"
SSH_USER="root"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
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
            echo "🌐 Caddy-based mylayer.org Deployment Script"
            echo ""
            echo "Usage: ./deploy-caddy.sh [options]"
            echo ""
            echo "Options:"
            echo "  --no-cache     Force rebuild without Docker cache"
            echo "  --reset-db     Reset database (drop volumes)"
            echo "  --clean        Clean up old containers/images first"
            echo "  --deploy-only  Skip build/push, deploy only (for server)"
            echo "  --help         Show this help message"
            exit 0
            ;;
        *)
            echo "❌ Unknown parameter: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🌐 Starting Caddy-based mylayer.org Deployment..."
echo "🖥️  Server: $SERVER_IP"
echo "🌍 Domain: $DOMAIN"

if [ "$DEPLOY_ONLY" != true ]; then
    # Build phase (run locally)
    echo "🔨 Building production images..."
    
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
    
    # Build backend
    echo "🔨 Building backend..."
    echo "⏱️  This may take several minutes for Rust compilation..."
    DOCKER_BUILDKIT=1 docker build $BUILD_OPTS -f backend/Dockerfile --target runtime -t mylayer-backend:latest ./backend
    
    # Build frontend with Caddy
    echo "🔨 Building frontend with Caddy..."
    DOCKER_BUILDKIT=1 docker build $BUILD_OPTS -f frontend/Dockerfile \
        --build-arg VITE_API_BASE_URL=https://$DOMAIN \
        --build-arg VITE_WS_BASE_URL=wss://$DOMAIN/api/collab \
        -t mylayer-frontend:latest ./frontend
    
    # Save images for transfer
    echo "💾 Saving images for transfer..."
    docker save mylayer-backend:latest | gzip > mylayer-backend.tar.gz
    docker save mylayer-frontend:latest | gzip > mylayer-frontend.tar.gz
    
    # Copy files to server
    echo "📡 Deploying to server $SERVER_IP..."
    
    # Ensure directory exists
    ssh $SSH_USER@$SERVER_IP "mkdir -p /home/admin/app"
    
    # Copy configuration files
    echo "📋 Copying configuration files..."
    scp .env.mylayer $SSH_USER@$SERVER_IP:/home/admin/app/.env
    scp docker-compose.production.yml $SSH_USER@$SERVER_IP:/home/admin/app/
    scp Caddyfile $SSH_USER@$SERVER_IP:/home/admin/app/
    
    # Transfer images
    echo "📦 Transferring images to server..."
    scp mylayer-backend.tar.gz $SSH_USER@$SERVER_IP:/home/admin/app/
    scp mylayer-frontend.tar.gz $SSH_USER@$SERVER_IP:/home/admin/app/
    
    # Clean up local tar files
    echo "🧹 Cleaning up local image files..."
    rm -f mylayer-*.tar.gz
    
    # Run deployment on server
    echo "🚀 Executing deployment on server..."
    ssh $SSH_USER@$SERVER_IP << 'EOF'
    cd /home/admin/app
    
    # Stop existing containers
    echo "📦 Stopping existing containers..."
    docker compose -f docker-compose.production.yml down 2>/dev/null || true
    
    # Load images
    echo "📥 Loading images..."
    docker load < mylayer-backend.tar.gz
    docker load < mylayer-frontend.tar.gz
    
    # Clean up transferred files
    rm -f mylayer-*.tar.gz
    
    # Start services
    echo "🚀 Starting services with Caddy..."
    docker compose -f docker-compose.production.yml up -d
    
    # Wait for services
    echo "⏳ Waiting for services to be ready..."
    sleep 15
    
    # Check status
    echo "🔍 Checking service status..."
    docker compose -f docker-compose.production.yml ps
EOF
    
    if [ "$RESET_DB" = true ]; then
        echo "🗄️ Resetting database volumes..."
        ssh $SSH_USER@$SERVER_IP "cd /home/admin/app && docker compose -f docker-compose.production.yml down -v && docker volume rm mylayer_postgres_data 2>/dev/null || true"
    fi
    
else
    # Deploy-only mode (run on server)
    echo "🚀 Deploying on server..."
    
    cd /home/admin/app
    
    # Stop existing containers
    echo "📦 Stopping existing containers..."
    docker compose -f docker-compose.production.yml down 2>/dev/null || true
    
    # Reset database if requested
    if [ "$RESET_DB" = true ]; then
        echo "🗄️ Resetting database volumes..."
        docker compose -f docker-compose.production.yml down -v 2>/dev/null || true
        docker volume rm mylayer_postgres_data 2>/dev/null || true
    fi
    
    # Load images
    echo "📥 Loading images..."
    docker load < mylayer-backend.tar.gz
    docker load < mylayer-frontend.tar.gz
    
    # Clean up transferred files
    rm -f mylayer-*.tar.gz
    
    # Start services
    echo "🚀 Starting services with Caddy..."
    docker compose -f docker-compose.production.yml up -d
    
    # Wait for services
    echo "⏳ Waiting for services to be ready..."
    sleep 15
    
    # Check status
    echo "🔍 Checking service status..."
    docker compose -f docker-compose.production.yml ps
    
    # Test endpoints
    echo "🧪 Testing endpoints..."
    sleep 5
    
    # Test HTTPS (Caddy handles SSL automatically)
    if curl -f -s https://$DOMAIN >/dev/null 2>&1; then
        echo "✅ Frontend HTTPS is running!"
    else
        echo "⚠️  Frontend may still be starting up..."
    fi
    
    if curl -f -s https://$DOMAIN/api/health >/dev/null 2>&1; then
        echo "✅ Backend API HTTPS is running!"
    else
        echo "⚠️  Backend API may still be starting up..."
    fi
    
    echo ""
    echo "🎉 Caddy-based deployment complete!"
    echo "🌐 Frontend: https://$DOMAIN"
    echo "🔧 Backend API: https://$DOMAIN/api"
    echo "🗄️  PgAdmin: http://$SERVER_IP:5050"
    echo ""
    echo "📋 Caddy automatically handles SSL certificates via Let's Encrypt"
    echo "📋 To view logs: docker compose -f docker-compose.production.yml logs -f"
    echo "🛑 To stop: docker compose -f docker-compose.production.yml down"
fi