# 🚀 Hetzner Production Deployment Guide

This guide explains how to deploy Pessoa to a Hetzner production server, adapting from the local development setup.

## 📋 Overview

The main repository is now optimized for **local development** with HTTPS on `192.168.2.111:8443`. To deploy to **Hetzner production**, you need to make several key changes for the production environment.

## 🔄 Key Differences: Local vs Hetzner

| Aspect | Local Development | Hetzner Production |
|--------|------------------|-------------------|
| **Domain** | `192.168.2.111:8443` | `pessoa.theater` (standard ports) |
| **SSL Certificates** | Self-signed, embedded in Docker | Let's Encrypt, mounted from host |
| **Docker Compose** | `docker-compose.yml` | `docker-compose.hetzner-github-actions.yml` |
| **Images** | Built locally | Pre-built from GitHub Container Registry |
| **Environment** | `env.local.https` | `env.pessoa.theater.production` |
| **Nginx Config** | `nginx-local.conf` | `nginx-https.conf` |
| **Ports** | `8080/8443` | `80/443` (standard web ports) |

## 🛠️ Step-by-Step Hetzner Deployment

### Step 1: Server Preparation

1. **Update your Hetzner server:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install docker.io docker-compose-v2 git -y
   sudo systemctl enable docker
   sudo usermod -aG docker $USER
   ```

2. **Stop conflicting services:**
   ```bash
   # Stop system nginx if running
   sudo systemctl stop nginx
   sudo systemctl disable nginx
   
   # Check no services are using ports 80/443
   sudo ss -tlnp | grep -E ":(80|443)"
   ```

### Step 2: SSL Certificate Setup

1. **Install Certbot and generate Let's Encrypt certificates:**
   ```bash
   sudo apt install certbot -y
   
   # Generate certificates for pessoa.theater
   sudo certbot certonly --standalone -d pessoa.theater
   
   # Verify certificates
   sudo ls -la /etc/letsencrypt/live/pessoa.theater/
   ```

2. **Set up certificate renewal:**
   ```bash
   sudo crontab -e
   # Add this line:
   0 12 * * * /usr/bin/certbot renew --quiet
   ```

### Step 3: Project Setup

1. **Clone and prepare the project:**
   ```bash
   cd /opt
   sudo git clone https://github.com/Sportinger/pessoa.git
   sudo chown -R $USER:$USER pessoa
   cd pessoa
   git checkout main
   ```

2. **Create production environment file:**
   ```bash
   cp env.pessoa.theater.production .env
   ```

3. **Update the environment file:**
   ```bash
   nano .env
   ```
   
   **Key changes needed:**
   ```bash
   # Update these values in .env:
   
   # 🌐 DOMAIN CONFIGURATION
   APP_HOSTNAME=pessoa.theater
   APP_DOMAIN=pessoa.theater
   
   # 🔐 SSL CERTIFICATES (Let's Encrypt paths)
   SSL_CERT_PATH=/etc/letsencrypt/live/pessoa.theater/fullchain.pem
   SSL_KEY_PATH=/etc/letsencrypt/live/pessoa.theater/privkey.pem
   
   # 🐳 DOCKER REGISTRY (if using pre-built images)
   DOCKER_REGISTRY=ghcr.io/sportinger
   IMAGE_TAG=latest
   
   # 🌍 FRONTEND URLS
   VITE_API_BASE_URL=https://pessoa.theater
   VITE_WS_BASE_URL=wss://pessoa.theater/api/collab
   
   # 🔒 SECURITY (CHANGE THESE!)
   POSTGRES_PASSWORD=YOUR_SECURE_DATABASE_PASSWORD
   JWT_SECRET=YOUR_VERY_LONG_RANDOM_JWT_SECRET_AT_LEAST_32_CHARS
   PGADMIN_DEFAULT_PASSWORD=YOUR_SECURE_PGADMIN_PASSWORD
   ```

### Step 4: Docker Configuration

1. **Use the Hetzner docker-compose file:**
   ```bash
   # The main docker-compose.yml is for local development
   # Use the Hetzner-specific configuration:
   cp docker-compose.hetzner-github-actions.yml docker-compose.prod.yml
   ```

2. **Key differences in production docker-compose:**
   ```yaml
   # Production uses:
   services:
     frontend:
       image: ${DOCKER_REGISTRY}/pessoa-frontend:${IMAGE_TAG}  # Pre-built image
       volumes:
         # Mount Let's Encrypt certificates from host
         - /etc/letsencrypt/live/pessoa.theater/fullchain.pem:/etc/ssl/certs/server.crt:ro
         - /etc/letsencrypt/live/pessoa.theater/privkey.pem:/etc/ssl/private/server.key:ro
       ports:
         - "80:80"      # Standard HTTP port
         - "443:443"    # Standard HTTPS port
   
     backend:
       image: ${DOCKER_REGISTRY}/pessoa-backend:${IMAGE_TAG}  # Pre-built image
       # No volume mounts for source code
   ```

### Step 5: Frontend Configuration Changes

1. **Create production Dockerfile:**
   ```bash
   # The local setup uses Dockerfile.local
   # For production, use the standard Dockerfile.https or create Dockerfile.prod
   ```

2. **Update nginx configuration:**
   ```bash
   # Local uses: frontend/nginx-local.conf
   # Production uses: frontend/nginx-https.conf
   
   # Ensure nginx-https.conf has correct domain:
   nano frontend/nginx-https.conf
   ```
   
   **Update nginx-https.conf:**
   ```nginx
   server {
       listen 80;
       server_name pessoa.theater www.pessoa.theater;
       return 301 https://pessoa.theater$request_uri;
   }
   
   server {
       listen 443 ssl;
       server_name pessoa.theater www.pessoa.theater;
       # ... rest of config
   }
   ```

### Step 6: Build Strategy

Choose one of these approaches:

#### Option A: Build on Server (Simple)
```bash
# Build images locally on server
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

#### Option B: Use Pre-built Images (Recommended)
```bash
# Set up GitHub Container Registry authentication
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Pull and run pre-built images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Step 7: Database Migration

1. **Run database migrations:**
   ```bash
   # Wait for containers to start
   docker-compose -f docker-compose.prod.yml ps
   
   # Run migrations (if needed)
   docker-compose -f docker-compose.prod.yml exec backend sqlx migrate run
   ```

### Step 8: DNS Configuration

1. **Point your domain to Hetzner server:**
   ```
   # DNS A Record:
   pessoa.theater → YOUR_HETZNER_SERVER_IP
   www.pessoa.theater → YOUR_HETZNER_SERVER_IP
   ```

### Step 9: Verification

1. **Test the deployment:**
   ```bash
   # Check container status
   docker-compose -f docker-compose.prod.yml ps
   
   # Check logs
   docker-compose -f docker-compose.prod.yml logs
   
   # Test HTTP redirect
   curl -I http://pessoa.theater
   
   # Test HTTPS
   curl -I https://pessoa.theater
   
   # Test API
   curl -I https://pessoa.theater/api/
   ```

2. **Access points:**
   - **Main App**: https://pessoa.theater
   - **pgAdmin**: https://pessoa.theater:5050

## 🔧 Configuration File Summary

### Files to Modify for Hetzner:

1. **Environment**: Use `env.pessoa.theater.production` as `.env`
2. **Docker Compose**: Use `docker-compose.hetzner-github-actions.yml`
3. **Nginx Config**: Ensure `nginx-https.conf` has correct domain
4. **Frontend Dockerfile**: Use production Dockerfile (not `Dockerfile.local`)

### Key Environment Variables for Production:

```bash
# Domain & SSL
APP_HOSTNAME=pessoa.theater
SSL_CERT_PATH=/etc/letsencrypt/live/pessoa.theater/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/pessoa.theater/privkey.pem

# Frontend URLs
VITE_API_BASE_URL=https://pessoa.theater
VITE_WS_BASE_URL=wss://pessoa.theater/api/collab

# Ports (standard web ports)
FRONTEND_PORT=80
FRONTEND_HTTPS_PORT=443

# Docker (if using pre-built images)
DOCKER_REGISTRY=ghcr.io/sportinger
IMAGE_TAG=latest

# Security (CHANGE THESE!)
POSTGRES_PASSWORD=secure_production_password
JWT_SECRET=very_long_random_production_jwt_secret
PGADMIN_DEFAULT_PASSWORD=secure_pgadmin_password
```

## 🚨 Important Security Notes

1. **Change all default passwords** in the environment file
2. **Use strong, unique passwords** for database and pgAdmin
3. **Generate a secure JWT secret** (at least 32 characters)
4. **Keep your SSL certificates up to date** (certbot auto-renewal)
5. **Regularly update Docker images** for security patches

## 🔄 Updating Production

### For Code Updates:
```bash
cd /opt/pessoa
git pull origin main
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### For Pre-built Images:
```bash
cd /opt/pessoa
git pull origin main
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 🆘 Troubleshooting

### Common Issues:

1. **SSL Certificate Errors:**
   ```bash
   # Check certificate validity
   sudo openssl x509 -in /etc/letsencrypt/live/pessoa.theater/fullchain.pem -text -noout
   
   # Regenerate if needed
   sudo certbot certonly --standalone -d pessoa.theater --force-renewal
   ```

2. **Port Conflicts:**
   ```bash
   # Check what's using ports 80/443
   sudo ss -tlnp | grep -E ":(80|443)"
   
   # Stop conflicting services
   sudo systemctl stop nginx apache2
   ```

3. **Database Connection Issues:**
   ```bash
   # Check database logs
   docker-compose -f docker-compose.prod.yml logs db
   
   # Reset database if needed
   docker-compose -f docker-compose.prod.yml down
   docker volume rm prod_pessoa_pgdata
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Container Issues:**
   ```bash
   # Restart all services
   docker-compose -f docker-compose.prod.yml restart
   
   # Rebuild if needed
   docker-compose -f docker-compose.prod.yml build --no-cache
   ```

## 📚 Related Documentation

- `LOCAL_TO_HETZNER_MIGRATION_GUIDE.md` - Detailed migration process
- `PESSOA_THEATER_SETUP_GUIDE.md` - Step-by-step setup guide
- `env.pessoa.theater.production` - Production environment template
- `docker-compose.hetzner-github-actions.yml` - Production Docker configuration

---

This guide should get your Pessoa application running on Hetzner production server. For automated deployments, consider setting up the GitHub Actions workflow described in the other documentation files. 