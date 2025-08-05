#!/bin/bash

echo "Reverting to original setup with frontend Docker container..."

ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115 << 'EOF'
echo "1. Restoring original nginx configuration..."
sudo cp /home/admin/nginx-mylayer-prod-nohttp2.conf /etc/nginx/sites-available/mylayer.org

echo "2. Testing nginx configuration..."
sudo nginx -t

echo "3. Reloading nginx..."
sudo systemctl reload nginx

echo "4. Starting frontend container with restored docker-compose..."
cd /home/admin/app
docker compose -f docker-compose.mylayer.yml up -d

echo "5. Checking container status..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "Done! Original setup restored."
EOF