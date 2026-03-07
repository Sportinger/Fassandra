#!/bin/bash

# DEV DEPLOYMENT RESET - FULL CLEAN + BUILD (SERVER-SIDE)
# Usage: ./scripts_deploy/deploy.dev.reset.sh [--no-cache]
#
# Stops DEV containers, removes DEV images, syncs all files,
# rebuilds everything from scratch on the server.
# Uses shared Caddy (already configured for dev.fassandra.de)

set -euo pipefail

# CONFIGURATION (can be overridden via environment variables)
SERVER="${DEPLOY_SERVER:-fassandra.de}"
DEV_DOMAIN="${DEPLOY_DEV_DOMAIN:-dev.fassandra.de}"
USER="${DEPLOY_USER:-admin}"
APP_DIR="${DEPLOY_APP_DIR:-/home/admin/app}"

# Resolve project root (parent of scripts)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Parse arguments
BUILD_OPTS=""
if [[ "${1:-}" == "--no-cache" ]]; then
    BUILD_OPTS="--no-cache"
    echo "FORCING FRESH BUILD (no cache)"
fi

# Error handler
trap 'echo "DEPLOYMENT FAILED AT LINE $LINENO"' ERR

echo "DEV DEPLOYMENT RESET (FULL REBUILD)"
echo "===================================="

# TEST CONNECTION
echo "[1/7] Testing server connection..."
if ! ssh -o ConnectTimeout=5 "$USER@$SERVER" "echo 'Connected'" >/dev/null 2>&1; then
    echo "Cannot connect to $SERVER"
    exit 1
fi
echo "Connected to $SERVER"

# Verify .env.dev exists on server — never pushed by this script
echo "Checking server .env.dev..."
if ! ssh "$USER@$SERVER" "[ -f $APP_DIR/.env.dev ]"; then
    echo "ERROR: .env.dev not found on server."
    echo "   Set it up manually once:"
    echo "   ssh $USER@$SERVER"
    echo "   nano $APP_DIR/.env.dev"
    exit 1
fi

# STOP AND CLEAN DEV CONTAINERS
echo "[2/7] Stopping DEV containers and cleaning images..."
ssh "$USER@$SERVER" "APP_DIR='$APP_DIR' bash -s" << 'EOF'
cd "$APP_DIR"
# Stop DEV compose stack
docker compose -f docker-compose.dev.yml down 2>/dev/null || true
# Remove DEV images to force fresh build
docker rmi mylayer-backend:dev mylayer-frontend:dev 2>/dev/null || true
echo "DEV containers stopped, images removed"
EOF

# SYNC BACKEND
echo "[3/7] Syncing backend..."
rsync -az --delete \
    --exclude 'target/' \
    --exclude '.git/' \
    --exclude '*.swp' \
    --exclude '.env' \
    --exclude 'uploads/' \
    ./backend/ "$USER@$SERVER:$APP_DIR/backend/"

# SYNC FRONTEND
echo "[4/7] Syncing frontend..."
rsync -az --delete \
    --exclude 'node_modules/' \
    --exclude 'dist/' \
    --exclude '.git/' \
    --exclude '*.swp' \
    --exclude '.env' \
    --exclude 'android/' \
    --exclude 'ios/' \
    ./frontend/ "$USER@$SERVER:$APP_DIR/frontend/"

# SYNC YJS-PARSER
echo "[5/7] Syncing yjs-parser..."
rsync -az --delete \
    --exclude 'node_modules/' \
    --exclude '.git/' \
    --exclude '*.swp' \
    ./yjs-parser/ "$USER@$SERVER:$APP_DIR/yjs-parser/"

# SYNC CONFIG (never sync .env files — managed manually on server)
echo "[6/7] Syncing config files..."

# BUILD AND DEPLOY ON SERVER
echo "[7/7] Building and deploying on server (this takes 2-5 minutes)..."
ssh "$USER@$SERVER" "APP_DIR='$APP_DIR' DEV_DOMAIN='$DEV_DOMAIN' BUILD_OPTS='$BUILD_OPTS' bash -s" << 'DEPLOY_SCRIPT'
set -euo pipefail
cd "$APP_DIR"

# Load environment for build args
if [ -f .env.dev ]; then
    set -a; . .env.dev; set +a
elif [ -f .env.prod ]; then
    set -a; . .env.prod; set +a
fi

# Ensure directories exist
mkdir -p backend frontend yjs-parser backend/uploads-dev

# Install yjs-parser dependencies
if [ -d "yjs-parser" ]; then
    echo "Installing yjs-parser dependencies..."
    docker run --rm -v $PWD/yjs-parser:/app -w /app node:20-alpine npm install --production >/dev/null 2>&1 || true
fi

# Build backend
echo "Building backend image (this takes 2-5 minutes)..."
cd backend
DOCKER_BUILDKIT=1 docker build $BUILD_OPTS \
    -f Dockerfile.prod \
    --target runtime \
    -t mylayer-backend:dev .
cd ..
echo "Backend image built"

# Build frontend
if [ -z "${VITE_GOOGLE_CLIENT_ID:-}" ]; then
    echo "VITE_GOOGLE_CLIENT_ID not set"; exit 1
fi

echo "Building frontend image..."
cd frontend
DOCKER_BUILDKIT=1 docker build $BUILD_OPTS \
    -f Dockerfile.prod \
    --build-arg VITE_API_BASE_URL=https://$DEV_DOMAIN \
    --build-arg VITE_WS_BASE_URL=wss://$DEV_DOMAIN/api/collab \
    --build-arg VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    -t mylayer-frontend:dev .
cd ..
echo "Frontend image built"

# Start all DEV services
echo "Starting DEV services..."
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d

echo "Waiting for services to start..."
sleep 10

echo ""
echo "Container status:"
docker compose -f docker-compose.dev.yml ps

echo ""
echo "Health checks:"
echo -n "Database: "
db_container=$(docker ps -qf "name=dev_fassandra_db")
if [ -n "$db_container" ] && docker exec "$db_container" pg_isready >/dev/null 2>&1; then
  echo "Ready"
else
  echo "Starting..."
fi

echo -n "Frontend: "
if curl -sI "https://$DEV_DOMAIN" | head -1 | grep -q "200\|301\|302\|304"; then
  echo "OK"
else
  echo "Starting..."
fi

echo -n "Backend: "
if curl -sI "https://$DEV_DOMAIN/api" | head -1 | grep -q "200\|301\|302\|404"; then
  echo "OK"
else
  echo "Starting..."
fi
DEPLOY_SCRIPT

if [ $? -ne 0 ]; then
    echo "Deployment FAILED"; exit 1
fi

echo "===================================="
echo "DEV DEPLOYMENT RESET COMPLETE"
echo "URL: https://$DEV_DOMAIN"
echo ""
echo "View logs:"
echo "   ssh $USER@$SERVER 'cd $APP_DIR && docker compose -f docker-compose.dev.yml logs -f'"
echo ""
echo "Fast deployments now available with:"
echo "   ./scripts_deploy/deploy.dev.fe.sh      # Frontend only"
echo "   ./scripts_deploy/deploy.dev.full.sh    # Both BE + FE"
