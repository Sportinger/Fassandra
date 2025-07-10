# 🚀 Quick Start Guide

Get Pessoa running in 5 minutes and start collaborating on your first script.

## 🎯 What You'll Achieve

By the end of this guide, you'll have:
- ✅ Pessoa running locally with HTTPS
- ✅ A user account created
- ✅ Your first script uploaded and analyzed by AI
- ✅ Real-time collaboration working

## 📋 Prerequisites

- **Docker & Docker Compose** (required)
- **4GB+ RAM** (recommended)
- **Modern browser** (Chrome, Firefox, Safari, Edge)

### Install Docker
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# macOS
brew install docker docker-compose

# Windows
# Download Docker Desktop from https://docker.com/products/docker-desktop
```

## 🚀 Step 1: Get the Code

```bash
# Clone the repository
git clone https://github.com/your-org/pessoa.git
cd pessoa

# Copy environment template
cp env.example .env
```

## 🔧 Step 2: Configure Environment

Open `.env` in your text editor and set these **required** values:

```bash
# Security (REQUIRED - Generate secure values!)
POSTGRES_PASSWORD=your_secure_database_password_here
JWT_SECRET=your_super_long_jwt_secret_at_least_32_characters_long

# AI Features (REQUIRED for script analysis)
GEMINI_API_KEY=your_gemini_api_key_here

# Network (Optional - defaults work for local development)
APP_HOSTNAME=localhost
FRONTEND_HTTPS_PORT=8080
```

### 🔑 Generate Secure Secrets

```bash
# Generate secure JWT secret (32+ characters)
openssl rand -hex 32

# Generate secure database password
openssl rand -base64 32
```

### 🤖 Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to your `.env` file

## 🐳 Step 3: Start Pessoa

```bash
# Start all services
docker compose up -d

# Wait for services to start (30-60 seconds)
docker compose logs -f
```

**Look for these success messages:**
```
✅ pessoa_db       | database system is ready to accept connections
✅ pessoa_backend  | Server running on http://0.0.0.0:3001
✅ pessoa_frontend | Network: https://172.18.0.x:8080/
```

## 🌐 Step 4: Access Pessoa

1. **Open your browser** to: **https://localhost:8080**
2. **Accept the security warning** (self-signed certificate for development)
   - Click "Advanced" → "Proceed to localhost (unsafe)"
3. **You should see the Pessoa login page** 🎉

## 👤 Step 5: Create Your Account

### Option A: Use Development Account
- **Email**: `admin@pessoa.de`
- **Password**: `PassoaDevteam`

### Option B: Create New Account
1. Click "Register"
2. Fill in your details
3. Click "Create Account"

## 📄 Step 6: Upload Your First Script

1. **Click "Upload Script"** in the main interface
2. **Select a `.docx` file** (your script document)
3. **Watch the magic happen**:
   - File uploads with detailed progress
   - AI analyzes the content
   - Script structure is automatically detected
   - Characters and dialogue are identified

## 🤝 Step 7: Start Collaborating

1. **Click on your uploaded script** to open the editor
2. **Start typing** - changes save automatically every 2 seconds
3. **Open the same script in another browser tab** to see real-time collaboration
4. **Watch the user counter** in the top-right corner

## 🎉 Success! You're Now Running Pessoa

### What's Next?

| Action | Guide |
|--------|-------|
| **Learn all features** | [Complete User Guide](user-guide.md) |
| **Set up mobile access** | [Mobile Setup Guide](mobile-setup.md) |
| **Deploy to production** | [Deployment Guide](../deployment/README.md) |
| **Contribute to development** | [Development Guide](../development/README.md) |

## 🛠️ Quick Commands

```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop services
docker compose down

# Stop and remove everything
docker compose down -v

# Rebuild after changes
docker compose up -d --build
```

## 📱 Mobile Access

To access Pessoa from mobile devices:

1. **Find your IP address**:
   ```bash
   # Linux/macOS
   ip addr show | grep inet
   
   # Windows
   ipconfig
   ```

2. **Update your `.env` file**:
   ```bash
   APP_HOSTNAME=192.168.1.100  # Your actual IP
   ```

3. **Restart frontend**:
   ```bash
   docker compose restart frontend
   ```

4. **Access from mobile**: `https://192.168.1.100:8080`

## 🆘 Common Issues

### "Connection refused" errors
```bash
# Check if services are running
docker compose ps

# View logs for errors
docker compose logs backend
```

### "Invalid token" errors
```bash
# Make sure JWT_SECRET is set in .env
grep JWT_SECRET .env

# Restart backend to reload config
docker compose restart backend
```

### SSL certificate warnings
- **Normal for development** - click "Advanced" → "Proceed"
- **For production** - see [SSL Setup Guide](../deployment/ssl-setup.md)

### Upload fails with "NetworkError"
```bash
# Check if backend is accessible
curl -k https://localhost:8080/api/scripts

# Restart frontend to reload proxy config
docker compose restart frontend
```

## 🔍 Verify Installation

Run this quick health check:

```bash
# Test backend directly
curl -k https://localhost:8080/api/health

# Expected response: {"status": "healthy"}
```

## 📞 Need Help?

- **Common Issues**: [Troubleshooting Guide](../troubleshooting/README.md)
- **Mobile Problems**: [Mobile Troubleshooting](../troubleshooting/mobile.md)
- **WebSocket Issues**: [WebSocket Troubleshooting](../troubleshooting/websocket.md)
- **Community Support**: [Discord Server](https://discord.gg/your-invite)

---

**Estimated Time**: 5 minutes  
**Difficulty**: Beginner  
**Next Steps**: [First Steps Guide](first-steps.md) | [User Guide](user-guide.md) 