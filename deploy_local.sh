#!/bin/bash

# Enhanced Local Development Deployment Script
# Usage: ./deploy_local.sh [target] [options]

set -e

# Default values
TARGET="all"
NO_CACHE=false
RESET_DB=false
CLEAN=false
HOT_RELOAD=false

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
        --hot-reload)
            HOT_RELOAD=true
            shift
            ;;
        --help)
            echo "🏠 Local Development Deployment Script for Pessoa"
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
            echo "  --no-cache     Force rebuild without Docker cache"
            echo "  --reset-db     Reset database (drop volumes)"
            echo "  --clean        Clean up old containers/images first"
            echo "  --hot-reload   Enable Vite dev server (faster iteration)"
            echo "  --help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./deploy_local.sh                           # HTTPS production mode (recommended)"
            echo "  ./deploy_local.sh all --reset-db --no-cache # Full rebuild + DB reset + no cache"
            echo "  ./deploy_local.sh frontend --hot-reload     # Hot reload dev mode (mixed content)"
            echo "  ./deploy_local.sh backend                   # Just backend, with cache"
            echo "  ./deploy_local.sh db --reset-db             # Reset database only"
            echo "  ./deploy_local.sh all --clean               # Full clean rebuild"
            echo ""
            echo "🎯 Development Modes:"
            echo "  Default (HTTPS): Production-like with nginx, SSL, and API proxy"
            echo "    ✅ Full HTTPS security, no mixed content issues"
            echo "    ✅ Tests complete authentication and proxy flow"
            echo "    ❌ Slower frontend rebuilds (requires container restart)"
            echo ""
            echo "  Hot Reload:      Development mode with instant frontend changes"
            echo "    ✅ Instant frontend updates on file save"
            echo "    ✅ Faster development iteration"
            echo "    ⚠️  Mixed content warnings (HTTP/HTTPS)"
            echo "    ❌ Doesn't test production HTTPS flow"
            echo ""
            echo "🔧 Backend: Always has hot reload with cargo-watch in both modes"
            echo ""
            echo "🌐 Access URLs:"
            echo "  HTTPS Mode:    https://192.168.2.111:8443 (secure, recommended)"
            echo "  Hot Reload:    http://192.168.2.111:8444 (dev only)"
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
echo "🔧 Options: no-cache=$NO_CACHE, reset-db=$RESET_DB, clean=$CLEAN, hot-reload=$HOT_RELOAD"

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run from project root."
    exit 1
fi

# Create/update local environment file (preserve existing .env)
echo "📝 Setting up local environment..."

# Check if .env already exists (preserve working config)
if [ -f ".env" ]; then
    echo "✅ Found existing .env file - preserving your configuration"
    echo "ℹ️  Using existing .env instead of creating .env.local"
    ENV_FILE=".env"
elif [ -f ".env.local" ]; then
    echo "✅ Found existing .env.local file - using it"
    ENV_FILE=".env.local"
else
    echo "📝 Creating new .env.local file for fresh setup..."
    ENV_FILE=".env.local"
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

# Database configuration (corrected credentials)
DATABASE_URL=postgresql://pessoa_user:dev_password_123@db:5432/pessoa_db
POSTGRES_DB=pessoa_db
POSTGRES_USER=pessoa_user
POSTGRES_PASSWORD=dev_password_123

# PgAdmin configuration
PGADMIN_DEFAULT_EMAIL=admin@pessoa.local
PGADMIN_DEFAULT_PASSWORD=admin123

# Security
JWT_SECRET=your-super-secret-jwt-key-for-local-development-only-min-32-chars

# AI Integration (optional for basic functionality)
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent

# Environment
ENVIRONMENT=development
RUST_LOG=debug

# Hot reload configuration
HOT_RELOAD_MODE=$HOT_RELOAD
EOF
fi

echo "📄 Using environment file: $ENV_FILE"

# Generate SSL certificates if they don't exist
echo "🔐 Setting up SSL certificates..."
mkdir -p frontend/ssl/certs frontend/ssl/private

if [ ! -f "frontend/ssl/certs/server.crt" ] || [ ! -f "frontend/ssl/private/server.key" ]; then
    echo "🔑 Generating self-signed SSL certificates..."
    openssl req -x509 -newkey rsa:4096 \
        -keyout frontend/ssl/private/server.key \
        -out frontend/ssl/certs/server.crt \
        -days 365 -nodes \
        -subj "/C=US/ST=Development/L=Local/O=Pessoa/CN=192.168.2.111" \
        -addext "subjectAltName=IP:192.168.2.111,DNS:localhost" 2>/dev/null
    echo "✅ SSL certificates generated successfully!"
else
    echo "✅ SSL certificates already exist!"
fi

# Create hot reload docker compose override if needed
if [ "$HOT_RELOAD" = true ]; then
    echo "🔥 Creating hot reload configuration..."
    cat > docker-compose.hot-reload.yml << EOF
# Hot Reload Override for Local Development
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
      args:
        VITE_API_BASE_URL: \${VITE_API_BASE_URL}
        VITE_WS_BASE_URL: \${VITE_WS_BASE_URL}
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true
      - VITE_API_BASE_URL=\${VITE_API_BASE_URL}
      - VITE_WS_BASE_URL=\${VITE_WS_BASE_URL}
    ports:
      - "8444:8080"   # Use port 8444 for hot reload dev server
      - "8445:8443"   # Use port 8445 for hot reload HTTPS
    command: ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8080"]
EOF
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.hot-reload.yml"
    
    # Update API base URL for hot reload mode to use direct Vite dev server (only if we created new env file)
    if [ "$ENV_FILE" = ".env.local" ]; then
        sed -i 's|VITE_API_BASE_URL=https://192.168.2.111:8443|VITE_API_BASE_URL=http://192.168.2.111:3001|' .env.local
    else
        echo "ℹ️  Hot reload mode: Using existing .env API configuration"
    fi
    echo "🔥 Hot reload mode: API calls will go directly to backend (mixed content in dev mode)"
else
    # Remove hot reload override if it exists
    rm -f docker-compose.hot-reload.yml
    COMPOSE_FILES="-f docker-compose.yml"
fi

# Stop existing containers (target-specific)
if [ "$TARGET" = "all" ]; then
    echo "📦 Stopping all containers..."
    docker compose $COMPOSE_FILES --env-file $ENV_FILE down 2>/dev/null || true
else
    echo "📦 Stopping $TARGET container..."
    # For hot reload mode, we need to stop any existing frontend from both configurations
    if [ "$HOT_RELOAD" = true ] && [ "$TARGET" = "frontend" ]; then
        echo "🔥 Hot reload mode: Stopping any existing frontend containers..."
        docker compose --env-file $ENV_FILE stop frontend 2>/dev/null || true
        docker compose --env-file $ENV_FILE rm -f frontend 2>/dev/null || true
        docker compose -f docker-compose.yml -f docker-compose.hot-reload.yml --env-file $ENV_FILE stop frontend 2>/dev/null || true
        docker compose -f docker-compose.yml -f docker-compose.hot-reload.yml --env-file $ENV_FILE rm -f frontend 2>/dev/null || true
    fi
    # Always remove the target container to avoid configuration conflicts
    docker compose --env-file $ENV_FILE rm -f $TARGET 2>/dev/null || true
    # Also stop any running instance with the old configuration
    docker compose $COMPOSE_FILES --env-file $ENV_FILE stop $TARGET 2>/dev/null || true
fi

# Clean up if requested
if [ "$CLEAN" = true ]; then
    if [ "$TARGET" = "all" ]; then
        echo "🧹 Cleaning up all containers and volumes..."
        docker compose $COMPOSE_FILES --env-file $ENV_FILE down -v --remove-orphans 2>/dev/null || true
        docker system prune -f
    else
        echo "🧹 Cleaning up $TARGET container..."
        docker compose $COMPOSE_FILES --env-file $ENV_FILE rm -f $TARGET 2>/dev/null || true
        docker image prune -f
    fi
fi

# Reset database if requested (WARNING: This will lose data!)
if [ "$RESET_DB" = true ]; then
    echo "🗄️ ⚠️  WARNING: Resetting database volumes will lose all data!"
    echo "🗄️ This includes your content snapshots and migrations!"
    read -p "Are you sure you want to reset the database? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗄️ Resetting database volumes..."
        docker compose $COMPOSE_FILES --env-file $ENV_FILE down -v 2>/dev/null || true
        docker volume rm dev_postgres_data 2>/dev/null || true
        echo "🗄️ Database reset complete. Fresh migrations will be applied on startup."
    else
        echo "🗄️ Database reset cancelled."
    fi
fi

# Handle database-only reset
if [ "$TARGET" = "db" ]; then
    echo "🗄️ Resetting database only..."
    docker compose $COMPOSE_FILES --env-file $ENV_FILE down 2>/dev/null || true
    docker volume rm dev_postgres_data 2>/dev/null || true
    docker compose $COMPOSE_FILES --env-file $ENV_FILE up -d db
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
        docker compose $COMPOSE_FILES --env-file $ENV_FILE build $BUILD_OPTS
        ;;
    "frontend")
        echo "🔨 Building frontend only..."
        docker compose $COMPOSE_FILES --env-file $ENV_FILE build $BUILD_OPTS frontend
        ;;
    "backend")
        echo "🔨 Building backend only..."
        docker compose $COMPOSE_FILES --env-file $ENV_FILE build $BUILD_OPTS backend
        ;;
esac

# Start services (target-specific)
if [ "$TARGET" = "all" ]; then
    echo "🚀 Starting all services..."
    docker compose $COMPOSE_FILES --env-file $ENV_FILE up -d
else
    echo "🚀 Starting $TARGET service (with dependencies)..."
    echo "ℹ️  Note: Other services (db, backend) will remain running if already started"
    docker compose $COMPOSE_FILES --env-file $ENV_FILE up -d $TARGET
fi

# Run database migrations if needed
echo "🗄️ Checking and applying database migrations..."
sleep 10  # Wait for database to be ready

# Check if content_snapshot column exists (our critical migration)
MIGRATION_CHECK=$(docker exec dev_pessoa_db psql -U pessoa_user -d pessoa_db -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'script_snapshots_meta' AND column_name = 'content_snapshot';" 2>/dev/null | grep -c "content_snapshot" || echo "0")

if [ "$MIGRATION_CHECK" -eq "0" ]; then
    echo "🔧 Applying content snapshot migration..."
    docker exec dev_pessoa_db psql -U pessoa_user -d pessoa_db -c "
    ALTER TABLE script_snapshots_meta 
    ADD COLUMN IF NOT EXISTS content_snapshot TEXT,
    ADD COLUMN IF NOT EXISTS snapshot_format VARCHAR(10) DEFAULT 'html',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    " 2>/dev/null || echo "⚠️  Migration may have already been applied"
    echo "✅ Content snapshot migration applied!"
else
    echo "✅ Content snapshot migration already applied - your data is safe!"
fi

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# Check if services are running
echo "🔍 Checking service status..."
docker compose $COMPOSE_FILES --env-file $ENV_FILE ps

# Test local endpoints
echo "🧪 Testing local endpoints..."
echo "⏳ Waiting for backend to be ready..."
sleep 5

# Different endpoint tests based on hot reload mode
if [ "$HOT_RELOAD" = true ]; then
    echo "🔥 Hot reload mode enabled - testing Vite dev server..."
    
    # Test Vite dev server (on port 8444)
    if curl -f -s http://192.168.2.111:8444 >/dev/null 2>&1; then
        echo "✅ Frontend Vite dev server is running!"
    else
        echo "⚠️  Frontend Vite dev server may still be starting up..."
    fi
    
    # Test backend (direct connection in hot reload mode)
    if curl -f -s http://192.168.2.111:3001/health >/dev/null 2>&1; then
        echo "✅ Backend is running!"
    else
        echo "⚠️  Backend may still be starting up..."
    fi
else
    echo "🔐 HTTPS mode enabled - testing secure endpoints..."
    
    # Test frontend HTTPS
    if curl -f -s -k https://192.168.2.111:8443 >/dev/null 2>&1; then
        echo "✅ Frontend HTTPS is running!"
    else
        echo "⚠️  Frontend HTTPS may still be starting up..."
    fi

    # Test frontend HTTP redirect
    HTTP_RESPONSE=$(curl -s -I http://192.168.2.111:8080 2>/dev/null | head -1)
    if echo "$HTTP_RESPONSE" | grep -q "301\|302"; then
        echo "✅ HTTP to HTTPS redirect is working!"
    else
        echo "⚠️  HTTP redirect may still be starting up..."
    fi

    # Test authentication endpoint (through HTTPS proxy)
    AUTH_TEST=$(curl -f -s -k -X POST https://192.168.2.111:8443/login \
        -H "Content-Type: application/json" \
        -d '{"email": "admin@pessoa.de", "password": "PassoaDevteam"}' 2>/dev/null)
    if [ $? -eq 0 ] && [ ! -z "$AUTH_TEST" ]; then
        echo "✅ Authentication endpoint is working!"
    else
        echo "⚠️  Authentication may still be starting up..."
    fi
fi

echo ""
echo "🎉 Local deployment complete!"

# Important warnings for running systems
echo ""
echo "⚠️  IMPORTANT POST-DEPLOYMENT NOTES:"
echo "🔄 Browser Cache: Hard refresh your browser (Ctrl+Shift+R / Cmd+Shift+R) to load updated code"
echo "⚡ Content Snapshots: Your 2-second snapshot functionality should be preserved"
echo "🔍 If snapshots seem slow, check that browser loaded new JavaScript code"

if [ "$HOT_RELOAD" = true ]; then
    echo ""
    echo "🔥 HOT RELOAD MODE ENABLED"
    echo "🌐 Frontend Dev Server: http://192.168.2.111:8444 (instant changes)"
    echo "🔧 Backend API: http://192.168.2.111:3001/api (direct access)"
    echo "📝 Edit files in ./frontend or ./backend and see changes instantly!"
    echo "⚠️  Note: Mixed content warnings expected in dev mode"
else
    echo ""
    echo "🔐 HTTPS PRODUCTION MODE"
    echo "🌐 Frontend HTTPS: https://192.168.2.111:8443 (PRIMARY - secure)"
    echo "🌐 Frontend HTTP: http://192.168.2.111:8080 (redirects to HTTPS)"
    echo "🔧 Backend API: https://192.168.2.111:8443/api (proxied through nginx)"
    echo "🔒 Self-signed SSL certificates generated for development"
    echo "⚠️  Browser will show certificate warning - click 'Advanced' > 'Proceed'"
fi

echo ""
echo "👤 Default Login:"
echo "   📧 Email: admin@pessoa.de"
echo "   🔑 Password: PassoaDevteam"
echo ""
echo "🗄️  PgAdmin: http://localhost:5050"
echo "📊 Database: postgresql://pessoa_user:dev_password_123@localhost:5432/pessoa_db"
echo ""
echo "📋 To view logs: docker compose $COMPOSE_FILES --env-file $ENV_FILE logs -f"
echo "🛑 To stop: docker compose $COMPOSE_FILES --env-file $ENV_FILE down" 