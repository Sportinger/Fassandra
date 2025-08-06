#!/bin/bash

# LOCAL DEVELOPMENT DEPLOYMENT - OPTIMIZED FOR DEV ENVIRONMENT
# Usage: ./deploy.dev.sh [--no-cache]

set -e
set -o pipefail

# CONFIGURATION - LOCAL DEV SETTINGS
APP_NAME="pessoa-dev"
DOMAIN="localhost"
API_PORT="8089"
FRONTEND_PORT="3000"
COLLAB_PORT="8090"

# Parse arguments
BUILD_OPTS=""
if [[ "$1" == "--no-cache" ]]; then
    BUILD_OPTS="--no-cache"
    echo "🔄 FORCING FRESH BUILD (no cache)"
fi

# Error handler
trap 'echo "❌ DEPLOYMENT FAILED AT LINE $LINENO"' ERR

echo "🚀 LOCAL DEVELOPMENT DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# CHECK DOCKER
echo "🔍 Checking Docker..."
if ! docker --version >/dev/null 2>&1; then
    echo "❌ Docker is not installed or not running"
    exit 1
fi
echo "✅ Docker is running"

# CLEAN EXISTING CONTAINERS (DEV ONLY)
echo "🧹 Cleaning existing dev containers..."
docker compose -f docker-compose.yml down 2>/dev/null || true
docker stop $(docker ps -aq --filter "name=${APP_NAME}") 2>/dev/null || true
docker rm $(docker ps -aq --filter "name=${APP_NAME}") 2>/dev/null || true
echo "✅ Cleaned existing containers"

# BUILD PHASE
echo "🔨 Building backend for development..."
if ! DOCKER_BUILDKIT=1 docker build \
    $BUILD_OPTS \
    -f backend/Dockerfile.dev \
    -t ${APP_NAME}-backend:latest ./backend; then
    
    echo "⚠️  No Dockerfile.dev found, trying production Dockerfile with dev target..."
    if ! DOCKER_BUILDKIT=1 docker build \
        $BUILD_OPTS \
        -f backend/Dockerfile \
        --target development \
        -t ${APP_NAME}-backend:latest ./backend; then
        
        echo "⚠️  No dev target, using production build..."
        if ! DOCKER_BUILDKIT=1 docker build \
            $BUILD_OPTS \
            -f backend/Dockerfile \
            -t ${APP_NAME}-backend:latest ./backend; then
            echo "❌ Backend build FAILED"
            exit 1
        fi
    fi
fi
echo "✅ Backend built successfully"

echo "🔨 Building frontend for development..."
if ! DOCKER_BUILDKIT=1 docker build \
    $BUILD_OPTS \
    -f frontend/Dockerfile.dev \
    --build-arg VITE_API_BASE_URL=http://${DOMAIN}:${API_PORT} \
    --build-arg VITE_WS_BASE_URL=ws://${DOMAIN}:${COLLAB_PORT}/api/collab \
    -t ${APP_NAME}-frontend:latest ./frontend; then
    
    echo "⚠️  No Dockerfile.dev found, trying production Dockerfile..."
    if ! DOCKER_BUILDKIT=1 docker build \
        $BUILD_OPTS \
        -f frontend/Dockerfile \
        --build-arg VITE_API_BASE_URL=http://${DOMAIN}:${API_PORT} \
        --build-arg VITE_WS_BASE_URL=ws://${DOMAIN}:${COLLAB_PORT}/api/collab \
        -t ${APP_NAME}-frontend:latest ./frontend; then
        echo "❌ Frontend build FAILED"
        exit 1
    fi
fi
echo "✅ Frontend built successfully"

# CHECK REQUIRED FILES FOR DEV
echo "📋 Checking required files..."
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "⚠️  No docker-compose.yml found, looking for alternatives..."
    if [ -f "docker-compose.dev.yml" ]; then
        COMPOSE_FILE="docker-compose.dev.yml"
    elif [ -f "docker-compose.development.yml" ]; then
        COMPOSE_FILE="docker-compose.development.yml"
    else
        echo "❌ No suitable docker-compose file found for development"
        exit 1
    fi
fi
echo "✅ Using compose file: $COMPOSE_FILE"

if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  No .env file found, looking for alternatives..."
    if [ -f ".env.development" ]; then
        cp .env.development .env
        echo "✅ Using .env.development"
    elif [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env from .env.example (please review and update)"
    else
        echo "⚠️  No .env file found - services may use default values"
    fi
else
    echo "✅ .env file present"
fi

# START SERVICES
echo "🚀 Starting development services..."
if ! docker compose -f $COMPOSE_FILE up -d; then
    echo "❌ Failed to start services"
    echo "Showing docker compose logs:"
    docker compose -f $COMPOSE_FILE logs
    exit 1
fi

# WAIT FOR SERVICES
echo "⏳ Waiting for services to start..."
sleep 5

# CHECK CONTAINER STATUS
echo "📊 Checking container status..."
running_count=$(docker ps --filter "status=running" | grep -c "${APP_NAME}" || true)

if [ $running_count -ge 1 ]; then
    echo "✅ $running_count ${APP_NAME} container(s) running!"
else
    echo "⚠️  No ${APP_NAME} containers running"
    echo "Checking all containers:"
    docker ps
fi

# SHOW STATUS
echo ""
echo "📊 Final container status:"
docker compose -f $COMPOSE_FILE ps

# HEALTH CHECKS
echo ""
echo "🔍 Quick health check:"

# Database check
echo -n "Database: "
db_container=$(docker ps -qf "name=db\|postgres\|mysql" | head -1)
if [ -n "$db_container" ]; then
    if docker exec $db_container sh -c 'command -v pg_isready >/dev/null 2>&1 && pg_isready' >/dev/null 2>&1; then
        echo "✅ PostgreSQL Ready"
    elif docker exec $db_container sh -c 'command -v mysqladmin >/dev/null 2>&1 && mysqladmin ping' >/dev/null 2>&1; then
        echo "✅ MySQL Ready"
    else
        echo "⏳ Starting..."
    fi
else
    echo "⚠️  No database container found"
fi

# Frontend check
echo -n "Frontend: "
if curl -sI http://${DOMAIN}:${FRONTEND_PORT} | head -1 | grep -q "200\|301\|302\|304"; then
    echo "✅ http://${DOMAIN}:${FRONTEND_PORT}"
else
    echo "⏳ Starting... (will be available at http://${DOMAIN}:${FRONTEND_PORT})"
fi

# Backend check
echo -n "Backend API: "
if curl -sI http://${DOMAIN}:${API_PORT}/api | head -1 | grep -q "200\|301\|302\|404"; then
    echo "✅ http://${DOMAIN}:${API_PORT}/api"
else
    echo "⏳ Starting... (will be available at http://${DOMAIN}:${API_PORT}/api)"
fi

# WebSocket check
echo -n "WebSocket: "
echo "📍 ws://${DOMAIN}:${COLLAB_PORT}/api/collab"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ LOCAL DEVELOPMENT DEPLOYMENT COMPLETE"
echo ""
echo "🌐 Access points:"
echo "   Frontend:  http://${DOMAIN}:${FRONTEND_PORT}"
echo "   Backend:   http://${DOMAIN}:${API_PORT}/api"
echo "   WebSocket: ws://${DOMAIN}:${COLLAB_PORT}/api/collab"
echo ""
echo "📋 Useful commands:"
echo "   View logs:      docker compose -f $COMPOSE_FILE logs -f"
echo "   Stop services:  docker compose -f $COMPOSE_FILE down"
echo "   Restart:        docker compose -f $COMPOSE_FILE restart"
echo "   Shell access:   docker compose -f $COMPOSE_FILE exec [service] sh"
echo ""
echo "🔄 Hot reload should be enabled for development"