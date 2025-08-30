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

# --- Pre-flight local integrity checks ---
echo "🔎 Verifying local repo state before deploy..."

# 1) Caddy must route /login/google to backend
if ! grep -q "/login/google" "$PROJECT_ROOT/Caddyfile"; then
  echo "❌ Caddyfile missing /login/google route. Aborting deploy."; exit 1; fi

# 2) Frontend CSP must allow Google domains in index.html
if ! grep -q "accounts.google.com" "$PROJECT_ROOT/frontend/index.html"; then
  echo "❌ frontend/index.html missing accounts.google.com in CSP. Aborting deploy."; exit 1; fi

# 3) Frontend must skip CSRF for /login/*
if ! grep -q "path.startsWith('/login/')" "$PROJECT_ROOT/frontend/src/services/ApiService.ts"; then
  echo "❌ ApiService.ts missing CSRF skip for /login/*. Aborting deploy."; exit 1; fi

# 4) Google popup mode in Login.tsx
if ! grep -q "ux_mode: 'popup'" "$PROJECT_ROOT/frontend/src/components/Login.tsx"; then
  echo "❌ Login.tsx missing ux_mode: 'popup'. Aborting deploy."; exit 1; fi

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
    # Load environment for build args
    if [ -f ../.env.prod ]; then
        set -a; . ../.env.prod; set +a
    fi
    DOCKER_BUILDKIT=1 docker build -q --no-cache \
        -f Dockerfile.prod \
        --build-arg VITE_API_BASE_URL=https://$DOMAIN \
        --build-arg VITE_WS_BASE_URL=wss://$DOMAIN/api/collab \
        --build-arg VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
        -t mylayer-frontend:latest . >/dev/null 2>&1
    cd ..
    docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --force-recreate frontend >/dev/null 2>&1

    # Verify built bundle contains Google client ID
    if ! docker exec mylayer_pessoa_frontend sh -lc "grep -R -q \"$VITE_GOOGLE_CLIENT_ID\" /srv || grep -R -q \"${VITE_GOOGLE_CLIENT_ID%%.*}\" /srv" >/dev/null 2>&1; then
        echo "❌ Built frontend bundle does not contain VITE_GOOGLE_CLIENT_ID. Aborting."; exit 1; fi
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

# --- Post-deploy remote checks ---
echo "🔎 Verifying remote environment..."
# 1) Backend environment
if ! docker exec mylayer_pessoa_backend sh -lc "printenv | grep -q '^GOOGLE_CLIENT_ID='"; then
  echo "❌ Backend missing GOOGLE_CLIENT_ID env"; exit 1; fi
if ! docker exec mylayer_pessoa_backend sh -lc "printenv | grep -q '^ALLOWED_ORIGINS='"; then
  echo "❌ Backend missing ALLOWED_ORIGINS env"; exit 1; fi

# 2) Caddy routing for /login/google
if ! docker exec mylayer_caddy sh -lc "caddy adapt --config /etc/caddy/Caddyfile --pretty | grep -q '/login/google'"; then
  echo "❌ Caddy is not routing /login/google to backend"; exit 1; fi

# 3) Sanity check: /login/google reachable (expect non-405)
HTTP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"id_token":"dummy"}' https://$DOMAIN/login/google || true)
if [ "$HTTP_STATUS" = "405" ]; then
  echo "❌ /login/google returned 405 (not routed to backend). Aborting"; exit 1; fi

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
