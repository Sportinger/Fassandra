#!/bin/bash

# Script to generate self-signed SSL certificates for development

set -e

echo "🔐 Generating self-signed SSL certificates for development..."

# Create directories for certificates
mkdir -p frontend/ssl/certs
mkdir -p frontend/ssl/private

# Generate private key
openssl genrsa -out frontend/ssl/private/server.key 2048

# Generate certificate signing request
openssl req -new -key frontend/ssl/private/server.key -out frontend/ssl/server.csr -subj "/C=US/ST=Development/L=Development/O=Development/CN=localhost"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -days 365 -in frontend/ssl/server.csr -signkey frontend/ssl/private/server.key -out frontend/ssl/certs/server.crt

# Clean up CSR file
rm frontend/ssl/server.csr

# Set appropriate permissions
chmod 600 frontend/ssl/private/server.key
chmod 644 frontend/ssl/certs/server.crt

echo "✅ SSL certificates generated successfully!"
echo "📂 Private key: frontend/ssl/private/server.key"
echo "📂 Certificate: frontend/ssl/certs/server.crt"
echo ""
echo "⚠️  Note: These are self-signed certificates for development only."
echo "   Your browser will show a security warning - this is normal."
echo "   For production, use proper SSL certificates from a trusted CA or Let's Encrypt." 