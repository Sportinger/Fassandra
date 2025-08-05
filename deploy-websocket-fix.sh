#!/bin/bash

echo "Commands to run on server:"
echo ""
echo "1. SSH to server:"
echo "   ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115"
echo ""
echo "2. Apply the nginx fix (run these on the server):"
echo "   sudo cp /home/admin/nginx-mylayer-prod.conf /etc/nginx/sites-available/mylayer.org"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""
echo "3. Test WebSocket:"
echo "   curl -i -H 'Connection: Upgrade' -H 'Upgrade: websocket' http://localhost:3001/api/collab"