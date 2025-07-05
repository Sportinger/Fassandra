#!/bin/bash

# Local Development Deployment Script
# Usage: ./deploy_local.sh

set -e

echo "🏠 Starting Local Development Deployment..."

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

# Stop any existing containers
echo "📦 Stopping existing containers..."
docker-compose --env-file .env.local down 2>/dev/null || true

# Clean up old containers and volumes if requested
read -p "🧹 Clean up old containers and volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 Cleaning up old containers and volumes..."
    docker-compose --env-file .env.local down -v --remove-orphans 2>/dev/null || true
    docker system prune -f
fi

# Build images
echo "🔨 Building local images..."
docker-compose --env-file .env.local build --no-cache

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