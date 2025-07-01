# Domain configuration (change these when moving to a new server)
# For local development use your local IP, for production use your domain
APP_HOSTNAME=192.168.2.111 # Local Ubuntu IP
BACKEND_PORT=3001
FRONTEND_PORT=8080          # HTTP port (will redirect to HTTPS)
FRONTEND_HTTPS_PORT=8443    # HTTPS port
DB_PORT=5433
# make it have a trailing _ please!
CONTAINER_PREFIX=local_

## In a perfect world there should be no necessary changes below this line
BACKEND_INTERNAL_PORT=3001
FRONTEND_INTERNAL_PORT=8080
DB_INTERNAL_PORT=5432

# Database configuration
POSTGRES_USER=pessoa_user
POSTGRES_PASSWORD=pessoa_local_dev_password_2024
POSTGRES_DB=pessoa_db
DATABASE_URL=postgres://pessoa_user:pessoa_local_dev_password_2024@db:5432/pessoa_db
LOCALHOST_DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}

# Security
JWT_SECRET=local_development_jwt_secret_change_for_production_2024

# API configuration
APP_DOMAIN=${APP_HOSTNAME}:${FRONTEND_HTTPS_PORT}
# CORS origins - Updated for local IP 192.168.2.111
CORS_ORIGINS=https://localhost:${FRONTEND_HTTPS_PORT},https://127.0.0.1:${FRONTEND_HTTPS_PORT},https://192.168.2.111:${FRONTEND_HTTPS_PORT},http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},http://192.168.2.111:${FRONTEND_PORT}
ALLOWED_ORIGINS=${CORS_ORIGINS}
DB_MAX_CONNECTIONS=10

# Frontend configuration (these get baked into the frontend build) - Updated for local IP
VITE_API_BASE_URL=http://192.168.2.111:${BACKEND_PORT}  # Direct connection to backend for development
VITE_WS_BASE_URL=ws://192.168.2.111:${BACKEND_PORT}/api/collab

# AI Integration
GEMINI_API_KEY=AIzaSyCGkJudo4e0YEgZZKQ8xXTPBOTB3cQCY_g
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent

# pgAdmin configuration
PGADMIN_DEFAULT_EMAIL=admin@pessoa.dev
PGADMIN_DEFAULT_PASSWORD=admin123
PGADMIN_INTERNAL_PORT=80
PGADMIN_PORT=5050 