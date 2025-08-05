#!/bin/bash

# Patch WebSocket URL in deployed frontend to use direct connection

echo "Patching WebSocket URL to use direct connection on port 3001..."

# SSH to server and patch the JavaScript file
ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115 << 'EOF'
# Backup the original file
docker exec mylayer_pessoa_frontend cp /usr/share/nginx/html/assets/index-BSCFSVL5.js /usr/share/nginx/html/assets/index-BSCFSVL5.js.backup

# Replace WebSocket URLs to use direct connection
# This changes wss://mylayer.org/api/collab to ws://mylayer.org:3001/api/collab
docker exec mylayer_pessoa_frontend sed -i 's|wss://mylayer.org/api/collab|ws://mylayer.org:3001/api/collab|g' /usr/share/nginx/html/assets/index-BSCFSVL5.js
docker exec mylayer_pessoa_frontend sed -i 's|wss://${window.location.host}/api/collab|ws://${window.location.hostname}:3001/api/collab|g' /usr/share/nginx/html/assets/index-BSCFSVL5.js
docker exec mylayer_pessoa_frontend sed -i 's|${wsProtocol}//${window.location.host}/api/collab|ws://${window.location.hostname}:3001/api/collab|g' /usr/share/nginx/html/assets/index-BSCFSVL5.js

echo "WebSocket URL patched successfully!"
echo "The application will now connect directly to port 3001, bypassing nginx."
EOF