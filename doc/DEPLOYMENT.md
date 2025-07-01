# Production Deployment Guide

## Quick Hetzner Deployment

### 1. Prepare Your Production Environment

1. Copy the production template:
   ```bash
   cp env.production.template env.production
   ```

2. Edit `env.production` with your production values:
   - Set `APP_HOSTNAME` to your domain or server IP
   - Change all passwords and secrets
   - Update API keys

### 2. Deploy to Hetzner Server

1. **Upload your code** to the Hetzner server
2. **Install Docker and Docker Compose** on the server
3. **Run the production build**:
   ```bash
   docker-compose --env-file env.production up --build -d
   ```

### 3. Production Security Checklist

- [ ] Changed `JWT_SECRET` to a secure random string
- [ ] Updated database passwords
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure firewall rules
- [ ] Set up domain name and DNS
- [ ] Update `CORS_ORIGINS` with your domain

### 4. Domain Setup

When you have a domain, update these in `env.production`:
```env
APP_HOSTNAME=yourdomain.com
VITE_API_BASE_URL=https://yourdomain.com/api
VITE_WS_BASE_URL=wss://yourdomain.com/api/collab
CORS_ORIGINS=https://yourdomain.com,http://yourdomain.com
```

### 5. HTTPS Setup (Recommended)

For production, set up a reverse proxy (nginx) with SSL certificates:
- Use Let's Encrypt for free SSL certificates
- Configure nginx to proxy to your Docker containers
- Update frontend port to 443 for HTTPS

## Current Development Setup

Your current network configuration (`192.168.2.111`) is already production-ready in terms of:
- ✅ Network accessibility
- ✅ CORS configuration
- ✅ API endpoints
- ✅ Container communication

Just change the hostname and add security when deploying! 