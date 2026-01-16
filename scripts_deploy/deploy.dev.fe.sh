#!/bin/bash

# DEV DEPLOYMENT - FRONTEND ONLY (SERVER-SIDE BUILD)
# Usage: ./scripts_deploy/deploy.dev.fe.sh [--no-cache]
#
# Syncs frontend source to server, builds there, restarts container.
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

# Get git info for version endpoint
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

echo "DEV DEPLOYMENT - FRONTEND ONLY"
echo "==============================="
echo "Branch: $GIT_BRANCH"

# TEST CONNECTION
echo "[1/4] Testing server connection..."
if ! ssh -o ConnectTimeout=5 "$USER@$SERVER" "echo 'Connected'" >/dev/null 2>&1; then
    echo "Cannot connect to $SERVER"
    exit 1
fi
echo "Connected to $SERVER"

# SYNC FRONTEND FILES
echo "[2/4] Syncing frontend files..."
rsync -az --delete \
    --exclude 'node_modules/' \
    --exclude 'dist/' \
    --exclude '.git/' \
    --exclude '*.swp' \
    --exclude '.env' \
    --exclude 'android/' \
    --exclude 'ios/' \
    ./frontend/ "$USER@$SERVER:$APP_DIR/frontend/"

echo "Frontend files synced"

# SYNC ENV FILE (for build args)
echo "[3/4] Syncing config..."
if [ -f ".env.prod" ]; then
    rsync -az ./.env.prod "$USER@$SERVER:$APP_DIR/"
fi
rsync -az ./docker-compose.dev.server.yml "$USER@$SERVER:$APP_DIR/"

# BUILD AND DEPLOY ON SERVER
echo "[4/4] Building and deploying on server..."
ssh "$USER@$SERVER" "APP_DIR='$APP_DIR' DEV_DOMAIN='$DEV_DOMAIN' BUILD_OPTS='$BUILD_OPTS' GIT_BRANCH='$GIT_BRANCH' bash -s" << 'DEPLOY_SCRIPT'
set -euo pipefail
cd "$APP_DIR"

# Load environment for build args
if [ -f .env.dev ]; then
    set -a; . .env.dev; set +a
elif [ -f .env.prod ]; then
    set -a; . .env.prod; set +a
fi

if [ -z "${VITE_GOOGLE_CLIENT_ID:-}" ]; then
    echo "VITE_GOOGLE_CLIENT_ID not set"; exit 1
fi

# Build frontend image
echo "Building frontend image..."
cd frontend
DOCKER_BUILDKIT=1 docker build $BUILD_OPTS \
    -f Dockerfile.prod \
    --build-arg VITE_API_BASE_URL=https://$DEV_DOMAIN \
    --build-arg VITE_WS_BASE_URL=wss://$DEV_DOMAIN/api/collab \
    --build-arg VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    --build-arg GIT_BRANCH="$GIT_BRANCH" \
    --build-arg ENVIRONMENT=development \
    -t mylayer-frontend:dev .
cd ..

echo "Frontend image built"

# Restart frontend container
echo "Restarting frontend container..."
docker compose -f docker-compose.dev.server.yml --env-file .env.dev up -d --force-recreate dev-frontend

echo "Waiting for frontend..."
sleep 5

echo ""
echo "Container status:"
docker compose -f docker-compose.dev.server.yml ps dev-frontend

echo ""
echo -n "Frontend health: "
if curl -sI "https://$DEV_DOMAIN" | head -1 | grep -q "200\|301\|302\|304"; then
  echo "OK"
else
  echo "Starting..."
fi
DEPLOY_SCRIPT

if [ $? -ne 0 ]; then
    echo "Deployment FAILED"; exit 1
fi

echo "==============================="
echo "DEV FRONTEND DEPLOYED"
echo "URL: https://$DEV_DOMAIN"
echo ""
echo "View logs:"
echo "   ssh $USER@$SERVER 'cd $APP_DIR && docker compose -f docker-compose.dev.server.yml logs -f dev-frontend'"
