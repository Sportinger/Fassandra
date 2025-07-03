#!/bin/bash

# Production Deployment Script for pessoa.theater
# Usage: ./scripts/deploy_production.sh

set -e

echo "🚀 Starting Production Deployment (pessoa.theater)..."

# Stop any existing production containers
echo "📦 Stopping existing production containers..."
docker-compose -f docker-compose.prod.yml --env-file .env.production down 2>/dev/null || true

# Build images
echo "🔨 Building production images..."
docker-compose -f docker-compose.prod.yml --env-file .env.production build --no-cache

# Start production services
echo "🚀 Starting production services..."
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."
docker-compose -f docker-compose.prod.yml --env-file .env.production ps

# Test production endpoint
echo "🧪 Testing production endpoint..."
if curl -f -s https://pessoa.theater/api/health >/dev/null 2>&1; then
    echo "✅ Production deployment successful!"
    echo "🌐 Production available at: https://pessoa.theater"
    echo "🔧 PgAdmin available at: http://localhost:5050"
else
    echo "❌ Production deployment may have issues"
    echo "📋 Check logs with: docker-compose -f docker-compose.prod.yml --env-file .env.production logs"
fi

echo "🎉 Production deployment complete!" 