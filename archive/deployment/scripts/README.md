# 🚀 Pessoa Deployment Scripts

Complete local build and deployment workflow for the Pessoa collaborative scriptwriting application.

## 🎯 Overview

**No GitHub Actions Required!** This setup gives you full control over builds and deployments:

- ✅ Build locally (faster on your hardware)
- ✅ No concurrent build issues
- ✅ No CI/CD minutes consumed
- ✅ Complete control over deployment timing
- ✅ Immediate feedback and debugging

## 📦 Available Scripts

### 1. `./scripts/deploy.sh` (Main Entry Point)

Universal deployment script with multiple options:

```bash
# Complete workflow: Build + Push + Deploy
./scripts/deploy.sh build-and-push

# Deploy already-built images (no rebuild)
./scripts/deploy.sh push-current

# Check deployment status  
./scripts/deploy.sh status

# Show help
./scripts/deploy.sh help
```

### 2. `./scripts/build_and_push.sh` (Complete Workflow)

Builds images locally, pushes to registry, and deploys to production:

- 🏗️ Builds both backend and frontend locally
- 📦 Tags with branch, commit, and timestamp
- 🚀 Pushes to GitHub Container Registry
- 🌐 Deploys to Hetzner server automatically
- ⏱️ Total time: ~3-5 minutes

```bash
./scripts/build_and_push.sh
```

### 3. `./scripts/push_current_build.sh` (Deploy Existing Images)

Pushes already-built local images without rebuilding:

- 📋 Shows available local images
- ✅ Validates images exist locally
- 📦 Pushes to registry
- 🚀 Deploys to server
- ⏱️ Total time: ~30 seconds

```bash
# Interactive mode (choose from available images)
./scripts/push_current_build.sh

# Direct mode (specify image tag)
./scripts/push_current_build.sh local-main-abc123-20250128-143500
```

## 🔄 Typical Workflows

### Development Workflow

1. **Make your changes**
2. **Build and deploy**: `./scripts/deploy.sh build-and-push`
3. **Test at**: https://mylayer.org:8443

### Quick Redeploy Workflow

If you already have built images and want to redeploy:

1. **Check available images**: `./scripts/deploy.sh status`
2. **Push specific build**: `./scripts/deploy.sh push-current`

### Status Check Workflow

```bash
./scripts/deploy.sh status
```

Shows:
- Local git status
- Available local Docker images
- Production server status
- Live site links

## 🏗️ Build Details

### Image Tagging Strategy

Images are tagged with: `local-{branch}-{commit}-{timestamp}`

Example: `local-main-a1b2c3d-20250128-143500`

### Registry

Images are pushed to GitHub Container Registry:
- Backend: `ghcr.io/sportinger/pessoa-backend:{tag}`
- Frontend: `ghcr.io/sportinger/pessoa-frontend:{tag}`

### Build Arguments

**Backend:**
- `DATABASE_URL=postgres://pessoa_user:pessoa_password@db:5432/pessoa_db`

**Frontend:**
- `VITE_API_BASE_URL=https://mylayer.org:8443`
- `VITE_WS_BASE_URL=wss://mylayer.org:8443/api/collab`

## 🌐 Production Server

**Server**: mylayer.org  
**User**: roman  
**Path**: `/opt/pessoa`  
**Compose File**: `docker-compose.hetzner-github-actions.yml`

### Live Sites

- **Production**: https://mylayer.org:8443
- **Test Domain**: https://pessoa.com.de:8443

## 🛠️ Prerequisites

1. **Docker** installed locally
2. **SSH access** to `roman@mylayer.org`
3. **GitHub Container Registry** access (via Docker login)

```bash
# Login to GitHub Container Registry
docker login ghcr.io -u YOUR_GITHUB_USERNAME
```

## 🚨 Troubleshooting

### Common Issues

**"Image not found" error:**
- Build images first: `./scripts/deploy.sh build-and-push`

**SSH connection issues:**
- Test: `ssh roman@mylayer.org`
- Check SSH key is added

**Registry push fails:**
- Login: `docker login ghcr.io`
- Check repository permissions

### Debugging

**Check local images:**
```bash
docker images | grep pessoa
```

**Check server status:**
```bash
ssh roman@mylayer.org "cd /opt/pessoa && docker compose -f docker-compose.hetzner-github-actions.yml ps"
```

**View server logs:**
```bash
ssh roman@mylayer.org "cd /opt/pessoa && docker compose -f docker-compose.hetzner-github-actions.yml logs --tail=20"
```

## ⚡ Performance

| Operation | Time | Description |
|-----------|------|-------------|
| Complete Build + Deploy | ~3-5 min | Full local build + push + deploy |
| Push Current Build | ~30 sec | Deploy already-built images |
| Status Check | ~5 sec | Check all statuses |

**Much faster than waiting for GitHub Actions!** 🎉 