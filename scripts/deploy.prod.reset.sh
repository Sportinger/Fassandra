#!/bin/bash

# PRODUCTION DEPLOYMENT RESET – IMAGE TRANSFER FLOW
# Usage: ./scripts/deploy.prod.reset.sh [--no-cache]

set -euo pipefail

# CONFIGURATION
SERVER="91.99.69.115"
DOMAIN="fassandra.de"
USER="root"
APP_DIR="/home/admin/app"

# Resolve project root (parent of scripts)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
BUILD_OPTS=""
if [[ "${1:-}" == "--no-cache" ]]; then
    BUILD_OPTS="--no-cache"
    echo "🔄 FORCING FRESH BUILD (no cache)"
fi

# Error handler
trap 'echo "❌ DEPLOYMENT FAILED AT LINE $LINENO"' ERR

echo "🚀 MYLAYER.ORG PRODUCTION DEPLOYMENT (RESET)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# BUILD PHASE
echo "🔨 Building backend (this takes 2-5 minutes)..."
cd "$PROJECT_ROOT/backend"
if ! DOCKER_BUILDKIT=1 docker build \
    $BUILD_OPTS \
    -f Dockerfile.prod \
    --target runtime \
    -t mylayer-backend:latest .; then
    echo "❌ Backend build FAILED"
    echo "Check: Does backend/Dockerfile.prod exist? Is Docker running?"
    exit 1
fi

echo "✅ Backend built successfully"

echo "🔨 Building frontend..."
cd "$PROJECT_ROOT/frontend"
if [ -f ../.env.prod ]; then
    set -a; . ../.env.prod; set +a
fi
if [ -z "${VITE_GOOGLE_CLIENT_ID:-}" ]; then
    echo "❌ VITE_GOOGLE_CLIENT_ID not set in .env.prod"; exit 1; fi
if ! DOCKER_BUILDKIT=1 docker build \
    $BUILD_OPTS \
    -f Dockerfile.prod \
    --build-arg VITE_API_BASE_URL=https://$DOMAIN \
    --build-arg VITE_WS_BASE_URL=wss://$DOMAIN/api/collab \
    --build-arg VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    -t mylayer-frontend:latest .; then
    echo "❌ Frontend build FAILED"
    echo "Check: Does frontend/Dockerfile.prod exist? Are the VITE args correct?"
    exit 1
fi

echo "🔎 Verifying built bundle contains client ID..."
if ! docker run --rm mylayer-frontend:latest sh -lc "grep -R -q \"$VITE_GOOGLE_CLIENT_ID\" /srv || grep -R -q \"${VITE_GOOGLE_CLIENT_ID%%.*}\" /srv"; then
    echo "❌ Built frontend image does not contain VITE_GOOGLE_CLIENT_ID"; exit 1; fi

echo "✅ Frontend built successfully"

cd "$PROJECT_ROOT"

# SAVE IMAGES
echo "📦 Compressing images (this takes a minute)..."
docker save mylayer-backend:latest | gzip > backend.tar.gz || {
    echo "❌ Failed to save backend image"; exit 1; }
docker save mylayer-frontend:latest | gzip > frontend.tar.gz || {
    echo "❌ Failed to save frontend image"; exit 1; }

echo "✅ Images compressed"

# TEST CONNECTION
echo "🔗 Testing server connection..."
if ! ssh -o ConnectTimeout=5 "$USER@$SERVER" "echo 'Connected'" >/dev/null 2>&1; then
    echo "❌ Cannot connect to $SERVER"
    echo "Check: IP, SSH key, server online"
    exit 1
fi

# CLEAN SERVER (but preserve volumes)
echo "🧹 Cleaning server (removing Docker containers, keeping volumes)..."
ssh "$USER@$SERVER" << 'EOF'
cd /home/admin/app
# Stop compose stack if present
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
# Stop & remove any remaining containers
ids=$(docker ps -aq)
if [ -n "$ids" ]; then
  docker stop $ids 2>/dev/null || true
  docker rm $ids 2>/dev/null || true
fi
# Prune images/networks/build cache (keep volumes)
docker system prune -af >/dev/null 2>&1 || true
EOF

echo "✅ Server cleaned"

# CREATE DIRECTORY
ssh "$USER@$SERVER" "mkdir -p $APP_DIR" || { echo "❌ Failed to create app directory"; exit 1; }

# CHECK REQUIRED FILES
echo "📋 Checking required files..."
for file in "$PROJECT_ROOT/.env.prod" "$PROJECT_ROOT/docker-compose.prod.yml" "$PROJECT_ROOT/Caddyfile"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"; exit 1; fi
done

echo "✅ All required files present"

# TRANSFER FILES
echo "📡 Transferring images (this may take 2-10 minutes)..."
echo "   Backend size: $(du -h backend.tar.gz | cut -f1)"
echo "   Frontend size: $(du -h frontend.tar.gz | cut -f1)"
scp backend.tar.gz frontend.tar.gz "$USER@$SERVER:$APP_DIR/" || { echo "❌ Failed to transfer images"; exit 1; }

echo "📡 Transferring config files..."
scp "$PROJECT_ROOT/.env.prod" "$USER@$SERVER:$APP_DIR/.env.prod" || { echo "❌ Failed to transfer .env.prod"; exit 1; }
scp "$PROJECT_ROOT/docker-compose.prod.yml" "$USER@$SERVER:$APP_DIR/" || { echo "❌ Failed to transfer docker-compose.prod.yml"; exit 1; }
scp "$PROJECT_ROOT/Caddyfile" "$USER@$SERVER:$APP_DIR/" || { echo "❌ Failed to transfer Caddyfile"; exit 1; }

echo "✅ Config files transferred"

# Sync essential build files for future fast deployments
echo "📡 Syncing build files for future fast deployments..."
rsync -az ./backend/Dockerfile.prod ./backend/Cargo.toml ./backend/Cargo.lock "$USER@$SERVER:$APP_DIR/backend/" 2>/dev/null || true
rsync -az ./frontend/Dockerfile.prod ./frontend/package.json ./frontend/package-lock.json "$USER@$SERVER:$APP_DIR/frontend/" 2>/dev/null || true

# CLEANUP LOCAL
rm -f backend.tar.gz frontend.tar.gz

# DEPLOY ON SERVER
echo "🚀 Deploying on server..."
ssh "$USER@$SERVER" APP_DIR="$APP_DIR" DOMAIN="$DOMAIN" << 'DEPLOY_SCRIPT'
cd "$APP_DIR"

# Load backend
echo "📥 Loading backend image..."
docker load < backend.tar.gz || { echo "❌ Failed to load backend image"; exit 1; }

docker images | grep -q mylayer-backend || { echo "❌ Backend image not found after loading"; exit 1; }

echo "✅ Backend image loaded"

# Load frontend
echo "📥 Loading frontend image..."
docker load < frontend.tar.gz || { echo "❌ Failed to load frontend image"; exit 1; }

docker images | grep -q mylayer-frontend || { echo "❌ Frontend image not found after loading"; exit 1; }

echo "✅ Frontend image loaded"

# Clean transferred archives
rm -f backend.tar.gz frontend.tar.gz

# Ensure source dirs exist for future rsync
mkdir -p backend frontend yjs-parser

# Start services
echo "🚀 Starting services..."
if ! docker compose -f docker-compose.prod.yml up -d; then
    echo "❌ Failed to start services"; docker compose -f docker-compose.prod.yml logs; exit 1; fi

# Simple container status check
echo "⏳ Waiting for containers to be running..."; sleep 10

echo "📊 Checking container status..."
running_count=$(docker ps --filter "status=running" | grep -c "mylayer" || true)
if [ "$running_count" -ge 4 ]; then
  echo "✅ $running_count mylayer containers are running"
else
  echo "⚠️ Only $running_count mylayer containers running"
fi

echo ""
echo "📊 Final container status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "🔍 Quick health check:"
echo -n "Database: "
db_container=$(docker ps -qf "name=db")
if [ -n "$db_container" ] && docker exec "$db_container" pg_isready >/dev/null 2>&1; then
  echo "✅ Ready"
else
  echo "⚠️ Starting..."
fi

echo -n "Frontend URL: "
if curl -sI "https://$DOMAIN" | head -1 | grep -q "200\|301\|302\|304"; then
  echo "✅ Responding"
else
  echo "⚠️ Not responding yet"
fi

echo -n "Backend URL: "
if curl -sI "https://$DOMAIN/api" | head -1 | grep -q "200\|301\|302\|404"; then
  echo "✅ Responding"
else
  echo "⚠️ Not responding yet"
fi
DEPLOY_SCRIPT

if [ $? -ne 0 ]; then
    echo "❌ Deployment on server FAILED"; exit 1; fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE"
echo "🌐 https://$DOMAIN"
echo
echo "📋 Check logs with:"
echo "   ssh $USER@$SERVER 'cd $APP_DIR && docker compose -f docker-compose.prod.yml logs -f'"
echo
echo "💡 Fast deployments now available with:"
echo "   ./scripts/deploy.prod.sh"
