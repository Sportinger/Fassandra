# 🚀 Deployment Guide: GitHub Actions → Hetzner Server

This guide will help you set up automatic deployment from GitHub to your Hetzner server.

## 📋 Overview

**How it works:**
1. **GitHub Actions** builds Docker images when you push code
2. **Images are pushed** to GitHub Container Registry (ghcr.io)
3. **Hetzner server pulls** the pre-built images (no compilation needed!)
4. **Containers are updated** automatically

**Benefits:**
- ✅ **No rebuilding on server** (saves time and resources)
- ✅ **Automatic deployments** on code push
- ✅ **Same images** for staging and production
- ✅ **Rollback capability** with image tags

## 🛠️ Setup Instructions

### Step 1: Prepare Your Hetzner Server

```bash
# SSH into your Hetzner server
ssh your-user@your-server.com

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in to apply group changes

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create deployment directory
mkdir -p /home/your-user/pessoa-prod
cd /home/your-user/pessoa-prod
```

### Step 2: Configure Environment on Hetzner

```bash
# Copy your production environment configuration
nano .env
```

**Edit your `.env` file based on `env.exact.copy copy.md`:**
1. **Comment out** the LOCAL DEVELOPMENT section (add `#` at start of lines)
2. **Uncomment** the HETZNER PRODUCTION section (remove `#`)
3. **Update these values:**
   - `APP_HOSTNAME=your-actual-domain.com`
   - `POSTGRES_PASSWORD=your-secure-password`
   - `JWT_SECRET=your-secure-jwt-secret-minimum-32-chars`
   - `GEMINI_API_KEY=your-gemini-api-key`
   - `PGADMIN_DEFAULT_PASSWORD=your-secure-pgadmin-password`
   - `DOCKER_REGISTRY=ghcr.io/your-github-username`

### Step 3: Copy Production Files to Hetzner

```bash
# Copy docker-compose.prod.yml to your server
scp docker-compose.prod.yml your-user@your-server.com:/home/your-user/pessoa-prod/

# Or create it manually on the server
nano docker-compose.prod.yml
# (copy contents from docker-compose.prod.yml)
```

### Step 4: Set Up SSL Certificates

```bash
# Option A: Use Let's Encrypt (recommended for production)
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /etc/ssl/certs/your-domain.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /etc/ssl/private/your-domain.key

# Option B: Use self-signed certificates (for testing)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/your-domain.key \
  -out /etc/ssl/certs/your-domain.crt \
  -subj "/C=DE/ST=State/L=City/O=Organization/CN=your-domain.com"

# Set proper permissions
sudo chmod 600 /etc/ssl/private/your-domain.key
sudo chmod 644 /etc/ssl/certs/your-domain.crt
```

### Step 5: Configure GitHub Repository

#### A. Enable GitHub Container Registry

1. Go to your GitHub repository
2. Navigate to **Settings** → **Actions** → **General**
3. Under "Workflow permissions", select **Read and write permissions**

#### B. Add Repository Secrets

Go to **Settings** → **Secrets and variables** → **Actions** and add:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `HETZNER_HOST` | `your-server-ip` | Your Hetzner server IP address |
| `HETZNER_USER` | `your-username` | SSH username on Hetzner server |
| `HETZNER_SSH_KEY` | `your-private-key` | SSH private key (see below) |
| `DEPLOY_PATH` | `/home/your-user/pessoa-prod` | Deployment directory path |
| `DATABASE_URL` | `postgres://dummy:dummy@dummy:5432/dummy` | Dummy URL for build |
| `VITE_API_BASE_URL` | `https://your-domain.com/api` | Production API URL |
| `VITE_WS_BASE_URL` | `wss://your-domain.com/api/collab` | Production WebSocket URL |

#### C. Set Up SSH Key for Deployment

On your **local machine**:
```bash
# Generate SSH key pair for deployment
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/hetzner_deploy

# Copy public key to Hetzner server
ssh-copy-id -i ~/.ssh/hetzner_deploy.pub your-user@your-server.com

# Display private key to copy to GitHub secrets
cat ~/.ssh/hetzner_deploy
```

Copy the **private key** content to the `HETZNER_SSH_KEY` secret.

### Step 6: Update Environment Configuration

Edit your `env.exact.copy copy.md` file:

```bash
# Update the DOCKER_REGISTRY line with your GitHub username
DOCKER_REGISTRY=ghcr.io/your-github-username  # Change this!
```

Then copy to your hidden `.env` file:
```bash
cp "env.exact.copy copy.md" .env
```

### Step 7: Test the Deployment

1. **Commit and push your changes:**
   ```bash
   git add .
   git commit -m "Add GitHub Actions deployment configuration"
   git push origin main
   ```

2. **Watch the deployment:**
   - Go to your GitHub repository
   - Click on **Actions** tab
   - Watch the "Deploy to Hetzner Server" workflow

3. **Check your Hetzner server:**
   ```bash
   cd /home/your-user/pessoa-prod
   docker-compose -f docker-compose.prod.yml ps
   ```

## 🔧 Configuration Details

### Environment Switching

Your `env.exact.copy copy.md` now supports easy switching between environments:

**For Local Development:**
- Keep LOCAL DEVELOPMENT section uncommented
- Use `docker-compose.yml` (development with hot-reload)

**For Hetzner Production:**
- Comment out LOCAL DEVELOPMENT section
- Uncomment HETZNER PRODUCTION section
- Use `docker-compose.prod.yml` (production with pre-built images)

### Nginx Configuration

The production setup uses:
- **Port 80** for HTTP (redirects to HTTPS)
- **Port 443** for HTTPS (main application)
- **Nginx reverse proxy** handles SSL termination and API routing

## 🚨 Security Checklist

Before going to production, ensure you've changed:

- [ ] `POSTGRES_PASSWORD` - Use a strong database password
- [ ] `JWT_SECRET` - Generate a secure 32+ character secret
- [ ] `GEMINI_API_KEY` - Use your own API key
- [ ] `PGADMIN_DEFAULT_PASSWORD` - Secure pgAdmin access
- [ ] SSL certificates - Use Let's Encrypt for production
- [ ] Firewall rules - Only allow necessary ports (80, 443, 22)

## 🔄 Deployment Workflow

1. **Local Development:**
   ```bash
   # Make your changes
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **Automatic Deployment:**
   - GitHub Actions builds new images
   - Images are pushed to ghcr.io
   - Hetzner server pulls and deploys automatically

3. **Monitor Deployment:**
   ```bash
   # On Hetzner server
   docker-compose -f docker-compose.prod.yml logs -f
   ```

## 🆘 Troubleshooting

### Common Issues:

**"Permission denied" during deployment:**
- Check SSH key is correctly added to GitHub secrets
- Verify SSH key has access to Hetzner server

**"Image not found" error:**
- Ensure DOCKER_REGISTRY in .env matches your GitHub username
- Check GitHub Container Registry permissions

**SSL certificate errors:**
- Verify certificate paths in .env match actual files on server
- Check certificate file permissions

**Port conflicts:**
- Ensure ports 80, 443 are available on Hetzner server
- Check if other services are using these ports

### Rollback Process:

```bash
# On Hetzner server, rollback to previous version
export IMAGE_TAG=sha-PREVIOUS_COMMIT_HASH
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Monitoring

### Check Application Status:
```bash
# On Hetzner server
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Access Points:
- **Main Application**: https://your-domain.com
- **pgAdmin**: https://your-domain.com:5050
- **Server Status**: `docker ps` on Hetzner server

## 🎯 Next Steps

1. Set up monitoring and alerting
2. Configure automated backups
3. Set up staging environment
4. Configure log aggregation
5. Set up health checks

---

**Questions?** Check the GitHub Actions logs first, then verify your Hetzner server configuration! 