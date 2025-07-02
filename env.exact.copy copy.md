# =================================================================
# ENVIRONMENT CONFIGURATION - Choose your deployment target
# =================================================================

# 🚀 DEPLOYMENT TARGET: Uncomment ONE of these sections
# For LOCAL DEVELOPMENT - uncomment this section:
APP_HOSTNAME=192.168.2.111 # Your local Ubuntu IP
BACKEND_PORT=3001
FRONTEND_PORT=8080          # HTTP port (will redirect to HTTPS)
FRONTEND_HTTPS_PORT=8443    # HTTPS port
DB_PORT=5433
CONTAINER_PREFIX=local_
# For HETZNER PRODUCTION - uncomment this section instead:
#APP_HOSTNAME=your-domain.com # Your actual domain
#BACKEND_PORT=3001
#FRONTEND_PORT=80              # Standard HTTP port  
#FRONTEND_HTTPS_PORT=443       # Standard HTTPS port
#DB_PORT=5432                  # Internal PostgreSQL port
#CONTAINER_PREFIX=prod_

# 🐳 CONTAINER REGISTRY (for GitHub Actions deployment to Hetzner)
# Only needed for production deployment via GitHub Actions
DOCKER_REGISTRY=ghcr.io/sportinger  # Your GitHub username
IMAGE_TAG=latest

# 🔐 SSL CERTIFICATES (for Hetzner production)
# Only needed for production - paths on your Hetzner server
SSL_CERT_PATH=/etc/ssl/certs/your-domain.crt
SSL_KEY_PATH=/etc/ssl/private/your-domain.key
# For mylayer.org (example):
#SSL_CERT_PATH=/etc/ssl/certs/mylayer.org.crt
#SSL_KEY_PATH=/etc/ssl/private/mylayer.org.key

## =================================================================
## INTERNAL CONFIGURATION (rarely needs changes)
## =================================================================
BACKEND_INTERNAL_PORT=3001
FRONTEND_INTERNAL_PORT=8080
DB_INTERNAL_PORT=5432

# Database configuration
POSTGRES_USER=pessoa_user
# 🔒 CHANGE THIS PASSWORD FOR PRODUCTION!
POSTGRES_PASSWORD=pessoa_local_dev_password_2024
POSTGRES_DB=pessoa_db
DATABASE_URL=postgres://pessoa_user:${POSTGRES_PASSWORD}@db:5432/pessoa_db
LOCALHOST_DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}

# Security
# 🔒 GENERATE A SECURE JWT SECRET FOR PRODUCTION (minimum 32 characters)!
JWT_SECRET=local_development_jwt_secret_change_for_production_2024

# API configuration - automatically adapts based on APP_HOSTNAME
APP_DOMAIN=${APP_HOSTNAME}$([[ "${FRONTEND_HTTPS_PORT}" != "443" ]] && echo ":${FRONTEND_HTTPS_PORT}" || echo "")
# CORS origins - supports both local and production
CORS_ORIGINS=https://${APP_HOSTNAME}:${FRONTEND_HTTPS_PORT},https://${APP_HOSTNAME},http://${APP_HOSTNAME}:${FRONTEND_PORT},http://${APP_HOSTNAME},https://localhost:${FRONTEND_HTTPS_PORT},https://127.0.0.1:${FRONTEND_HTTPS_PORT}
ALLOWED_ORIGINS=${CORS_ORIGINS}
DB_MAX_CONNECTIONS=10

# Frontend configuration (adapts to environment)
# For LOCAL DEV: Direct backend connection
VITE_API_BASE_URL=http://${APP_HOSTNAME}:${BACKEND_PORT}
VITE_WS_BASE_URL=ws://${APP_HOSTNAME}:${BACKEND_PORT}/api/collab
# For PRODUCTION: Use HTTPS proxy through frontend
#VITE_API_BASE_URL=https://${APP_HOSTNAME}/api
#VITE_WS_BASE_URL=wss://${APP_HOSTNAME}/api/collab

# AI Integration
# 🔒 USE YOUR OWN GEMINI API KEY FOR PRODUCTION!
GEMINI_API_KEY=AIzaSyCGkJudo4e0YEgZZKQ8xXTPBOTB3cQCY_g
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent

# pgAdmin configuration
# 🔒 CHANGE THESE CREDENTIALS FOR PRODUCTION!
PGADMIN_DEFAULT_EMAIL=admin@pessoa.dev
PGADMIN_DEFAULT_PASSWORD=admin123
PGADMIN_INTERNAL_PORT=80
PGADMIN_PORT=5050

# Logging configuration
RUST_LOG=info,backend=debug,tower_http=debug  # For development
#RUST_LOG=info,backend=info  # For production

# =================================================================
# 📋 QUICK SETUP GUIDE:
# =================================================================
# 
# FOR LOCAL DEVELOPMENT:
# 1. Keep the LOCAL DEVELOPMENT section uncommented
# 2. Copy this file to .env: cp "env.exact.copy copy.md" .env
# 3. Run: docker-compose up -d
#
# FOR HETZNER PRODUCTION:
# 1. Comment out LOCAL DEVELOPMENT section (add # at start of lines)
# 2. Uncomment HETZNER PRODUCTION section (remove # from lines)
# 3. Update your-domain.com to your actual domain
# 4. Change all passwords and secrets (marked with 🔒)
# 5. Update DOCKER_REGISTRY with your GitHub username
# 6. Copy to your Hetzner server as .env
# 7. Use docker-compose.prod.yml for deployment
#
# FOR GITHUB ACTIONS DEPLOYMENT:
# 1. Set up GitHub Container Registry (ghcr.io)
# 2. Add repository secrets for deployment
# 3. Configure GitHub Actions workflow
# ================================================================= 