# 🔄 Migration Guide: Current Hetzner Setup → GitHub Actions

This guide will help you migrate from your **current working Hetzner setup** to **automatic GitHub Actions deployment** while keeping everything working.

## 📊 Current vs New Setup Comparison

### Your Current Setup (`docker-compose-hetzner working copy.md`)
```yaml
# ❌ CURRENT: Building on server (slow)
backend:
  build:
    context: ./backend
    target: builder  # Development mode
  volumes:
    - ./backend:/app  # Source code mounting
  command: ["sh", "-c", "cargo-watch -q -x 'run --bin backend'"]

frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile.https
  volumes:
    - ./frontend:/app:cached  # Source code mounting
```

### New GitHub Actions Setup (`docker-compose.hetzner-github-actions.yml`)
```yaml
# ✅ NEW: Pre-built production images (fast)
backend:
  image: ${DOCKER_REGISTRY}/pessoa-backend:${IMAGE_TAG:-latest}
  # No source code mounting needed
  # Production runtime container

frontend:
  image: ${DOCKER_REGISTRY}/pessoa-frontend:${IMAGE_TAG:-latest}
  # No source code mounting needed
  # Production nginx container
```

## 🎯 Migration Benefits

**What you'll gain:**
- ✅ **10x faster deployments** (no more Rust compilation on server)
- ✅ **Automatic deployments** when you push code
- ✅ **Same mylayer.org:8443 configuration** (no breaking changes)
- ✅ **Easy rollbacks** with image versioning
- ✅ **Consistent builds** across environments

**What stays the same:**
- ✅ **Your domain**: `mylayer.org:8443`
- ✅ **Your SSL certificates**: Same paths
- ✅ **Your database**: Same data, same configuration
- ✅ **Your ports**: 8080 (HTTP), 8443 (HTTPS), 5050 (pgAdmin)

## 🛠️ Step-by-Step Migration

### Step 1: Set Up GitHub Actions (Repository)

1. **Update GitHub repository settings:**
   ```bash
   # In your GitHub repo: Settings → Actions → General
   # Set "Workflow permissions" to "Read and write permissions"
   ```

2. **Add GitHub Secrets:**
   Go to `Settings → Secrets and variables → Actions` and add:

   | Secret Name | Value for Your Setup |
   |-------------|---------------------|
   | `HETZNER_HOST` | `your-hetzner-server-ip` |
   | `HETZNER_USER` | `your-ssh-username` |
   | `HETZNER_SSH_KEY` | `your-ssh-private-key` |
   | `DEPLOY_PATH` | `/home/your-user/pessoa-prod` |
   | `DATABASE_URL` | `postgres://dummy:dummy@dummy:5432/dummy` |
   | `VITE_API_BASE_URL` | `https://mylayer.org:8443` |
   | `VITE_WS_BASE_URL` | `wss://mylayer.org:8443/api/collab` |

3. **Generate deployment SSH key:**
   ```bash
   # On your local machine
   ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/hetzner_deploy
   
   # Copy public key to your Hetzner server
   ssh-copy-id -i ~/.ssh/hetzner_deploy.pub your-user@your-hetzner-server
   
   # Copy private key content to HETZNER_SSH_KEY secret
   cat ~/.ssh/hetzner_deploy
   ```

### Step 2: Update Environment Configuration

1. **Update your environment file:**
   ```bash
   # Edit env.hetzner-github-actions.template
   # Change this line:
   DOCKER_REGISTRY=ghcr.io/your-actual-github-username  # Replace with your username
   ```

2. **Copy to your Hetzner server:**
   ```bash
   # Copy the new environment file to your server
   scp env.hetzner-github-actions.template your-user@your-hetzner-server:/path/to/your/pessoa/.env
   ```

### Step 3: Deploy New Docker Compose File

1. **Copy new compose file to server:**
   ```bash
   scp docker-compose.hetzner-github-actions.yml your-user@your-hetzner-server:/path/to/your/pessoa/
   ```

### Step 4: Test GitHub Actions Build

1. **Commit and push your code:**
   ```bash
   git add .
   git commit -m "Add GitHub Actions deployment for Hetzner"
   git push origin main
   ```

2. **Watch the build:**
   - Go to your GitHub repository
   - Click "Actions" tab
   - Watch "Deploy to Hetzner Server" workflow
   - First build will take longer (building images)

### Step 5: Migrate Your Hetzner Server

**⚠️ IMPORTANT: Do this during low-traffic time**

1. **SSH to your Hetzner server:**
   ```bash
   ssh your-user@your-hetzner-server
   cd /path/to/your/pessoa
   ```

2. **Backup your current setup:**
   ```bash
   # Stop current containers
   docker-compose -f docker-compose-hetzner\ working\ copy.md down
   
   # Backup your database (optional but recommended)
   docker run --rm --network container:main_pessoa_db \
     postgres:15 pg_dump -h localhost -U pessoa_user pessoa_db > backup.sql
   ```

3. **Start with new GitHub Actions setup:**
   ```bash
   # Pull the pre-built images
   docker-compose -f docker-compose.hetzner-github-actions.yml pull
   
   # Start with new configuration
   docker-compose -f docker-compose.hetzner-github-actions.yml up -d
   
   # Check everything is running
   docker-compose -f docker-compose.hetzner-github-actions.yml ps
   ```

4. **Verify your application:**
   - Visit `https://mylayer.org:8443`
   - Test login/functionality
   - Check pgAdmin at `https://mylayer.org:5050`

## 🔧 Configuration Changes Summary

### Environment Variables Added:
```bash
# New variables for GitHub Actions
DOCKER_REGISTRY=ghcr.io/your-github-username
IMAGE_TAG=latest
SSL_CERT_PATH=/etc/ssl/certs/mylayer.org.crt
SSL_KEY_PATH=/etc/ssl/private/mylayer.org.key
```

### Docker Compose Changes:
```yaml
# OLD: Building on server
build:
  context: ./backend
  target: builder

# NEW: Using pre-built images
image: ${DOCKER_REGISTRY}/pessoa-backend:${IMAGE_TAG:-latest}
```

## 🚨 Troubleshooting

### If deployment fails:

1. **Check GitHub Actions logs:**
   - Go to Actions tab in your repo
   - Click on failed workflow
   - Check build/deployment steps

2. **Check your Hetzner server:**
   ```bash
   # On Hetzner server
   docker-compose -f docker-compose.hetzner-github-actions.yml logs
   
   # Check if images were pulled
   docker images | grep pessoa
   ```

3. **Rollback if needed:**
   ```bash
   # Start your old setup
   docker-compose -f docker-compose-hetzner\ working\ copy.md up -d
   ```

### Common issues:

**"Image not found":**
- Check DOCKER_REGISTRY matches your GitHub username
- Verify GitHub Actions completed successfully
- Check GitHub Container Registry permissions

**"Permission denied":**
- Verify SSH key is correct in GitHub secrets
- Test SSH connection manually

**"SSL certificate not found":**
- Verify SSL_CERT_PATH and SSL_KEY_PATH in .env
- Check certificate file permissions

## 🎉 Success Indicators

Once migrated successfully, you'll see:

1. **Faster deployments:**
   ```bash
   # Old way: 5-10 minutes (building Rust)
   # New way: 30-60 seconds (pulling images)
   ```

2. **Automatic deployments:**
   ```bash
   git push origin main
   # → Automatically deploys to mylayer.org:8443
   ```

3. **Same functionality:**
   - https://mylayer.org:8443 (main app)
   - https://mylayer.org:5050 (pgAdmin)
   - All features working as before

## 🔄 Daily Workflow After Migration

```bash
# 1. Make your changes locally
git add .
git commit -m "Your changes"

# 2. Push to trigger automatic deployment
git push origin main

# 3. GitHub Actions automatically:
#    - Builds Docker images
#    - Pushes to GitHub Container Registry
#    - Deploys to your Hetzner server

# 4. Check deployment (optional)
# Visit https://mylayer.org:8443 to verify
```

## 📞 Support

If you encounter issues during migration:

1. **Check logs first:**
   - GitHub Actions logs
   - Hetzner server logs
   - Docker container logs

2. **Test rollback:**
   - Your old setup is preserved
   - Can switch back anytime

3. **Verify each step:**
   - GitHub secrets are correct
   - SSH key has proper access
   - Environment variables match your setup

---

**Ready to migrate?** Start with Step 1 and follow the guide step by step. Your `mylayer.org:8443` setup will keep working, but deployments will be much faster! 🚀 