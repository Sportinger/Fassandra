#!/bin/bash

# PRODUCTION DEPLOYMENT - NO BS VERSION WITH FEEDBACK
# Usage: ./deploy.sh [--no-cache]

set -e
set -o pipefail

# CONFIGURATION - CHANGE THESE
SERVER="91.99.69.115"
DOMAIN="mylayer.org"
USER="root"
APP_DIR="/home/admin/app"

# Parse arguments
BUILD_OPTS=""
if [[ "$1" == "--no-cache" ]]; then
    BUILD_OPTS="--no-cache"
    echo "🔄 FORCING FRESH BUILD (no cache)"
fi

# Error handler
trap 'echo "❌ DEPLOYMENT FAILED AT LINE $LINENO"' ERR

echo "🚀 MYLAYER.ORG PRODUCTION DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# BUILD PHASE
echo "🔨 Building backend (this takes 2-5 minutes)..."
if ! DOCKER_BUILDKIT=1 docker build \
    $BUILD_OPTS \
    -f backend/Dockerfile \
    --target runtime \
    -t mylayer-backend:latest ./backend; then
    echo "❌ Backend build FAILED"
    echo "Check: Does backend/Dockerfile exist?"
    echo "Check: Is Docker running?"
    exit 1
fi
echo "✅ Backend built successfully"

echo "🔨 Building frontend..."
if ! DOCKER_BUILDKIT=1 docker build \
    $BUILD_OPTS \
    -f frontend/Dockerfile \
    --build-arg VITE_API_BASE_URL=https://$DOMAIN \
    --build-arg VITE_WS_BASE_URL=wss://$DOMAIN/api/collab \
    -t mylayer-frontend:latest ./frontend; then
    echo "❌ Frontend build FAILED"
    echo "Check: Does frontend/Dockerfile exist?"
    echo "Check: Are the VITE args correct?"
    exit 1
fi
echo "✅ Frontend built successfully"

# SAVE IMAGES
echo "📦 Compressing images (this takes a minute)..."
docker save mylayer-backend:latest | gzip > backend.tar.gz || {
    echo "❌ Failed to save backend image"
    exit 1
}
docker save mylayer-frontend:latest | gzip > frontend.tar.gz || {
    echo "❌ Failed to save frontend image"
    exit 1
}
echo "✅ Images compressed"

# TEST CONNECTION
echo "🔗 Testing server connection..."
if ! ssh -o ConnectTimeout=5 $USER@$SERVER "echo 'Connected'"; then
    echo "❌ Cannot connect to $SERVER"
    echo "Check: Is the server IP correct?"
    echo "Check: Is your SSH key configured?"
    echo "Check: Is the server online?"
    exit 1
fi

# CLEAN SERVER (but preserve source directories)
echo "🧹 Cleaning server (removing Docker containers, keeping source files)..."
ssh $USER@$SERVER << 'EOF'
cd /home/admin/app
# First, properly stop mylayer app if it exists
echo "Stopping mylayer app gracefully..."
docker compose -f docker-compose.production.yml down 2>/dev/null || true
# Now stop and remove EVERYTHING else
echo "Stopping all containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
echo "Removing all containers..."
docker rm $(docker ps -aq) 2>/dev/null || true
echo "Cleaning system (keeping volumes for database persistence)..."
docker system prune -af
# Preserve backend and frontend directories if they exist
echo "Preserving source directories for rsync deployment..."
EOF

if [ $? -ne 0 ]; then
    echo "❌ Failed to clean server"
    exit 1
fi
echo "✅ Server cleaned"

# CREATE DIRECTORY
ssh $USER@$SERVER "mkdir -p $APP_DIR" || {
    echo "❌ Failed to create app directory"
    exit 1
}

# CHECK REQUIRED FILES
echo "📋 Checking required files..."
for file in .env.mylayer docker-compose.production.yml Caddyfile; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    fi
done
echo "✅ All required files present"

# TRANSFER FILES
echo "📡 Transferring images (this may take 2-10 minutes)..."
echo "   Backend size: $(du -h backend.tar.gz | cut -f1)"
echo "   Frontend size: $(du -h frontend.tar.gz | cut -f1)"

if ! scp backend.tar.gz frontend.tar.gz $USER@$SERVER:$APP_DIR/; then
    echo "❌ Failed to transfer images"
    echo "Check: Is there enough disk space on server?"
    echo "Check: Network connection stable?"
    exit 1
fi
echo "✅ Images transferred"

echo "📡 Transferring config files..."
scp .env.mylayer $USER@$SERVER:$APP_DIR/.env || {
    echo "❌ Failed to transfer .env.mylayer"
    exit 1
}
scp docker-compose.production.yml $USER@$SERVER:$APP_DIR/ || {
    echo "❌ Failed to transfer docker-compose.production.yml"
    exit 1
}
scp Caddyfile $USER@$SERVER:$APP_DIR/ || {
    echo "❌ Failed to transfer Caddyfile"
    exit 1
}
echo "✅ Config files transferred"

# Sync essential build files for rsync deployments
echo "📡 Syncing build files for future fast deployments..."
rsync -az ./backend/Dockerfile ./backend/Cargo.toml ./backend/Cargo.lock $USER@$SERVER:$APP_DIR/backend/ 2>/dev/null || true
rsync -az ./frontend/Dockerfile ./frontend/package.json ./frontend/package-lock.json $USER@$SERVER:$APP_DIR/frontend/ 2>/dev/null || true

# CLEANUP LOCAL
rm -f backend.tar.gz frontend.tar.gz

# DEPLOY ON SERVER
echo "🚀 Deploying on server..."
ssh $USER@$SERVER << 'DEPLOY_SCRIPT'
cd /home/admin/app

# Load backend
echo "📥 Loading backend image..."
if ! docker load < backend.tar.gz; then
    echo "❌ Failed to load backend image"
    exit 1
fi

if ! docker images | grep -q mylayer-backend; then
    echo "❌ Backend image not found after loading"
    exit 1
fi
echo "✅ Backend image loaded"

# Load frontend
echo "📥 Loading frontend image..."
if ! docker load < frontend.tar.gz; then
    echo "❌ Failed to load frontend image"
    exit 1
fi

if ! docker images | grep -q mylayer-frontend; then
    echo "❌ Frontend image not found after loading"
    exit 1
fi
echo "✅ Frontend image loaded"

# Clean transferred files
rm -f backend.tar.gz frontend.tar.gz

# Sync source files for future rsync deployments
echo "📂 Setting up source directories for fast rsync deployments..."
mkdir -p backend frontend

# Start services
echo "🚀 Starting services..."
if ! docker compose -f docker-compose.production.yml up -d; then
    echo "❌ Failed to start services"
    echo "Showing docker compose logs:"
    docker compose -f docker-compose.production.yml logs
    exit 1
fi

# Simple container status check
echo "⏳ Waiting for all containers to be running..."
sleep 10  # Give containers time to start

echo "📊 Checking container status..."
running_count=$(docker ps --filter "status=running" | grep -c "mylayer" || true)

if [ $running_count -ge 4 ]; then
    echo "✅ All $running_count mylayer containers are running!"
else
    echo "⚠️ Only $running_count mylayer containers running"
fi

# Show actual status
echo ""
echo "📊 Final container status:"
docker compose -f docker-compose.production.yml ps

echo ""
echo "🔍 Quick health check:"
echo -n "Database: "
db_container=$(docker ps -qf "name=db")
if [ -n "$db_container" ] && docker exec $db_container pg_isready >/dev/null 2>&1; then
    echo "✅ Ready"
else
    echo "⚠️ Starting..."
fi

echo -n "Frontend URL: "
if curl -sI https://$DOMAIN | head -1 | grep -q "200\|301\|302\|304"; then
    echo "✅ Responding"
else
    echo "⚠️ Not responding yet (may need more time for SSL)"
fi

echo -n "Backend URL: "
if curl -sI https://$DOMAIN/api | head -1 | grep -q "200\|301\|302\|404"; then
    echo "✅ Responding"  
else
    echo "⚠️ Not responding yet"
fi
DEPLOY_SCRIPT

if [ $? -ne 0 ]; then
    echo "❌ Deployment on server FAILED"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE"
echo "🌐 https://$DOMAIN"
echo ""
echo "📋 Check logs with:"
echo "   ssh $USER@$SERVER 'cd $APP_DIR && docker compose -f docker-compose.production.yml logs -f'"
echo ""
echo "💡 Fast deployments now available with:"
echo "   ./deploy.prod.sh"