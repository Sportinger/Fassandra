#!/bin/bash

echo "Please SSH to the server and run these commands:"
echo ""
echo "sudo cp /home/admin/nginx-mylayer-prod-nohttp2.conf /etc/nginx/sites-available/mylayer.org"
echo "sudo nginx -t"
echo "sudo systemctl reload nginx"
echo ""
echo "This will restore the original nginx configuration that proxies to the frontend container."