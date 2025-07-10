#!/bin/bash

echo "🧹 Starting clean rebuild with automatic fixes..."

# 1. Clean rebuild
echo "🗑️ Stopping and removing all containers and volumes..."
docker compose down -v

echo "🧽 Cleaning Docker system..."
docker system prune -a -f

echo "🏗️ Building and starting containers..."
docker compose up --build -d

echo "⏳ Waiting for containers to fully start..."
sleep 30

# 2. Apply fixes
echo "🔧 Applying post-rebuild fixes..."
./scripts/post_rebuild_fixes.sh

echo "🎉 Clean rebuild with fixes completed!"
echo "📋 Summary of applied fixes:"
echo "   - Found and configured backend IP address"
echo "   - Database migrations run automatically on startup"
echo "   - Restarted frontend with new configuration"
echo ""
echo "🌐 Your development environment should now be ready at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend: http://localhost:3001" 