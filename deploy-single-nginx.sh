#!/bin/bash

echo "Deploying single-layer nginx configuration..."

# Copy frontend build files from container to host
ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115 << 'EOF'
echo "1. Creating frontend-build directory on host..."
mkdir -p /home/admin/app/frontend-build

echo "2. Copying frontend files from container to host..."
docker cp mylayer_pessoa_frontend:/usr/share/nginx/html/. /home/admin/app/frontend-build/

echo "3. Setting proper permissions..."
sudo chown -R admin:admin /home/admin/app/frontend-build
sudo chmod -R 755 /home/admin/app/frontend-build

echo "4. Backing up current nginx configuration..."
sudo cp /etc/nginx/sites-available/mylayer.org /etc/nginx/sites-available/mylayer.org.backup-$(date +%Y%m%d-%H%M%S)

echo "5. Files copied successfully. Directory contents:"
ls -la /home/admin/app/frontend-build/
EOF

echo ""
echo "Frontend files have been copied to the host."
echo ""
echo "Next steps to complete the migration:"
echo "1. Copy nginx-single-layer.conf to server: scp -i ~/.ssh/id_rsa_lexema_de nginx-single-layer.conf admin@91.99.69.115:/home/admin/"
echo "2. On server: sudo cp /home/admin/nginx-single-layer.conf /etc/nginx/sites-available/mylayer.org"
echo "3. Test nginx config: sudo nginx -t"
echo "4. Reload nginx: sudo systemctl reload nginx"
echo "5. Stop frontend container: docker stop mylayer_pessoa_frontend"
echo "6. Remove frontend from docker-compose.yml to prevent it from restarting"