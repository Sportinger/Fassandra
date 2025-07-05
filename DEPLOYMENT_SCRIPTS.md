# 🚀 Enhanced Deployment Scripts

This project has **two powerful deployment scripts** with flexible parameters for different development scenarios:

## 🏠 Local Development: `./deploy_local.sh [target] [options]`

**Targets:**
- `all` - Rebuild everything (default)
- `frontend` - Rebuild just frontend
- `backend` - Rebuild just backend  
- `db` - Reset database only

**Options:**
- `--no-cache` - Force rebuild without Docker cache
- `--reset-db` - Reset database (drop volumes)
- `--clean` - Clean up old containers/images first
- `--help` - Show usage information

**Usage Examples:**
```bash
./deploy_local.sh                           # Default: rebuild all, keep DB
./deploy_local.sh all --reset-db --no-cache # Full rebuild + DB reset + no cache
./deploy_local.sh frontend --no-cache       # Just frontend, no cache
./deploy_local.sh backend                   # Just backend, with cache
./deploy_local.sh db --reset                # Just reset database
./deploy_local.sh all --clean               # Full rebuild + cleanup
```

**Endpoints after deployment:**
- Frontend HTTPS: https://192.168.2.111:8443 (PRIMARY)
- Frontend HTTP: http://192.168.2.111:8080 (redirects to HTTPS)
- Backend API: https://192.168.2.111:8443/api
- PgAdmin: http://localhost:5050

## 🌐 Hetzner Production: `./deploy_hetzner.sh [target] [options]`

**Targets:**
- `all` - Rebuild everything (default)
- `frontend` - Rebuild just frontend
- `backend` - Rebuild just backend
- `db` - Reset database only

**Options:**
- `--no-cache` - Force rebuild without Docker cache
- `--reset-db` - Reset database (drop volumes)
- `--clean` - Clean up old containers/images first
- `--deploy-only` - Skip build/push, deploy only (for server)
- `--help` - Show usage information

**Usage Examples:**
```bash
./deploy_hetzner.sh                           # Default: rebuild all, keep DB
./deploy_hetzner.sh all --reset-db --no-cache # Full rebuild + DB reset + no cache
./deploy_hetzner.sh frontend --no-cache       # Just frontend, no cache
./deploy_hetzner.sh backend                   # Just backend, with cache
./deploy_hetzner.sh db --reset                # Just reset database
./deploy_hetzner.sh all --clean               # Full rebuild + cleanup
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