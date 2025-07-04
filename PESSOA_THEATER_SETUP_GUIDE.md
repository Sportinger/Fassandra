# 🎭 Pessoa.Theater Production Setup Guide

## 🎯 **Goal**
Deploy your local Pessoa application to **https://pessoa.theater** (single production environment, no dev)

## 📋 **Prerequisites**
- [x] Local Linux machine with working Pessoa setup
- [x] Docker and Docker Compose installed
- [x] SSH access to your Hetzner server as `roman@pessoa.theater`
- [x] GitHub Container Registry access (ghcr.io/sportinger)

## 🚀 **Step-by-Step Setup**

### **Step 1: Prepare Your Hetzner Server**

SSH to your Hetzner server and prepare the environment:

```bash
# SSH to your server
ssh roman@pessoa.theater

# Create production directory
sudo mkdir -p /opt/pessoa
sudo chown roman:roman /opt/pessoa
cd /opt/pessoa

# Copy environment configuration
# (You'll upload this from your local machine in Step 2)
```

### **Step 2: Upload Configuration Files**

From your **local machine**, upload the production files:

```bash
# Upload environment configuration
scp env.pessoa.theater.production roman@pessoa.theater:/opt/pessoa/.env

# Upload docker-compose configuration
scp docker-compose.hetzner-github-actions.yml roman@pessoa.theater:/opt/pessoa/
```

### **Step 3: Configure SSL Certificates**

On your **Hetzner server**, set up SSL certificates for pessoa.theater:

```bash
# SSH to your server
ssh roman@pessoa.theater

# Option A: Use Let's Encrypt (Recommended)
sudo apt update
sudo apt install certbot
sudo certbot certonly --standalone -d pessoa.theater

# Option B: Use existing certificates
# Make sure certificates exist at:
# - /etc/letsencrypt/live/pessoa.theater/fullchain.pem
# - /etc/letsencrypt/live/pessoa.theater/privkey.pem
```

### **Step 4: Update Environment Variables**

Edit the `.env` file on your **Hetzner server** to update secrets:

```bash
# SSH to your server
ssh roman@pessoa.theater
cd /opt/pessoa

# Edit environment file
nano .env

# Update these critical values:
# POSTGRES_PASSWORD=your_secure_database_password
# JWT_SECRET=your_very_long_random_string_at_least_32_chars
# PGADMIN_DEFAULT_PASSWORD=your_secure_pgadmin_password
# GEMINI_API_KEY=your_gemini_api_key (optional)
```

### **Step 5: Verify DNS Configuration**

Ensure your domain points to your Hetzner server:

```bash
# Test DNS resolution
dig pessoa.theater

# Should return your Hetzner server IP address
```

### **Step 6: Deploy from Local Machine**

From your **local machine**, run the deployment:

```bash
# Build and deploy to pessoa.theater
./scripts/build_and_push_pessoa_theater.sh
```

The script will:
1. 🏗️ Build Docker images locally
2. 🚀 Push images to GitHub Container Registry
3. 🌐 Deploy to pessoa.theater via SSH
4. ✅ Verify deployment

### **Step 7: Verify Deployment**

Check that everything is working:

```bash
# Test main application
curl -I https://pessoa.theater

# Test API
curl -I https://pessoa.theater/api/scripts

# Check container status
ssh roman@pessoa.theater "cd /opt/pessoa && docker compose -f docker-compose.hetzner-github-actions.yml ps"
```

## 🔗 **Access Your Application**

After successful deployment:

- **Main Application**: https://pessoa.theater
- **pgAdmin**: https://pessoa.theater:5050
- **Login**: `admin@pessoa.de` / `PassoaDevteam` (dev user)

## 🔄 **Daily Workflow**

Once set up, deploying updates is simple:

```bash
# Make your changes locally
git add .
git commit -m "Your changes"

# Deploy to production
./scripts/build_and_push_pessoa_theater.sh
```

## 🛠️ **Management Commands**

```bash
# View server logs
ssh roman@pessoa.theater "cd /opt/pessoa && docker compose logs -f"

# Restart services
ssh roman@pessoa.theater "cd /opt/pessoa && docker compose restart"

# Check status
ssh roman@pessoa.theater "cd /opt/pessoa && docker compose ps"

# View recent deployments
ssh roman@pessoa.theater "cd /opt/pessoa && docker images | grep pessoa"
```

## 🚨 **Troubleshooting**

### **SSL Certificate Issues**
```bash
# Check certificate files
ssh roman@pessoa.theater "ls -la /etc/letsencrypt/live/pessoa.theater/"

# Renew certificates
ssh roman@pessoa.theater "sudo certbot renew"
```

### **Container Issues**
```bash
# Check logs
ssh roman@pessoa.theater "cd /opt/pessoa && docker compose logs backend"
ssh roman@pessoa.theater "cd /opt/pessoa && docker compose logs frontend"

# Rebuild containers
ssh roman@pessoa.theater "cd /opt/pessoa && docker compose down && docker compose up -d"
```

### **Database Issues**
```bash
# Check database connectivity
ssh roman@pessoa.theater "cd /opt/pessoa && docker compose exec db psql -U pessoa_user -d pessoa_db -c 'SELECT 1;'"
```

## 🔒 **Security Checklist**

Before going live:
- [ ] Updated `POSTGRES_PASSWORD` in `.env`
- [ ] Updated `JWT_SECRET` in `.env`
- [ ] Updated `PGADMIN_DEFAULT_PASSWORD` in `.env`
- [ ] SSL certificates properly configured
- [ ] DNS pointing to correct server
- [ ] Firewall configured (ports 80, 443, 22)

## 📞 **Support**

If you encounter issues:
1. Check the logs: `ssh roman@pessoa.theater "cd /opt/pessoa && docker compose logs"`
2. Verify SSL certificates: `curl -I https://pessoa.theater`
3. Check DNS resolution: `dig pessoa.theater`
4. Verify server connectivity: `ssh roman@pessoa.theater`

---

**Ready to deploy?** Run `./scripts/build_and_push_pessoa_theater.sh` from your local machine! 🚀 