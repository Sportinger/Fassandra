#!/bin/bash
set -e

# 🧪 Setup Staging Environment Script
# Creates a separate staging environment on the server

echo "🧪 Setting up staging environment..."
echo "🎯 This will create a separate test environment on port 8444"
echo ""

# Setup staging directory and configuration on server
ssh roman@mylayer.org << 'EOF'
    echo "📁 Creating staging directory..."
    sudo mkdir -p /opt/pessoa-staging
    sudo chown roman:roman /opt/pessoa-staging
    cd /opt/pessoa-staging
    
    echo "📋 Creating staging environment file..."
    cat > .env << 'STAGING_ENV'
# Staging Environment Configuration
# Port 8444 for testing experimental features

# Container Registry
DOCKER_REGISTRY=ghcr.io/sportinger
IMAGE_TAG=latest

# Database Configuration
POSTGRES_USER=pessoa_user
POSTGRES_PASSWORD=pessoa_password_staging
POSTGRES_DB=pessoa_db_staging
DATABASE_URL=postgres://pessoa_user:pessoa_password_staging@db:5432/pessoa_db_staging
DB_PORT=5434
DB_INTERNAL_PORT=5432
DB_MAX_CONNECTIONS=10

# Backend Configuration
BACKEND_PORT=3002
BACKEND_INTERNAL_PORT=3001
JWT_SECRET=your-staging-jwt-secret-here
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent

# Frontend Configuration
FRONTEND_PORT=8080
FRONTEND_HTTPS_PORT=8444
APP_DOMAIN=mylayer.org:8444
ALLOWED_ORIGINS=https://mylayer.org:8444,http://localhost:5173,http://127.0.0.1:5173

# SSL Configuration
SSL_CERT_PATH=/etc/ssl/certs/mylayer.org.crt
SSL_KEY_PATH=/etc/ssl/private/mylayer.org.key

# PgAdmin Configuration
PGADMIN_DEFAULT_EMAIL=admin@staging.local
PGADMIN_DEFAULT_PASSWORD=staging_admin_password
PGADMIN_PORT=5051

# Logging
RUST_LOG=debug
STAGING_ENV
    
    echo "✅ Staging environment created!"
    echo "📍 Location: /opt/pessoa-staging"
    echo "🌐 Will be accessible at: https://mylayer.org:8444"
    echo ""
EOF

echo "🎉 Staging environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Update the staging .env file with your actual secrets"
echo "   2. Use ./scripts/deploy_staging.sh to deploy to staging"
echo "   3. Test your changes on https://mylayer.org:8444"
echo "   4. Use ./scripts/build_and_push.sh for production deployment"
echo "" 