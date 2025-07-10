#!/bin/bash
# 🔄 Development Reset Script
# Safely resets development environment while preserving networking

set -e

echo "🔄 Starting Pessoa Development Reset..."

# 1. Backup current data (optional)
echo "📦 Creating database backup..."
mkdir -p backups
docker compose exec db pg_dump -U pessoa_user -d pessoa_db > "backups/backup_$(date +%Y%m%d_%H%M%S).sql" || echo "⚠️ Backup failed (database might be empty)"

# 2. Stop services gracefully
echo "🛑 Stopping services..."
docker compose down

# 3. Clean volumes (preserves network configuration)
echo "🧹 Cleaning volumes..."
docker volume rm -f \
    dev_postgres_data \
    dev_cargo_cache \
    dev_target_cache \
    dev_pgadmin_data || echo "⚠️ Some volumes already removed"

# 4. Clean build cache
echo "🧹 Cleaning build cache..."
docker builder prune -f

# 5. Start with proper networking
echo "🚀 Starting fresh environment..."
COMPOSE_PROJECT_NAME=pessoa \
VITE_BACKEND_URL="" \
VITE_API_BASE_URL="" \
VITE_WS_BASE_URL="" \
docker compose up -d --build

# 6. Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# 7. Verify networking
echo "🔍 Verifying networking..."
if docker compose exec frontend nslookup backend > /dev/null 2>&1; then
    echo "✅ DNS resolution working"
else
    echo "⚠️ DNS resolution failed, using IP address fallback"
    BACKEND_IP=$(docker compose exec backend hostname -i | tr -d '\r\n')
    docker compose down frontend
    VITE_BACKEND_URL="http://${BACKEND_IP}:3001" \
    VITE_API_BASE_URL="" \
    VITE_WS_BASE_URL="" \
    docker compose up -d frontend
fi

# 8. Health check
echo "🏥 Running health checks..."
sleep 5
if curl -s http://localhost:3001/health | grep -q "healthy"; then
    echo "✅ Backend healthy"
else
    echo "❌ Backend health check failed"
    exit 1
fi

if curl -s -k https://localhost:8443 | grep -q "Pessoa"; then
    echo "✅ Frontend healthy"
else
    echo "❌ Frontend health check failed"
    exit 1
fi

echo ""
echo "🎉 Development reset complete!"
echo ""
echo "📊 Environment Status:"
echo "   Frontend: https://localhost:8443"
echo "   Backend:  http://localhost:3001"
echo "   Database: localhost:5432"
echo "   Admin:    admin@pessoa.de (check backend logs for password)"
echo ""
echo "💡 To register a new user, clear browser storage first:"
echo "   localStorage.clear(); sessionStorage.clear(); location.reload();" 