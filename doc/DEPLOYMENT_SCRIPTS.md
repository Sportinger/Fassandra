# 🚀 PESSOA DEPLOYMENT SCRIPTS GUIDE

## 📋 Overview

This guide explains how to use the deployment scripts for the Pessoa collaborative scriptwriting platform. We provide separate scripts for local development and production deployment.

## 🏠 Local Development

### Quick Start
```bash
# Default: Safe rebuild preserving your configuration
./deploy_local.sh

# Build specific components (safer for running systems)
./deploy_local.sh frontend  # Safest: only rebuild frontend
./deploy_local.sh backend   # Backend rebuild (preserves data)
./deploy_local.sh db        # Database operations only

# Advanced options (USE WITH CAUTION on working systems)
./deploy_local.sh --hot-reload    # Changes API endpoints (may break)
./deploy_local.sh --reset-db      # DESTROYS ALL DATA (requires confirmation)
./deploy_local.sh --no-cache      # Slower build, forces full rebuild
./deploy_local.sh --clean         # Removes containers (may lose state)
```

### ⚠️ **CRITICAL: If You Have a Working System**

**Your 2-second content snapshot system is precious! Here's how to keep it safe:**

**✅ SAFE commands that preserve your working setup:**
```bash
./deploy_local.sh frontend      # Rebuild frontend only (safest)
./deploy_local.sh backend       # Rebuild backend only  
./deploy_local.sh               # Default rebuild (preserves data & config)
```

**⚠️ POTENTIALLY RISKY commands:**
```bash
./deploy_local.sh --reset-db    # DESTROYS database (your content snapshots!)
./deploy_local.sh --clean       # Removes containers (may lose state)
./deploy_local.sh --hot-reload  # Changes API URLs (may break connections)
```

**🔄 After ANY deployment:**
1. **Hard refresh browser** (Ctrl+Shift+R / Cmd+Shift+R) to load new JavaScript
2. **Check that 2-second snapshots still work** by typing and checking database
3. **If snapshots are slow again**, the browser may be serving cached JavaScript

### Environment Setup
1. Copy `env.example` to `.env`
2. Customize your IP address and ports  
3. Set your development API keys

### 🔥 **Content Snapshot System Protection**

**The 2-second content snapshot system is CRITICAL for data persistence!**

**How it works:**
- Frontend captures editor content every **2 seconds**
- Backend processes snapshots every **2 seconds**
- Content is automatically saved without user intervention
- Survives page reloads, browser crashes, and network issues

**How deployment affects it:**
1. **Frontend rebuild** → Browser cache may serve old JavaScript → **Snapshots may revert to 30-second intervals**
2. **Database reset** → All content snapshots destroyed → **Data loss**
3. **Container recreation** → Runtime state reset → **May temporarily break snapshots**

**Protection checklist after deployment:**
```bash
# 1. Test snapshot timing
# Type in editor, then check database after 2-5 seconds:
docker exec dev_pessoa_db psql -U pessoa_user -d pessoa_db -c "
SELECT LEFT(content_snapshot, 50) as preview, created_at 
FROM script_snapshots_meta 
ORDER BY created_at DESC LIMIT 3;"

# 2. If snapshots are slow, check frontend code:
docker exec dev_pessoa_frontend grep -A 2 -B 2 "setInterval.*sendContentSnapshot" /app/src/components/editor/hooks/useEditorCore.ts

# 3. Force browser to load new code:
# Hard refresh browser with Ctrl+Shift+R / Cmd+Shift+R
```

## 🚀 Production Deployment

### Production Environment Variables Best Practices

#### 🔐 **SECURITY HIERARCHY** (Most Secure → Least Secure)

| **Method** | **Security** | **Use Case** |
|------------|--------------|--------------|
| **1. External Secret Management** | 🔒🔒🔒 | Enterprise (Vault, AWS Secrets) |
| **2. System Environment Variables** | 🔒🔒 | Production servers |
| **3. Docker Secrets** | 🔒🔒 | Docker Swarm/Kubernetes |
| **4. .env files** | 🔒 | Development only |

#### 🛡️ **Recommended Production Setup**

**Step 1: Set System Environment Variables on Production Server**
```bash
# On your production server (pessoa.theater)
export DATABASE_URL="postgres://pessoa_user:REAL_SECURE_PASSWORD@db:5432/pessoa_db"
export JWT_SECRET="super-long-random-string-at-least-32-chars-for-jwt-signing"
export GEMINI_API_KEY="your-actual-gemini-api-key-here"
export PGADMIN_DEFAULT_PASSWORD="secure-pgadmin-password"
export POSTGRES_PASSWORD="real-secure-db-password"

# Make them persistent
echo 'export DATABASE_URL="postgres://pessoa_user:REAL_SECURE_PASSWORD@db:5432/pessoa_db"' >> ~/.bashrc
echo 'export JWT_SECRET="super-long-random-string-at-least-32-chars-for-jwt-signing"' >> ~/.bashrc
echo 'export GEMINI_API_KEY="your-actual-gemini-api-key-here"' >> ~/.bashrc
echo 'export PGADMIN_DEFAULT_PASSWORD="secure-pgadmin-password"' >> ~/.bashrc
echo 'export POSTGRES_PASSWORD="real-secure-db-password"' >> ~/.bashrc
source ~/.bashrc
```

**Step 2: Copy Non-Secret Configuration**
```bash
# Copy the production template (contains no secrets)
cp env.production .env
```

**Step 3: Deploy**
```bash
# Deploy everything
./deploy_hetzner.sh

# Deploy specific components
./deploy_hetzner.sh frontend
./deploy_hetzner.sh backend
```

#### 🔧 **Generate Secure Secrets**

```bash
# Generate secure JWT secret (32+ characters)
openssl rand -hex 32

# Generate secure database password
openssl rand -base64 32

# Generate secure PgAdmin password
openssl rand -base64 16
```

#### 🏢 **Advanced: Using External Secret Management**

**Option A: HashiCorp Vault**
```bash
# Install and configure Vault
export DATABASE_URL="$(vault kv get -field=url secret/pessoa/db)"
export JWT_SECRET="$(vault kv get -field=secret secret/pessoa/jwt)"
export GEMINI_API_KEY="$(vault kv get -field=key secret/pessoa/gemini)"
```

**Option B: AWS Secrets Manager**
```bash
# Install AWS CLI and configure
export DATABASE_URL="$(aws secretsmanager get-secret-value --secret-id pessoa/db-url --query SecretString --output text)"
export JWT_SECRET="$(aws secretsmanager get-secret-value --secret-id pessoa/jwt-secret --query SecretString --output text)"
```

**Option C: Docker Secrets (Docker Swarm)**
```yaml
# docker-compose.prod.yml
services:
  backend:
    secrets:
      - db_password
      - jwt_secret
      - gemini_api_key
    environment:
      DATABASE_URL: "postgres://pessoa_user:$(cat /run/secrets/db_password)@db:5432/pessoa_db"
      JWT_SECRET: "$(cat /run/secrets/jwt_secret)"
      GEMINI_API_KEY: "$(cat /run/secrets/gemini_api_key)"

secrets:
  db_password:
    external: true
  jwt_secret:
    external: true
  gemini_api_key:
    external: true
```

### Hetzner Production Deployment

#### Prerequisites
- Hetzner server with Docker and Docker Compose
- GitHub Container Registry access
- SSL certificates (Let's Encrypt)

#### Quick Deploy
```bash
# Build and deploy everything
./deploy_hetzner.sh

# Deploy specific components
./deploy_hetzner.sh frontend --no-cache
./deploy_hetzner.sh backend --no-cache
./deploy_hetzner.sh all --reset-db --clean
```

#### Advanced Options
```bash
# Full rebuild with database reset
./deploy_hetzner.sh all --reset-db --no-cache --clean

# Deploy-only mode (skip build/push, run on server)
./deploy_hetzner.sh all --deploy-only

# Frontend only with no cache
./deploy_hetzner.sh frontend --no-cache
```

## 🎯 **Why System Environment Variables Are Better**

### **Development**: `.env` files are perfect ✅
- Easy for developers to set up
- Can be version controlled (without secrets)
- Quick to modify

### **Production**: System environment variables are better 🔒
- **More secure** - No secret files on disk
- **Better for containers** - Standard practice
- **Easier secret rotation** - Change without file edits
- **Better for CI/CD** - Standard in most platforms
- **Audit trails** - Better logging of secret access

## 🔄 **Migration Strategy**

### Current Setup → Recommended Setup

**What you have now** (Good for development):
```bash
# .env file
DATABASE_URL=postgres://user:pass@db:5432/db
JWT_SECRET=secret
```

**What you should have in production** (Much more secure):
```bash
# System environment variables
export DATABASE_URL="postgres://user:real_secure_pass@db:5432/db"
export JWT_SECRET="real_long_random_string"

# .env file (non-secrets only)
APP_HOSTNAME=pessoa.theater
CONTAINER_PREFIX=prod_
RUST_LOG=info
```

This gives you:
- ✅ **Security** - Secrets not in files
- ✅ **Flexibility** - Easy to change without redeploying
- ✅ **Compliance** - Meets security standards
- ✅ **Simplicity** - Still easy to manage

## 🚨 **Security Checklist**

### Development Environment ✅
- [ ] Use `.env` files for convenience
- [ ] Never commit real API keys
- [ ] Use development/test credentials only

### Production Environment 🔒
- [ ] Set secrets as system environment variables
- [ ] Use `.env` files for non-secret config only
- [ ] Rotate secrets regularly
- [ ] Use strong, unique passwords (32+ chars)
- [ ] Consider external secret management for enterprise

## 🔗 **Useful Commands**

```bash
# Check what environment variables are set
env | grep -E "(DATABASE_URL|JWT_SECRET|GEMINI_API_KEY)"

# Test if Docker can access environment variables
docker run --rm -e DATABASE_URL="$DATABASE_URL" alpine env | grep DATABASE_URL

# Generate secure secrets
openssl rand -hex 32    # For JWT secrets
openssl rand -base64 32 # For passwords
```

## 📞 **Troubleshooting**

### Common Issues
1. **Environment variables not loading** - Check if they're exported
2. **Docker not seeing variables** - Ensure they're in the shell running docker-compose
3. **Secrets still in files** - Review `.env` files for accidental secrets

### Debug Commands
```bash
# Check if environment variables are set
echo $DATABASE_URL
echo $JWT_SECRET

# Check Docker environment
docker-compose config

# Check container environment
docker exec container_name env
```

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