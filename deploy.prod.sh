#!/bin/bash

# FAST PRODUCTION DEPLOYMENT - RSYNC + DOCKER EXEC
# Usage: ./deploy.prod.sh [--rebuild-backend] [--rebuild-frontend] [--restart-only]

set -e
set -o pipefail

# CONFIGURATION
SERVER="91.99.69.115"
DOMAIN="mylayer.org"
USER="root"
APP_DIR="/home/admin/app"
LOCAL_DIR="$(pwd)"

# Parse arguments
REBUILD_BACKEND=false
REBUILD_FRONTEND=false
RESTART_ONLY=false
for arg in "$@"; do
    case $arg in
        --rebuild-backend)
            REBUILD_BACKEND=true
            ;;
        --rebuild-frontend)
            REBUILD_FRONTEND=true
            ;;
        --restart-only)
            RESTART_ONLY=true
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Usage: $0 [--rebuild-backend] [--rebuild-frontend] [--restart-only]"
            exit 1
            ;;
    esac
done

# Error handler
trap 'echo "❌ DEPLOYMENT FAILED AT LINE $LINENO"' ERR

echo "🚀 Fast deploy to $DOMAIN"

# Test connection
if ! ssh -o ConnectTimeout=5 $USER@$SERVER "echo 'Connected'" > /dev/null 2>&1; then
    echo "❌ Cannot connect to $SERVER"
    exit 1
fi

if [ "$RESTART_ONLY" = true ]; then
    echo "🔄 Restarting containers only..."
    ssh $USER@$SERVER << 'EOF'
cd /home/admin/app
docker compose -f docker-compose.production.yml restart
EOF
    echo "✅ Containers restarted"
    exit 0
fi

# SYNC BACKEND FILES
rsync -az --delete \
    --exclude 'target/' \
    --exclude '.git/' \
    --exclude '*.swp' \
    --exclude '.env' \
    --exclude 'uploads/' \
    ./backend/ $USER@$SERVER:$APP_DIR/backend/

# SYNC FRONTEND FILES
rsync -az --delete \
    --exclude 'node_modules/' \
    --exclude 'dist/' \
    --exclude '.git/' \
    --exclude '*.swp' \
    --exclude '.env' \
    --exclude 'android/' \
    --exclude 'ios/' \
    ./frontend/ $USER@$SERVER:$APP_DIR/frontend/

# SYNC CONFIG FILES
rsync -az \
    .env.mylayer \
    docker-compose.production.yml \
    Caddyfile \
    $USER@$SERVER:$APP_DIR/

# Rename .env.mylayer to .env on server
ssh $USER@$SERVER "cd $APP_DIR && cp .env.mylayer .env" 2>/dev/null

# REBUILD AND RESTART CONTAINERS

ssh $USER@$SERVER << REMOTE_SCRIPT
cd $APP_DIR
set -e

# Function to rebuild backend
rebuild_backend() {
    echo "  Backend: rebuilding..."
    cd backend
    DOCKER_BUILDKIT=1 docker build -q \
        -f Dockerfile \
        --target runtime \
        -t mylayer-backend:latest . >/dev/null 2>&1
    cd ..
    docker compose -f docker-compose.production.yml up -d --force-recreate backend >/dev/null 2>&1
}

# Function to rebuild frontend
rebuild_frontend() {
    echo "  Frontend: rebuilding..."
    cd frontend
    DOCKER_BUILDKIT=1 docker build -q \
        -f Dockerfile \
        --build-arg VITE_API_BASE_URL=https://$DOMAIN \
        --build-arg VITE_WS_BASE_URL=wss://$DOMAIN/api/collab \
        -t mylayer-frontend:latest . >/dev/null 2>&1
    cd ..
    docker compose -f docker-compose.production.yml up -d --force-recreate frontend >/dev/null 2>&1
}

# Check what needs rebuilding
if [ "$REBUILD_BACKEND" = true ]; then
    rebuild_backend
fi

if [ "$REBUILD_FRONTEND" = true ]; then
    rebuild_frontend
fi

# If no specific rebuild requested, only rebuild frontend by default
if [ "$REBUILD_BACKEND" = false ] && [ "$REBUILD_FRONTEND" = false ]; then
    # Frontend always needs rebuild for HTML/JS changes
    rebuild_frontend
    touch /tmp/last_deploy_frontend
    
    # Just restart backend (don't rebuild unless explicitly requested)
    docker compose -f docker-compose.production.yml restart backend >/dev/null 2>&1
fi

# Restart Caddy
docker compose -f docker-compose.production.yml restart caddy >/dev/null 2>&1

# Wait briefly
sleep 5

# Quick check
if docker exec mylayer_pessoa_backend curl -s http://localhost:8080/health >/dev/null 2>&1 && \
   docker exec mylayer_pessoa_frontend curl -s http://localhost:80 >/dev/null 2>&1; then
    echo "  Status: ✅ All services running"
else
    echo "  Status: ⚠️ Some services not responding"
fi

REMOTE_SCRIPT

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed"
    exit 1
fi

echo "✅ Deployed to https://$DOMAIN"