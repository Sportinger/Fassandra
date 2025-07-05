#!/bin/bash

# Enhanced Local Development Deployment Script
# Usage: ./deploy_local.sh [target] [options]

set -e

# Default values
TARGET="all"
NO_CACHE=false
RESET_DB=false
CLEAN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        all|frontend|backend|db)
            TARGET="$1"
            shift
            ;;
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
        --help)
            echo "🏠 Local Development Deployment Script"
            echo ""
            echo "Usage: ./deploy_local.sh [target] [options]"
            echo ""
            echo "Targets:"
            echo "  all        Rebuild everything (default)"
            echo "  frontend   Rebuild just frontend"
            echo "  backend    Rebuild just backend"
            echo "  db         Reset database only"
            echo ""
            echo "Options:"
            echo "  --no-cache   Force rebuild without Docker cache"
            echo "  --reset-db   Reset database (drop volumes)"
            echo "  --clean      Clean up old containers/images first"
            echo "  --help       Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./deploy_local.sh                           # Default: rebuild all, keep DB"
            echo "  ./deploy_local.sh all --reset-db --no-cache # Full rebuild + DB reset + no cache"
            echo "  ./deploy_local.sh frontend --no-cache       # Just frontend, no cache"
            echo "  ./deploy_local.sh backend                   # Just backend, with cache"
            echo "  ./deploy_local.sh db --reset                # Just reset database"
            echo "  ./deploy_local.sh all --clean               # Full rebuild + cleanup"
            exit 0
            ;;
        *)
            echo "❌ Unknown parameter: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🏠 Starting Local Development Deployment..."
echo "📋 Target: $TARGET"
echo "🔧 Options: no-cache=$NO_CACHE, reset-db=$RESET_DB, clean=$CLEAN"

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run from project root."
    exit 1
fi

# Create/update local environment file
echo "📝 Setting up local environment..."
cat > .env.local << EOF
# Local Development Environment (HTTPS)
APP_HOSTNAME=192.168.2.111
APP_DOMAIN=192.168.2.111:8443
FRONTEND_PORT=8080
FRONTEND_HTTPS_PORT=8443
BACKEND_PORT=3001
DATABASE_PORT=5432
PGADMIN_PORT=5050

# API URLs for local development (HTTPS)
VITE_API_BASE_URL=https://192.168.2.111:8443
VITE_WS_BASE_URL=wss://192.168.2.111:8443/api/collab

# CORS Origins for local (HTTPS + HTTP)
CORS_ORIGINS=https://192.168.2.111:8443,http://192.168.2.111:8080,http://localhost:8080,https://localhost:8443
ALLOWED_ORIGINS=https://192.168.2.111:8443,http://192.168.2.111:8080,http://localhost:8080,https://localhost:8443

# Database configuration
DATABASE_URL=postgresql://postgres:password@db:5432/pessoa_db
POSTGRES_DB=pessoa_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# PgAdmin configuration
PGADMIN_DEFAULT_EMAIL=admin@pessoa.local
PGADMIN_DEFAULT_PASSWORD=admin123

# SSL (optional for local - will use if certificates exist)
SSL_CERT_PATH=./ssl/localhost.pem
SSL_KEY_PATH=./ssl/localhost-key.pem

# Environment
ENVIRONMENT=development
RUST_LOG=debug
EOF

# Stop existing containers
echo "📦 Stopping existing containers..."
docker-compose --env-file .env.local down 2>/dev/null || true

# Clean up if requested
if [ "$CLEAN" = true ]; then
    echo "🧹 Cleaning up old containers and volumes..."
    docker-compose --env-file .env.local down -v --remove-orphans 2>/dev/null || true
    docker system prune -f
fi

# Reset database if requested
if [ "$RESET_DB" = true ]; then
    echo "🗄️ Resetting database volumes..."
    docker-compose --env-file .env.local down -v 2>/dev/null || true
    docker volume rm dev_postgres_data 2>/dev/null || true
fi

# Handle database-only reset
if [ "$TARGET" = "db" ]; then
    echo "🗄️ Resetting database only..."
    docker-compose --env-file .env.local down 2>/dev/null || true
    docker volume rm dev_postgres_data 2>/dev/null || true
    docker-compose --env-file .env.local up -d db
    echo "✅ Database reset complete!"
    exit 0
fi

# Set build options
BUILD_OPTS=""
if [ "$NO_CACHE" = true ]; then
    BUILD_OPTS="--no-cache"
fi

# Build based on target
case $TARGET in
    "all")
        echo "🔨 Building all services..."
        docker-compose --env-file .env.local build $BUILD_OPTS
        ;;
    "frontend")
        echo "🔨 Building frontend only..."
        docker-compose --env-file .env.local build $BUILD_OPTS frontend
        ;;
    "backend")
        echo "🔨 Building backend only..."
        docker-compose --env-file .env.local build $BUILD_OPTS backend
        ;;
esac

# Start services
echo "🚀 Starting local services..."
docker-compose --env-file .env.local up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# Check if services are running
echo "🔍 Checking service status..."
docker-compose --env-file .env.local ps

# Test local endpoints
echo "🧪 Testing local endpoints..."
echo "⏳ Waiting for backend to be ready..."
sleep 5

# Test backend (through HTTPS frontend proxy)
if curl -f -s -k https://192.168.2.111:8443/api/health >/dev/null 2>&1; then
    echo "✅ Backend is running!"
else
    echo "⚠️  Backend may still be starting up..."
fi

# Test frontend HTTPS
if curl -f -s -k https://192.168.2.111:8443 >/dev/null 2>&1; then
    echo "✅ Frontend HTTPS is running!"
else
    echo "⚠️  Frontend HTTPS may still be starting up..."
fi

# Test frontend HTTP (should redirect)
if curl -f -s http://192.168.2.111:8080 >/dev/null 2>&1; then
    echo "✅ Frontend HTTP is running!"
else
    echo "⚠️  Frontend HTTP may still be starting up..."
fi

echo ""
echo "🎉 Local deployment complete!"
echo "🌐 Frontend HTTPS: https://192.168.2.111:8443 (PRIMARY)"
echo "🌐 Frontend HTTP: http://192.168.2.111:8080 (redirects to HTTPS)"
echo "🔧 Backend API: https://192.168.2.111:8443/api"
echo "🗄️  PgAdmin: http://localhost:5050"
echo "📊 Database: postgresql://postgres:password@localhost:5432/pessoa_db"
echo ""
echo "📋 To view logs: docker-compose --env-file .env.local logs -f"
echo "🛑 To stop: docker-compose --env-file .env.local down" 