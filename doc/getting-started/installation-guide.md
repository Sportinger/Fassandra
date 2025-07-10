# 🛠️ Installation Guide

A complete guide to setting up Pessoa from scratch, with all the lessons learned from real-world deployments.

## 📋 Prerequisites

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+ recommended), macOS, or Windows with WSL2
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB free space minimum
- **Network**: Stable internet connection for Docker images and AI API

### Required Software
- **Docker**: Version 24.0+ with Docker Compose
- **Git**: For cloning the repository
- **Text Editor**: VS Code recommended

## 🚀 Step-by-Step Installation

### 1. Install Docker and Docker Compose

#### Ubuntu/Debian
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt-get install docker-compose-plugin
```

#### macOS
```bash
# Install Docker Desktop from https://docker.com/products/docker-desktop
# Docker Compose is included with Docker Desktop
```

#### Windows
```bash
# Install Docker Desktop from https://docker.com/products/docker-desktop
# Enable WSL2 backend in Docker Desktop settings
```

### 2. Clone the Repository

```bash
git clone https://github.com/your-org/pessoa.git
cd pessoa
```

### 3. Environment Configuration

#### Copy Environment Template
```bash
cp env.example .env
```

#### Edit Environment Variables
Open `.env` in your text editor and configure:

**Required Changes:**
```bash
# Database Configuration (can keep defaults for development)
POSTGRES_USER=pessoa_user
POSTGRES_PASSWORD=dev_password_123  # CHANGE FOR PRODUCTION!
POSTGRES_DB=pessoa_db

# AI Integration (REQUIRED)
GEMINI_API_KEY=your_gemini_api_key_here  # Get from Google AI Studio

# Frontend Configuration (use empty strings for development)
VITE_API_BASE_URL=""
VITE_WS_BASE_URL=""
```

**Getting Your Gemini API Key:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy and paste it into your `.env` file

### 4. Initial Setup

#### Option A: Automated Setup (Recommended)
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run automated clean setup
./scripts/clean_rebuild_with_fixes.sh
```

#### Option B: Manual Setup
```bash
# Build and start all services
docker compose up --build -d

# Wait for containers to start (about 30 seconds)
sleep 30

# Apply post-setup fixes
./scripts/post_rebuild_fixes.sh
```

### 5. Verification

#### Check Container Status
```bash
docker compose ps
```

You should see all services running:
- ✅ `dev_pessoa_frontend` (healthy)
- ✅ `dev_pessoa_backend` (healthy)  
- ✅ `dev_pessoa_db` (healthy)
- ✅ `dev_pessoa_pgadmin` (healthy)

#### Check Application Access
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Database Admin**: http://localhost:5050

#### Test Upload Functionality
1. Register a new account at http://localhost:3000
2. Upload a test document (any .docx file)
3. Verify it processes successfully

## 🔧 Common Issues & Solutions

### Issue 1: "NetworkError when attempting to fetch resource"

**Symptoms**: Upload fails with network error
**Cause**: Frontend can't reach backend due to IP mismatch
**Solution**: 
```bash
# Run the IP fix script
./scripts/post_rebuild_fixes.sh
```

### Issue 2: "Database migration failed"

**Symptoms**: Backend crashes on startup with migration errors
**Cause**: Database schema conflicts
**Solution**:
```bash
# Clean rebuild with automatic fixes
./scripts/clean_rebuild_with_fixes.sh
```

### Issue 3: "column already exists" errors

**Symptoms**: Migration errors about existing columns
**Cause**: Migrations not idempotent
**Solution**: Already fixed in codebase - just restart:
```bash
docker compose restart backend
```

### Issue 4: Gemini API not working

**Symptoms**: Script upload hangs or fails during AI processing
**Cause**: Missing or invalid API key
**Solution**: 
1. Check your `.env` file has correct `GEMINI_API_KEY`
2. Verify key is valid at [Google AI Studio](https://makersuite.google.com/app/apikey)
3. Restart backend: `docker compose restart backend`

### Issue 5: Frontend shows blank page

**Symptoms**: Browser shows empty page at localhost:3000
**Cause**: Frontend build failed or SSL issues
**Solution**:
```bash
# Check frontend logs
docker compose logs frontend

# If SSL certificate issues, rebuild
docker compose restart frontend
```

## 🔄 Maintenance Operations

### Clean Rebuild (Safe)
When you need a fresh start but want to keep your data:
```bash
./scripts/clean_rebuild_with_fixes.sh
```

### Reset Everything (Destructive)
⚠️ **This deletes ALL data including uploaded scripts**
```bash
# Stop and remove everything
docker compose down -v

# Clean Docker system
docker system prune -a -f

# Rebuild from scratch
./scripts/clean_rebuild_with_fixes.sh
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Update to Latest Version
```bash
# Pull latest changes
git pull origin main

# Rebuild with latest changes
./scripts/clean_rebuild_with_fixes.sh
```

## 🎯 Development vs Production

### Development Setup (Current)
- Uses Docker containers
- Frontend proxy for API calls
- Self-signed SSL certificates
- Database includes test data

### Production Setup
For production deployment, see:
- **[Hetzner Deployment](../deployment/hetzner.md)** - Recommended
- **[Security Configuration](../security/README.md)** - Essential security settings
- **[Environment Variables](../security/configuration/environment-variables.md)** - Production environment

## 📞 Getting Help

### Check These First
1. **[Troubleshooting Guide](../troubleshooting/README.md)** - Common issues
2. **Container Logs**: `docker compose logs [service-name]`
3. **Network Issues**: Run `./scripts/post_rebuild_fixes.sh`

### Still Having Issues?
1. **GitHub Issues**: [Report a bug](https://github.com/your-org/pessoa/issues)
2. **Discord**: [Join our community](https://discord.gg/your-invite)
3. **Email**: support@pessoa.theater

## 🎉 Success!

If you can:
- ✅ Access the frontend at http://localhost:3000
- ✅ Register a new account
- ✅ Upload and process a script
- ✅ See the collaborative editor

**Congratulations! Pessoa is now running successfully!** 🎭

---

**Next Steps**: 
- **[User Guide](../getting-started/user-guide.md)** - Learn how to use Pessoa
- **[First Steps](../getting-started/first-steps.md)** - Upload your first script
- **[Deployment Guide](../deployment/README.md)** - Deploy to production 