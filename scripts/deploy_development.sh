#!/bin/bash

# Development Deployment Script for mylayer.org
# Usage: ./scripts/deploy_development.sh

set -e

echo "🧪 Starting Development Deployment (mylayer.org)..."

# Stop any existing development containers
echo "📦 Stopping existing development containers..."
docker-compose -f docker-compose.staging.yml --env-file .env.development down 2>/dev/null || true

# Build images
echo "🔨 Building development images..."
docker-compose -f docker-compose.staging.yml --env-file .env.development build --no-cache

# Start development services
echo "🚀 Starting development services..."
docker-compose -f docker-compose.staging.yml --env-file .env.development up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."
docker-compose -f docker-compose.staging.yml --env-file .env.development ps

# Test development endpoint
echo "🧪 Testing development endpoint..."
if curl -f -s https://mylayer.org/api/health >/dev/null 2>&1; then
    echo "✅ Development deployment successful!"
    echo "🌐 Development available at: https://mylayer.org"
    echo "🔧 PgAdmin available at: http://localhost:5051"
else
    echo "❌ Development deployment may have issues"
    echo "📋 Check logs with: docker-compose -f docker-compose.staging.yml --env-file .env.development logs"
fi

echo "🎉 Development deployment complete!" 