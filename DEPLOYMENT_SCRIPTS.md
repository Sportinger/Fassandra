# 🚀 Deployment Scripts

This project now has **two separate deployment scripts** that handle environment switching automatically:

## 🏠 Local Development: `./deploy_local.sh`

**What it does:**
- Automatically creates `.env.local` with local development settings
- Uses `docker-compose.yml` 
- Sets up local URLs (`localhost:8080`, `localhost:3001`)
- Optionally cleans up old containers/volumes
- Tests endpoints after deployment

**Usage:**
```bash
./deploy_local.sh
```

**Endpoints after deployment:**
- Frontend HTTPS: https://192.168.2.111:8443 (PRIMARY)
- Frontend HTTP: http://192.168.2.111:8080 (redirects to HTTPS)
- Backend API: https://192.168.2.111:8443/api
- PgAdmin: http://localhost:5050

## 🌐 Hetzner Production: `./deploy_hetzner.sh`

**What it does:**
- Automatically creates `.env.hetzner` with production settings
- Uses `docker-compose.prod.yml`
- Sets up production URLs (`pessoa.theater`)
- Handles build → push → deploy workflow
- Can run locally (build/push) or on server (deploy only)

**Usage:**

### From your local machine (full deployment):
```bash
./deploy_hetzner.sh
```
This will:
1. Build images locally
2. Optionally push to GitHub Container Registry
3. Optionally deploy to Hetzner server via SSH

### On Hetzner server (deploy only):
```bash
./deploy_hetzner.sh --deploy-only
```

**Endpoints after deployment:**
- Frontend: https://pessoa.theater
- Backend API: https://pessoa.theater/api
- PgAdmin: http://pessoa.theater:5050

## 🔄 **No More Manual Environment Switching!**

**Before:** You had to manually edit environment files every time you switched between local and Hetzner.

**Now:** Just run the appropriate script and it handles all the environment configuration automatically.

## 📋 **Key Features**

✅ **Automatic Environment Setup** - No more manual `.env` editing  
✅ **Separate Docker Compose Files** - Uses correct compose file for each environment  
✅ **Health Checks** - Tests endpoints after deployment  
✅ **Interactive Prompts** - Asks before destructive operations  
✅ **Error Handling** - Stops on errors with clear messages  
✅ **Registry Support** - Optional push to GitHub Container Registry  

## 🛠️ **Customization**

You can edit the environment variables in each script if needed:
- **Local settings**: Edit the `.env.local` section in `deploy_local.sh`
- **Hetzner settings**: Edit the `.env.hetzner` section in `deploy_hetzner.sh`

## 📝 **Files Created**

Each script creates its own environment file:
- `deploy_local.sh` → `.env.local`
- `deploy_hetzner.sh` → `.env.hetzner`

These files are automatically generated and don't need to be committed to git.

## 🚨 **Important Notes**

1. **GitHub Container Registry**: Update the image names in `deploy_hetzner.sh` to match your actual repository
2. **SSH Access**: Make sure you have SSH access to `roman@pessoa.theater` for Hetzner deployment
3. **SSL Certificates**: Hetzner script assumes Let's Encrypt certificates exist at `/etc/letsencrypt/live/pessoa.theater/` 