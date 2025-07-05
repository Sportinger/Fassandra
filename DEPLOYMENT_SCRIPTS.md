# Pessoa Deployment Scripts

Automated deployment scripts for local development and Hetzner production environments.

## Quick Start

```bash
# Local development (production build)
./deploy_local.sh

# Local development with hot reload
./deploy_local.sh --hot-reload

# Production deployment to Hetzner
./deploy_hetzner.sh
```

## Scripts Overview

### `deploy_local.sh` - Local Development
- **Purpose**: Deploy to local development environment
- **URL**: `https://192.168.2.111:8443`
- **Features**: HTTPS with self-signed certificates, hot reload support

### `deploy_hetzner.sh` - Production Deployment  
- **Purpose**: Deploy to Hetzner production server
- **URL**: `https://pessoa.theater`
- **Features**: Optimized builds, automatic push to registry, remote deployment

## Hot Reload Development 🔥

### What is Hot Reload?
Hot reload provides instant feedback during development by automatically updating the browser when you save files, without requiring manual rebuilds.

### Features
- **Frontend**: Vite dev server with React Fast Refresh
- **Backend**: Cargo-watch with automatic Rust recompilation
- **Instant Updates**: Changes appear in browser immediately
- **State Preservation**: React state is preserved during updates

### Usage

```bash
# Enable hot reload for all services
./deploy_local.sh --hot-reload

# Enable hot reload for specific service
./deploy_local.sh frontend --hot-reload
./deploy_local.sh backend --hot-reload
```

### URLs in Hot Reload Mode
- **Frontend Dev Server**: `http://192.168.2.111:8444` (instant changes)
- **Backend API**: `http://192.168.2.111:3001/api` (cargo-watch hot reload)
- **Database**: `postgresql://localhost:5432/pessoa_db`
- **PgAdmin**: `http://localhost:5050`

### Hot Reload vs Production Build

| Feature | Production Build | Hot Reload |
|---------|------------------|------------|
| **Build Time** | 30-60 seconds | 5-10 seconds |
| **File Changes** | Manual rebuild required | Instant browser update |
| **Performance** | Optimized for production | Optimized for development |
| **SSL** | HTTPS (port 8443) | HTTP (port 8444) |
| **State Preservation** | Full page reload | React state preserved |

### Development Workflow

1. **Start Hot Reload**:
   ```bash
   ./deploy_local.sh --hot-reload
   ```

2. **Open Browser**: Navigate to `http://192.168.2.111:8444`

3. **Edit Files**: Make changes to any file in `./frontend` or `./backend`

4. **See Changes**: Browser updates automatically (frontend) or API restarts (backend)

5. **Stop Services**:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.hot-reload.yml --env-file .env.local down
   ```

### Technical Implementation

**Frontend Hot Reload**:
- Uses Vite development server with React Fast Refresh
- Volume mounts `./frontend` for live file watching
- Polling enabled for Docker compatibility (`CHOKIDAR_USEPOLLING=true`)
- Runs on port 8444 to avoid conflicts with production build

**Backend Hot Reload**:
- Uses `cargo-watch` to monitor Rust source files
- Automatically recompiles and restarts on file changes
- Maintains database connections and state
- Runs on port 3001 (same as production)

**Configuration Files**:
- `docker-compose.hot-reload.yml`: Override configuration for development
- `frontend/Dockerfile.dev`: Development container with Vite dev server
- `frontend/vite.config.ts`: Vite configuration with HMR settings

## Flexible Parameters

**Targets:**
- `all` - Rebuild everything (default)
- `frontend` - Rebuild just frontend
- `backend` - Rebuild just backend  
- `db` - Reset database only

**Options:**
- `--no-cache` - Force rebuild without Docker cache
- `--reset-db` - Reset database (drop volumes)
- `--clean` - Clean up old containers/images first
- `--hot-reload` - Enable full hot reload for frontend (dev server)
- `--help` - Show usage information

**Usage Examples:**
```bash
./deploy_local.sh                           # Default: rebuild all, keep DB
./deploy_local.sh all --reset-db --no-cache # Full rebuild + DB reset + no cache
./deploy_local.sh frontend --hot-reload     # Frontend with hot reload dev server
./deploy_local.sh backend                   # Just backend, with cache
./deploy_local.sh db --reset                # Just reset database
./deploy_local.sh all --clean --hot-reload  # Full rebuild + cleanup + hot reload
```

**🔥 Hot Reload Options:**
- **Default**: Frontend builds static files (faster startup)
- **--hot-reload**: Frontend runs Vite dev server (instant changes)
- **Backend**: Always has hot reload with cargo-watch

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