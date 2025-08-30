#!/bin/bash

# FAST PRODUCTION DEPLOYMENT - RSYNC + DOCKER EXEC
# Usage: ./deploy.prod.sh [--rebuild-backend] [--rebuild-frontend] [--restart-only]

set -e
set -o pipefail

# CONFIGURATION
SERVER="91.99.69.115"
DOMAIN="fassandra.de"
USER="root"
APP_DIR="/home/admin/app"

# Get the project root directory (parent of scripts)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOCAL_DIR="$PROJECT_ROOT"

# Change to project root for proper rsync paths
cd "$PROJECT_ROOT"

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
docker compose --env-file .env.prod -f docker-compose.prod.yml restart
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

# SYNC YJS-PARSER FILES
rsync -az --delete \
    --exclude 'node_modules/' \
    --exclude '.git/' \
    --exclude '*.swp' \
    --exclude '.env' \
    ./yjs-parser/ $USER@$SERVER:$APP_DIR/yjs-parser/

# SYNC CONFIG FILES
rsync -az \
    ./.env.prod \
    ./docker-compose.prod.yml \
    ./Caddyfile \
    $USER@$SERVER:$APP_DIR/

# REBUILD AND RESTART CONTAINERS

ssh $USER@$SERVER << REMOTE_SCRIPT
cd $APP_DIR
set -e

# Install yjs-parser dependencies if needed (using Docker)
if [ -d "yjs-parser" ]; then
    echo "  YJS Parser: checking dependencies..."
    if [ ! -d "yjs-parser/node_modules" ] || [ "yjs-parser/package.json" -nt "yjs-parser/node_modules" ]; then
        echo "  YJS Parser: installing dependencies using Docker..."
        docker run --rm -v \$PWD/yjs-parser:/app -w /app node:20-alpine npm install --production >/dev/null 2>&1
    fi
fi

# Function to rebuild backend
rebuild_backend() {
    echo "  Backend: rebuilding..."
    cd backend
    DOCKER_BUILDKIT=1 docker build -q \
        -f Dockerfile.prod \
        --target runtime \
        -t mylayer-backend:latest . >/dev/null 2>&1
    cd ..
    docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --force-recreate backend >/dev/null 2>&1
}

# Function to rebuild frontend
rebuild_frontend() {
    echo "  Frontend: rebuilding..."
    cd frontend
    DOCKER_BUILDKIT=1 docker build -q \
        -f Dockerfile.prod \
        --build-arg VITE_API_BASE_URL=https://$DOMAIN \
        --build-arg VITE_WS_BASE_URL=wss://$DOMAIN/api/collab \
        --build-arg VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
        -t mylayer-frontend:latest . >/dev/null 2>&1
    cd ..
    docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --force-recreate frontend >/dev/null 2>&1
}

# Check what needs rebuilding
if [ "$REBUILD_BACKEND" = true ]; then
    rebuild_backend
fi

if [ "$REBUILD_FRONTEND" = true ]; then
    rebuild_frontend
fi

# If no specific rebuild requested, only rebuild frontend by default
# NEVER rebuild backend unless explicitly requested with --rebuild-backend
if [ "$REBUILD_BACKEND" = false ] && [ "$REBUILD_FRONTEND" = false ]; then
    # Only rebuild frontend by default (for JS/CSS changes)
    rebuild_frontend
    # Just restart backend container without rebuilding
    docker compose --env-file .env.prod -f docker-compose.prod.yml restart backend >/dev/null 2>&1
    touch /tmp/last_deploy_frontend
fi

# Restart Caddy
docker compose --env-file .env.prod -f docker-compose.prod.yml restart caddy >/dev/null 2>&1

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
