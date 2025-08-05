#!/bin/bash
# Script to rebuild backend without cache and deploy to server

set -e

echo "🔨 Building backend without cache..."
echo "This will take several minutes..."

# Build without cache
DOCKER_BUILDKIT=1 docker build --no-cache -f backend/Dockerfile --target runtime -t mylayer-backend:latest ./backend

echo "✅ Build complete!"

# Save the image
echo "💾 Saving image..."
docker save mylayer-backend:latest | gzip > mylayer-backend-new.tar.gz

echo "📦 Image saved ($(du -h mylayer-backend-new.tar.gz | cut -f1))"

# Copy to server
echo "📡 Copying to server..."
scp mylayer-backend-new.tar.gz root@91.99.69.115:/home/admin/app/

# Deploy on server
echo "🚀 Deploying on server..."
ssh root@91.99.69.115 << 'EOF'
cd /home/admin/app
echo "Stopping backend..."
docker compose -f docker-compose.mylayer-caddy.yml stop backend
echo "Loading new image..."
docker load < mylayer-backend-new.tar.gz
echo "Starting backend..."
docker compose -f docker-compose.mylayer-caddy.yml up -d backend
echo "Cleaning up..."
rm mylayer-backend-new.tar.gz
echo "✅ Deployment complete!"
docker logs mylayer_pessoa_backend --tail 10
EOF

# Clean up local file
rm mylayer-backend-new.tar.gz

echo "🎉 All done!"