# 🚀 Local to Hetzner Migration Guide

## 📋 **What Changed to Make Local Code Work on Hetzner**

### **🔧 Code Changes Made (Works on Both Local & Hetzner)**

#### **1. Frontend: Fixed SSL Certificate Issue**
**File:** `frontend/vite.config.ts`

**Problem:** Vite config was trying to read SSL dev certificates during Docker builds, causing failures.

**Solution:** Made SSL certificates conditional - only use when they exist:

```typescript
// Before (BROKEN):
https: {
  key: fs.readFileSync('./ssl/dev-key.pem'),
  cert: fs.readFileSync('./ssl/dev-cert.pem'),
},

// After (WORKS ON BOTH):
// Check if SSL dev certificates exist
const sslKeyPath = './ssl/dev-key.pem';
const sslCertPath = './ssl/dev-cert.pem';
const hasSSLCerts = fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath);

// Only use HTTPS if SSL certificates exist (local development)
...(hasSSLCerts && {
  https: {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath),
  },
}),
```

**Result:** 
- ✅ **Local**: Uses HTTPS if dev certificates exist
- ✅ **Hetzner**: Skips dev HTTPS, uses production SSL via nginx
- ✅ **Docker Build**: No longer fails when certificates don't exist

---

### **🌐 Environment Configuration Changes (Server-Side Only)**

#### **2. Server Environment: Updated Domain & URLs**
**File:** `/opt/pessoa/.env` (on Hetzner server)

**Changes Made:**
```bash
# Domain Configuration
APP_HOSTNAME=mylayer.org          → APP_HOSTNAME=pessoa.theater
APP_DOMAIN=mylayer.org:8443       → APP_DOMAIN=pessoa.theater

# Frontend URLs (removed custom ports for standard HTTPS)
VITE_API_BASE_URL=https://mylayer.org:8443     → https://pessoa.theater
VITE_WS_BASE_URL=wss://mylayer.org:8443/api/collab → wss://pessoa.theater/api/collab

# CORS Origins
CORS_ORIGINS=https://mylayer.org:8443,...      → https://pessoa.theater,...
ALLOWED_ORIGINS=https://mylayer.org:8443,...   → https://pessoa.theater,...
```

**SSL Certificates:** Already existed and were correct:
```bash
SSL_CERT_PATH=/etc/letsencrypt/live/pessoa.theater/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/pessoa.theater/privkey.pem
```

#### **3. System Service: Disabled Conflicting Nginx**
**Problem:** System nginx was blocking ports 80/443

**Solution:**
```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

---

## 🔄 **Local vs Hetzner: What's Different**

### **🏠 Local Development Setup**
```bash
# Uses docker-compose.yml
docker-compose up -d

# Environment variables for local:
APP_HOSTNAME=localhost
FRONTEND_PORT=8080
BACKEND_PORT=3001
SSL_CERT_PATH=./ssl/localhost.pem    # Local dev certificates
```

### **🌐 Hetzner Production Setup**
```bash
# Uses docker-compose.hetzner-github-actions.yml
docker compose -f docker-compose.hetzner-github-actions.yml up -d

# Environment variables for Hetzner:
APP_HOSTNAME=pessoa.theater
FRONTEND_PORT=80/443                 # Standard web ports
BACKEND_PORT=3001
SSL_CERT_PATH=/etc/letsencrypt/live/pessoa.theater/fullchain.pem  # Let's Encrypt
```

---

## 📝 **Migration Checklist: Local → Hetzner**

### **✅ Code Changes (One-time, works everywhere)**
- [x] **Fixed `frontend/vite.config.ts`** - SSL certificates now conditional
- [x] **Created deployment scripts** - `scripts/build_and_push_pessoa_theater.sh`

### **🔧 Server Configuration (Hetzner-specific)**
- [x] **Environment variables** - Updated `.env` file on server
- [x] **SSL certificates** - Let's Encrypt certificates for pessoa.theater
- [x] **System services** - Disabled conflicting nginx
- [x] **Ports** - Using standard 80/443 instead of custom ports

### **🚀 Deployment Process**
- [x] **Build locally** - Docker builds work without SSL cert errors
- [x] **Push to registry** - Images tagged and pushed to ghcr.io
- [x] **Deploy to server** - Automated deployment via SSH

---

## 🛠️ **How to Deploy Again**

### **From Local Machine:**
```bash
# 1. Make sure you're on the branch you want to deploy
git checkout uuu  # or whatever branch

# 2. Run the deployment script
./scripts/build_and_push_pessoa_theater.sh

# 3. Script will:
#    - Build images locally
#    - Push to GitHub Container Registry
#    - Deploy to pessoa.theater via SSH
#    - Restart services
```

### **Manual Deployment (if needed):**
```bash
# SSH to server
ssh roman@pessoa.theater

# Navigate to project directory
cd /opt/pessoa

# Update image tags in .env (if needed)
# IMAGE_TAG=prod-uuu-4275611-20250704-161813

# Pull new images and restart
docker compose -f docker-compose.hetzner-github-actions.yml pull
docker compose -f docker-compose.hetzner-github-actions.yml up -d
```

---

## 🔍 **Key Differences Summary**

| Aspect | Local Development | Hetzner Production |
|--------|------------------|-------------------|
| **Domain** | `localhost:8080` | `pessoa.theater` |
| **SSL** | Dev certificates (optional) | Let's Encrypt |
| **Ports** | `8080`, `3001` | `80/443`, `3001` |
| **Environment** | `.env` (local) | `.env` (server) |
| **Docker Compose** | `docker-compose.yml` | `docker-compose.hetzner-github-actions.yml` |
| **Images** | Built locally | Pulled from registry |

---

## 💡 **Best Practices**

### **🔄 For Future Deployments:**
1. **Always test locally first** - Make sure it works with `docker-compose up`
2. **Commit changes** - Clean git state for consistent deployments
3. **Use deployment script** - `./scripts/build_and_push_pessoa_theater.sh`
4. **Monitor deployment** - Check logs after deployment

### **🛡️ For Environment Management:**
1. **Keep environment files separate** - Local `.env` vs Server `.env`
2. **Don't commit sensitive data** - Use `.env` files, not hardcoded values
3. **Test both environments** - Code should work locally and in production

### **📦 For Container Management:**
1. **Use specific tags** - Avoid `latest` for production
2. **Clean up old images** - Remove unused containers periodically
3. **Monitor resource usage** - Check CPU/memory on server

---

## 🆘 **Troubleshooting**

### **🔍 Common Issues:**

#### **SSL Certificate Errors:**
```bash
# Check certificates on server
sudo ls -la /etc/letsencrypt/live/pessoa.theater/
sudo openssl x509 -in /etc/letsencrypt/live/pessoa.theater/fullchain.pem -text -noout | grep -A2 "Subject Alternative Name"
```

#### **Port Conflicts:**
```bash
# Check what's using ports
sudo netstat -tulpn | grep -E ":(80|443|3001)"
sudo lsof -i :80
```

#### **Container Issues:**
```bash
# Check container status
docker ps
docker compose -f docker-compose.hetzner-github-actions.yml ps

# Check logs
docker compose -f docker-compose.hetzner-github-actions.yml logs
```

#### **Environment Variables:**
```bash
# Check current environment on server
cd /opt/pessoa
grep -E "(APP_HOSTNAME|VITE_)" .env
```

---

## 📚 **Files Created/Modified**

### **✅ New Files:**
- `LOCAL_TO_HETZNER_MIGRATION_GUIDE.md` (this file)
- `scripts/build_and_push_pessoa_theater.sh` - Deployment script
- `env.pessoa.theater.production` - Template environment
- `PESSOA_THEATER_SETUP_GUIDE.md` - Setup guide

### **✅ Modified Files:**
- `frontend/vite.config.ts` - Fixed SSL certificate handling
- `/opt/pessoa/.env` (on server) - Updated domain/URLs

---

## 🎯 **Summary**

**✅ The same code now works on both local and Hetzner!**

**Key insight:** The main issue was environment-specific configuration (domains, ports, SSL paths), not code compatibility. By making SSL certificates conditional and using environment variables properly, the same codebase works everywhere.

**For future deployments:** Just run `./scripts/build_and_push_pessoa_theater.sh` and it will handle everything automatically! 🚀 