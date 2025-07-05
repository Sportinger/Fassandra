#!/bin/bash

# Script to generate self-signed SSL certificates for development with custom domain

set -e

echo "🔐 Generating self-signed SSL certificates with custom domain support..."

# Create directories for certificates
mkdir -p frontend/ssl/certs
mkdir -p frontend/ssl/private

# Get domain from environment or use default
DOMAIN=${1:-mylayer.org}

echo "📋 Generating certificates for domain: $DOMAIN"

# Create a config file for the certificate with Subject Alternative Names
cat > frontend/ssl/server.conf <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=Development
L=Development
O=Development
CN=$DOMAIN

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = www.$DOMAIN
DNS.3 = localhost
DNS.4 = 127.0.0.1
IP.1 = 127.0.0.1
EOF

# Generate private key
echo "🔑 Generating private key..."
openssl genrsa -out frontend/ssl/private/server.key 2048

# Generate certificate with the config
echo "📜 Generating certificate..."
openssl req -new -x509 -key frontend/ssl/private/server.key -out frontend/ssl/certs/server.crt -days 365 -config frontend/ssl/server.conf -extensions v3_req

# Clean up config file
rm frontend/ssl/server.conf

# Set appropriate permissions
chmod 600 frontend/ssl/private/server.key
chmod 644 frontend/ssl/certs/server.crt

echo "✅ SSL certificates generated successfully!"
echo "📂 Private key: frontend/ssl/private/server.key"
echo "📂 Certificate: frontend/ssl/certs/server.crt"
echo ""
echo "🌐 Certificate includes the following domains:"
echo "   - $DOMAIN"
echo "   - www.$DOMAIN"
echo "   - localhost"
echo "   - 127.0.0.1"
echo ""
echo "⚠️  Note: These are self-signed certificates for development only."
echo "   Your browser will show a security warning - this is normal."
echo "   For production, use proper SSL certificates from a trusted CA or Let's Encrypt." 