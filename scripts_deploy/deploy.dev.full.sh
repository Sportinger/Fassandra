#!/bin/bash

# DEV DEPLOYMENT - BACKEND + FRONTEND (SERVER-SIDE BUILD)
# Usage: ./scripts_deploy/deploy.dev.full.sh [--no-cache] [--backend-only] [--frontend-only]
#
# Syncs source files to server, builds there, restarts containers.
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
BUILD_BACKEND=true
BUILD_FRONTEND=true
for arg in "$@"; do
    case "$arg" in
        --no-cache)
            BUILD_OPTS="--no-cache"
            echo "FORCING FRESH BUILD (no cache)"
            ;;
        --backend-only)
            BUILD_BACKEND=true
            BUILD_FRONTEND=false
            ;;
        --frontend-only)
            BUILD_FRONTEND=true
            BUILD_BACKEND=false
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Usage: $0 [--no-cache] [--backend-only] [--frontend-only]"
            exit 1
            ;;
    esac
done

# Error handler
trap 'echo "DEPLOYMENT FAILED AT LINE $LINENO"' ERR

# Capture git info locally before deployment
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "DEV DEPLOYMENT - BACKEND + FRONTEND"
echo "Branch: $GIT_BRANCH | Commit: $GIT_COMMIT"
echo "===================================="
echo "Build backend: $BUILD_BACKEND"
echo "Build frontend: $BUILD_FRONTEND"

# TEST CONNECTION
echo "[1/5] Testing server connection..."
if ! ssh -o ConnectTimeout=5 "$USER@$SERVER" "echo 'Connected'" >/dev/null 2>&1; then
    echo "Cannot connect to $SERVER"
    exit 1
fi
echo "Connected to $SERVER"

# SYNC FILES
echo "[2/5] Syncing source files..."

if [ "$BUILD_BACKEND" = true ]; then
    echo "  Syncing backend..."
    rsync -az --delete \
        --exclude 'target/' \
        --exclude '.git/' \
        --exclude '*.swp' \
        --exclude '.env' \
        --exclude 'uploads/' \
        ./backend/ "$USER@$SERVER:$APP_DIR/backend/"
fi

if [ "$BUILD_FRONTEND" = true ]; then
    echo "  Syncing frontend..."
    rsync -az --delete \
        --exclude 'node_modules/' \
        --exclude 'dist/' \
        --exclude '.git/' \
        --exclude '*.swp' \
        --exclude '.env' \
        --exclude 'android/' \
        --exclude 'ios/' \
        ./frontend/ "$USER@$SERVER:$APP_DIR/frontend/"
fi

# SYNC YJS-PARSER
echo "[3/5] Syncing yjs-parser..."
rsync -az --delete \
    --exclude 'node_modules/' \
    --exclude '.git/' \
    --exclude '*.swp' \
    ./yjs-parser/ "$USER@$SERVER:$APP_DIR/yjs-parser/"

# SYNC CONFIG
echo "[4/5] Syncing config..."
if [ -f ".env.prod" ]; then
    rsync -az ./.env.prod "$USER@$SERVER:$APP_DIR/"
fi
if [ -f ".env.dev" ]; then
    rsync -az ./.env.dev "$USER@$SERVER:$APP_DIR/"
fi
rsync -az ./docker-compose.dev.server.yml "$USER@$SERVER:$APP_DIR/"

# BUILD AND DEPLOY ON SERVER
echo "[5/5] Building and deploying on server..."
ssh "$USER@$SERVER" "APP_DIR='$APP_DIR' DEV_DOMAIN='$DEV_DOMAIN' BUILD_OPTS='$BUILD_OPTS' BUILD_BACKEND='$BUILD_BACKEND' BUILD_FRONTEND='$BUILD_FRONTEND' GIT_BRANCH='$GIT_BRANCH' GIT_COMMIT='$GIT_COMMIT' BUILD_TIME='$BUILD_TIME' bash -s" << 'DEPLOY_SCRIPT'
set -euo pipefail
cd "$APP_DIR"

# Load environment for build args
if [ -f .env.dev ]; then
    set -a; . .env.dev; set +a
elif [ -f .env.prod ]; then
    set -a; . .env.prod; set +a
fi

# Install yjs-parser dependencies if needed
if [ -d "yjs-parser" ]; then
    echo "Checking yjs-parser dependencies..."
    if [ ! -d "yjs-parser/node_modules" ] || [ "yjs-parser/package.json" -nt "yjs-parser/node_modules" ]; then
        echo "Installing yjs-parser dependencies..."
        docker run --rm -v $PWD/yjs-parser:/app -w /app node:20-alpine npm install --production >/dev/null 2>&1
    fi
fi

# Build backend if requested
if [ "$BUILD_BACKEND" = true ]; then
    echo "Building backend image..."
    echo "  Branch: $GIT_BRANCH, Commit: $GIT_COMMIT"
    cd backend
    DOCKER_BUILDKIT=1 docker build $BUILD_OPTS \
        -f Dockerfile.prod \
        --target runtime \
        --build-arg GIT_BRANCH="$GIT_BRANCH" \
        --build-arg GIT_COMMIT="$GIT_COMMIT" \
        --build-arg BUILD_TIME="$BUILD_TIME" \
        --build-arg ENVIRONMENT=development \
        -t mylayer-backend:dev .
    cd ..
    echo "Backend image built"
fi

# Build frontend if requested
if [ "$BUILD_FRONTEND" = true ]; then
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
        --build-arg GIT_BRANCH="$GIT_BRANCH" \
        --build-arg ENVIRONMENT=development \
        -t mylayer-frontend:dev .
    cd ..
    echo "Frontend image built"
fi

# Restart containers
echo "Restarting containers..."
if [ "$BUILD_BACKEND" = true ]; then
    docker compose -f docker-compose.dev.server.yml --env-file .env.dev up -d --force-recreate dev-backend
fi
if [ "$BUILD_FRONTEND" = true ]; then
    docker compose -f docker-compose.dev.server.yml --env-file .env.dev up -d --force-recreate dev-frontend
fi

echo "Waiting for services..."
sleep 5

echo ""
echo "Container status:"
docker compose -f docker-compose.dev.server.yml ps

echo ""
echo "Health checks:"
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
echo "DEV DEPLOYMENT COMPLETE"
echo "URL: https://$DEV_DOMAIN"
echo ""
echo "View logs:"
echo "   ssh $USER@$SERVER 'cd $APP_DIR && docker compose -f docker-compose.dev.server.yml logs -f'"
