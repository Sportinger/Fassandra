# Deployment Guide

This project has two deployment configurations:

## 🏠 Local Development

**Files:**
- `docker-compose.yml` - Local development with hot reload
- `.env` - Local environment variables

**Commands:**
```bash
# Start local development
docker compose up -d

# Rebuild without cache
docker compose up --build --no-cache -d

# View logs
docker compose logs -f
```

**Access:**
- Frontend: http://localhost:8080 or http://192.168.2.111:8080
- Backend: http://localhost:3000
- PgAdmin: http://localhost:5050

## 🌐 Production (mylayer.org)

**Files:**
- `docker-compose.mylayer.yml` - Production configuration
- `.env.mylayer` - Production environment variables (with secure passwords)
- `deploy-mylayer.sh` - Deployment script

**Commands:**
```bash
# Full deployment to Hetzner
./deploy-mylayer.sh

# Deploy only frontend
./deploy-mylayer.sh frontend

# Deploy with database reset (WARNING: destroys data!)
./deploy-mylayer.sh all --reset-db

# Deploy without cache
./deploy-mylayer.sh all --no-cache
```

**Server Details:**
- IP: 91.99.69.115
- SSH User: admin
- Domain: mylayer.org

**Access After Deployment:**
- Frontend: https://mylayer.org
- Backend API: https://mylayer.org/api
- PgAdmin: http://91.99.69.115:5050

## 🔐 Security Notes

The production environment uses secure passwords that are automatically generated. After deployment:

1. **Admin Login:**
   - Email: admin@mylayer.org
   - Password: Check `.env.mylayer` file

2. **Database:**
   - All passwords are securely generated
   - JWT secret is unique for production

3. **SSL:**
   - Self-signed certificates are generated automatically
   - Can be replaced with Let's Encrypt certificates on the server

## 📁 File Organization

```
pessoa/
├── docker-compose.yml          # Local development
├── docker-compose.mylayer.yml  # Production
├── .env                       # Local environment
├── .env.mylayer              # Production environment (git-ignored)
├── deploy-mylayer.sh         # Production deployment script
├── frontend/
│   ├── Dockerfile.dev        # Local development
│   ├── Dockerfile.prod.simple # Production
│   └── nginx-mylayer.conf    # Production nginx config
└── backend/
    └── Dockerfile            # Multi-stage for both dev and prod
```

## 🚀 Quick Start

**Local Development:**
```bash
docker compose up -d
```

**Production Deployment:**
```bash
./deploy-mylayer.sh
```