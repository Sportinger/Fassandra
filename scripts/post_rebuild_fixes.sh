#!/bin/bash

echo "🔧 Applying post-rebuild fixes..."

# 1. Find the backend container IP
echo "📡 Finding backend container IP..."
BACKEND_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' dev_pessoa_backend)
echo "Backend IP: $BACKEND_IP"

# 2. Update the .env file with the correct backend IP
echo "⚙️ Updating .env with backend IP..."
if grep -q "VITE_BACKEND_URL" .env; then
    sed -i "s|VITE_BACKEND_URL=.*|VITE_BACKEND_URL=\"http://$BACKEND_IP:3001\"|" .env
else
    echo "VITE_BACKEND_URL=\"http://$BACKEND_IP:3001\"" >> .env
fi

# 3. Database migrations now run automatically! 
echo "🗄️ Database migrations run automatically on startup - no manual intervention needed!"

# 4. Restart frontend to pick up new environment variables
echo "🔄 Restarting frontend to apply new backend IP..."
docker compose restart frontend

echo "✅ Post-rebuild fixes applied successfully!"
echo "🌐 Frontend should now be able to reach backend at: http://$BACKEND_IP:3001" 