# 🚀 Pessoa Deployment Scripts

This directory contains scripts for flexible deployment workflows that support both fast development and production-grade releases.

## 📋 Quick Reference

| Script | Purpose | Speed | Use Case |
|--------|---------|-------|----------|
| `./deploy.sh dev` | Local build + deploy | ⚡ **3-5 min** | Daily development |
| `./deploy.sh dev-images` | Deploy GitHub dev images | ⚡ **30 sec** | After pushing to dev branch |
| `./deploy.sh production` | Full production release | 🐌 **15 min** | Official releases |
| `./deploy.sh status` | Check deployment status | ⚡ **5 sec** | Monitoring |

## 🔄 Recommended Workflows

### **Daily Development (Super Fast)**
```bash
# Make changes to your code
git add . && git commit -m "feat: new feature"

# Deploy immediately (3-5 minutes total)
./scripts/deploy.sh dev
```

### **Development with GitHub Actions**
```bash
# Push to dev branch (triggers GitHub Actions build)
git push origin dev

# Wait for build to complete (~15 min), then deploy instantly
./scripts/deploy.sh dev-images
```

### **Production Releases**
```bash
# Merge to main (triggers automatic deployment)
git checkout main
git merge dev
./scripts/deploy.sh production  # or just: git push origin main
```

## 🛠️ Individual Scripts

### `dev_deploy.sh`
- **Builds locally** (uses your machine's power)
- **Pushes to registry** (ghcr.io)
- **Deploys to production server**
- **Fastest option** for development

### `deploy_dev_images.sh`
- **Uses pre-built images** from GitHub Actions
- **No local building** required
- **Instant deployment** after images are available

### `deploy.sh`
- **Universal deployment script**
- **Handles all scenarios** with simple commands
- **Built-in help and safety checks**

## 🌐 Deployment Targets

| Domain | Purpose | SSL Certificate |
|--------|---------|----------------|
| **mylayer.org:8443** | Production site | ✅ Existing certificate |
| **pessoa.com.de:8443** | Test/staging site | ✅ Let's Encrypt |

## 🔧 Setup Requirements

1. **Docker Registry Access**:
   ```bash
   echo $GITHUB_TOKEN | docker login ghcr.io -u sportinger --password-stdin
   ```

2. **SSH Access**:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/pessoa_deploy
   ssh-copy-id -i ~/.ssh/pessoa_deploy.pub roman@mylayer.org
   ```

3. **GitHub Secrets** (already configured):
   - `HETZNER_HOST`, `HETZNER_USER`, `HETZNER_SSH_KEY`
   - `DATABASE_URL`, `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`

## 📊 Performance Comparison

| Method | Build Time | Deploy Time | Total Time | Automation |
|--------|------------|-------------|------------|------------|
| **Local Dev** | 3-5 min | 30 sec | **3-5 min** | Manual |
| **Dev Images** | 15 min (GitHub) | 30 sec | **30 sec** | Semi-auto |
| **Production** | 15 min (GitHub) | 30 sec | **15 min** | Full auto |

## 🚀 Getting Started

1. **Try the fast workflow**:
   ```bash
   ./scripts/deploy.sh dev
   ```

2. **Check deployment status**:
   ```bash
   ./scripts/deploy.sh status
   ```

3. **Get help anytime**:
   ```bash
   ./scripts/deploy.sh help
   ```

## 🔒 Security Notes

- **Local builds** use your GitHub token for registry push
- **SSH keys** should be separate for deployment (not your main key)
- **Production deploys** only from `main` branch (safety feature)
- **All scripts** include safety checks and confirmations 