# HTTPS Setup Guide

This guide explains how to enable HTTPS for your frontend application.

## Quick Start

To enable HTTPS immediately:

```bash
./setup-https.sh
```

This script will:
1. Generate self-signed SSL certificates
2. Update environment variables for HTTPS
3. Configure Docker Compose for HTTPS
4. Create backups of your current configuration

## Manual Setup

If you prefer to set up HTTPS manually:

### 1. Generate SSL Certificates

```bash
./generate-ssl-certs.sh
```

### 2. Update Environment Variables

Copy `env.https` to `env.local` or update your current environment:

- `FRONTEND_HTTPS_PORT=8443` - HTTPS port for frontend
- `CORS_ORIGINS` - Updated to include HTTPS URLs
- `APP_DOMAIN` - Updated to use HTTPS port

### 3. Use HTTPS Docker Configuration

```bash
cp docker-compose.https.yml docker-compose.yml
```

### 4. Start the Application

```bash
docker-compose down
docker-compose up --build
```

## Accessing Your Application

- **HTTPS**: https://192.168.2.111:8443 (secure)
- **HTTP**: http://192.168.2.111:8080 (redirects to HTTPS)

## Browser Security Warning

Since we're using self-signed certificates, your browser will show a security warning. This is normal for development:

1. Click "Advanced" or "Show details"
2. Click "Proceed to site" or "Continue to site"

## Files Created

- `frontend/ssl/certs/server.crt` - SSL certificate
- `frontend/ssl/private/server.key` - Private key (never commit this!)
- `frontend/nginx-https.conf` - HTTPS nginx configuration
- `frontend/Dockerfile.https` - HTTPS-enabled Dockerfile
- `docker-compose.https.yml` - HTTPS Docker Compose configuration
- `env.https` - HTTPS environment variables

## Production Deployment

For production, replace the self-signed certificates with proper SSL certificates:

### Option 1: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate for your domain
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem frontend/ssl/certs/server.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem frontend/ssl/private/server.key
```

### Option 2: Custom Certificates

Replace the files:
- `frontend/ssl/certs/server.crt` - Your SSL certificate
- `frontend/ssl/private/server.key` - Your private key

### Option 3: Traefik Reverse Proxy

For production, consider using Traefik for automatic SSL certificate management:

```yaml
# docker-compose.traefik.yml
version: '3.8'
services:
  traefik:
    image: traefik:v2.9
    command:
      - "--providers.docker=true"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@domain.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./acme.json:/acme.json
    labels:
      - "traefik.http.routers.api.rule=Host(`traefik.yourdomain.com`)"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"

  frontend:
    # ... your frontend configuration
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
```

## Security Features

The HTTPS configuration includes:

- **TLS 1.2 and 1.3** support
- **Strong cipher suites** for encryption
- **Security headers** for protection:
  - `Strict-Transport-Security` (HSTS)
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `X-XSS-Protection`
  - `Referrer-Policy`
- **HTTP to HTTPS redirect**
- **Gzip compression** for performance

## Troubleshooting

### Certificate Errors

If you get certificate errors, regenerate them:

```bash
rm -rf frontend/ssl/
./generate-ssl-certs.sh
```

### Port Conflicts

If port 8443 is in use, update `FRONTEND_HTTPS_PORT` in your environment file.

### Docker Build Errors

Ensure the SSL certificates exist before building:

```bash
ls -la frontend/ssl/certs/
ls -la frontend/ssl/private/
```

## Reverting to HTTP

To go back to HTTP-only:

```bash
# Restore from backups
cp env.local.backup.* env.local
cp docker-compose.yml.backup.* docker-compose.yml

# Or reset from git
git checkout env.local docker-compose.yml
```

## Support

If you encounter issues:

1. Check Docker logs: `docker-compose logs frontend`
2. Verify certificates: `openssl x509 -in frontend/ssl/certs/server.crt -text -noout`
3. Test SSL: `openssl s_client -connect 192.168.2.111:8443` 