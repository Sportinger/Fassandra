# ☁️ Hetzner Cloud Deployment Guide

Deploy Pessoa on Hetzner Cloud with automated scripts and best practices for production-ready theater collaboration.

## 🎯 Why Hetzner Cloud?

- **💰 Cost-effective** - Starting at €4/month for development
- **🇪🇺 European** - GDPR-compliant data centers
- **⚡ Fast deployment** - 10 minutes from zero to production
- **🔧 Simple management** - Straightforward server management
- **📊 Excellent performance** - SSD storage and powerful CPUs

## 📋 Prerequisites

### Required Tools
- **SSH client** (built into Linux/macOS, use PuTTY on Windows)
- **Domain name** (optional but recommended)
- **Hetzner Cloud account** ([Register here](https://www.hetzner.com/cloud))

### Local Setup
```bash
# Clone Pessoa repository
git clone https://github.com/your-org/pessoa.git
cd pessoa

# Ensure deployment script is executable
chmod +x deploy_hetzner.sh
```

## 🚀 Step 1: Create Hetzner Server

### 1.1 Create Server via Web Console

1. **Login to Hetzner Cloud Console**
2. **Create new project** (e.g., "Pessoa Production")
3. **Add server** with these specifications:

| Setting | Recommended Value | Notes |
|---------|-------------------|-------|
| **Location** | Nuremberg (EU) | Closest to Europe |
| **Image** | Ubuntu 22.04 LTS | Stable and supported |
| **Type** | CPX21 (2 vCPU, 4GB RAM) | Minimum for production |
| **Volume** | 40GB SSD | Sufficient for logs and data |
| **Networking** | Public IPv4 | Required for web access |

### 1.2 Server Configuration

4. **Add SSH Key** (create if you don't have one):
   ```bash
   # Generate SSH key pair
   ssh-keygen -t ed25519 -f ~/.ssh/hetzner_pessoa -C "pessoa-deployment"
   
   # Copy public key to clipboard
   cat ~/.ssh/hetzner_pessoa.pub
   ```

5. **Set server name**: `pessoa-production`
6. **Click "Create & Buy Now"**

### 1.3 DNS Configuration (Optional)

If you have a domain name:
1. **Point your domain** to the server IP address
2. **Create A record**: `your-domain.com` → `your-server-ip`
3. **Wait for DNS propagation** (5-30 minutes)

## 🔧 Step 2: Configure Environment Variables

### 2.1 Generate Secure Secrets

```bash
# Generate secure database password
openssl rand -base64 32

# Generate secure JWT secret  
openssl rand -hex 32

# Example output:
# Database password: K8mN9pQ2rT5uW8xZ1aB4cD7fG0hJ3kL6
# JWT secret: 7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9g0h
```

### 2.2 Production Environment Variables

The deployment script will prompt you for these values:

```bash
# Required Production Variables
HETZNER_SERVER_IP=your.server.ip.address
HETZNER_SSH_USER=root
DOMAIN_NAME=your-domain.com                    # Optional
POSTGRES_PASSWORD=your_secure_db_password
JWT_SECRET=your_long_jwt_secret_32_chars_plus
GEMINI_API_KEY=your_gemini_api_key
```

### 2.3 Get Gemini API Key

1. **Visit [Google AI Studio](https://makersuite.google.com/app/apikey)**
2. **Sign in** with your Google account
3. **Create API Key**
4. **Copy the key** for use in deployment

## 🐳 Step 3: Deploy Pessoa

### 3.1 Basic Deployment

```bash
# Run the deployment script
./deploy_hetzner.sh

# The script will:
# 1. Ask for server details
# 2. Set up Docker on the server
# 3. Configure SSL certificates
# 4. Deploy Pessoa with production settings
# 5. Run health checks
```

### 3.2 Advanced Deployment Options

```bash
# Deploy specific components
./deploy_hetzner.sh frontend    # Frontend only
./deploy_hetzner.sh backend     # Backend only
./deploy_hetzner.sh all         # Full deployment (default)

# Advanced options
./deploy_hetzner.sh --no-cache      # Force rebuild without cache
./deploy_hetzner.sh --reset-db      # Reset database (DESTROYS DATA!)
./deploy_hetzner.sh --clean         # Clean up old containers
./deploy_hetzner.sh --deploy-only   # Skip build, deploy only
```

### 3.3 Deployment Process

The script will perform these steps:

1. **🔗 Connect to server** via SSH
2. **📦 Install dependencies** (Docker, Docker Compose)
3. **🔧 Configure environment** with your variables
4. **🔒 Generate SSL certificates** (Let's Encrypt)
5. **🏗️ Build and deploy** Pessoa containers
6. **⚡ Start services** (database, backend, frontend)
7. **✅ Run health checks** and verify deployment

## 🔒 Step 4: SSL Certificate Setup

### 4.1 Let's Encrypt (Recommended)

If you have a domain name:

```bash
# SSH to your server
ssh root@your-server-ip

# Generate Let's Encrypt certificate
certbot certonly --standalone -d your-domain.com

# The deployment script will automatically configure these
```

### 4.2 Self-Signed Certificates

For IP-only access:

```bash
# The deployment script automatically generates self-signed certificates
# Users will see a security warning but can proceed safely
```

## 🌐 Step 5: Access Your Deployment

### 5.1 Web Access

- **With domain**: `https://your-domain.com`
- **With IP**: `https://your-server-ip:8443`
- **Admin panel**: `http://your-server-ip:5050` (pgAdmin)

### 5.2 Default Login

- **Email**: `admin@pessoa.de`
- **Password**: `PassoaDevteam`

**🚨 Important**: Change the default password immediately in production!

## 📊 Step 6: Verify Deployment

### 6.1 Health Checks

```bash
# Check if services are running
curl -k https://your-domain.com/api/health

# Expected response:
# {"status": "healthy", "timestamp": "2025-01-29T10:00:00Z"}
```

### 6.2 Service Status

```bash
# SSH to server and check containers
ssh root@your-server-ip
docker ps

# Expected output:
# CONTAINER ID   IMAGE             STATUS
# abcd1234       pessoa_frontend   Up 2 minutes
# efgh5678       pessoa_backend    Up 2 minutes  
# ijkl9012       postgres:15       Up 2 minutes
```

### 6.3 Log Monitoring

```bash
# View application logs
docker logs -f pessoa_backend

# View all service logs
docker-compose logs -f
```

## 🔧 Step 7: Post-Deployment Configuration

### 7.1 Database Backup

```bash
# Set up automated backups
crontab -e

# Add this line for daily backups at 2 AM:
0 2 * * * /usr/local/bin/backup_pessoa_db.sh
```

### 7.2 Monitoring Setup

```bash
# Install monitoring tools
apt update
apt install -y htop iotop

# Monitor resource usage
htop
```

### 7.3 Firewall Configuration

```bash
# Configure UFW firewall
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 5050/tcp    # pgAdmin (optional)
ufw enable
```

## 🔄 Step 8: Update and Maintenance

### 8.1 Update Pessoa

```bash
# Update to latest version
./deploy_hetzner.sh --update

# Update specific component
./deploy_hetzner.sh frontend --update
```

### 8.2 Backup Before Updates

```bash
# Backup database
docker exec pessoa_db pg_dump -U pessoa_user pessoa_db > backup.sql

# Backup environment
cp .env .env.backup
```

### 8.3 Rollback if Needed

```bash
# Rollback to previous version
./deploy_hetzner.sh --rollback

# Restore database if needed
docker exec -i pessoa_db psql -U pessoa_user -d pessoa_db < backup.sql
```

## 💰 Cost Optimization

### Server Sizing

| Usage | Server Type | Monthly Cost | Specs |
|-------|-------------|--------------|-------|
| **Development** | CPX11 | €4.15 | 1 vCPU, 2GB RAM |
| **Small Production** | CPX21 | €8.21 | 2 vCPU, 4GB RAM |
| **Medium Production** | CPX31 | €16.25 | 4 vCPU, 8GB RAM |
| **Large Production** | CPX41 | €32.45 | 8 vCPU, 16GB RAM |

### Cost Saving Tips

1. **Use snapshot backups** instead of continuous backups
2. **Scale down during off-hours** if usage is predictable
3. **Use floating IPs** for easy server replacement
4. **Monitor resource usage** to avoid over-provisioning

## 🚨 Troubleshooting

### Common Issues

#### "Connection refused" errors
```bash
# Check if services are running
docker ps

# Restart services
docker-compose restart

# Check logs
docker-compose logs backend
```

#### SSL certificate issues
```bash
# Renew Let's Encrypt certificate
certbot renew

# Check certificate status
certbot certificates
```

#### High memory usage
```bash
# Check memory usage
free -h

# Restart services to clear memory
docker-compose restart
```

#### Database connection issues
```bash
# Check database logs
docker logs pessoa_db

# Verify database is accessible
docker exec pessoa_db psql -U pessoa_user -d pessoa_db -c "SELECT 1;"
```

## 📞 Support

### Documentation
- **[Troubleshooting Guide](../troubleshooting/README.md)** - Common issues
- **[Security Guide](../security/README.md)** - Security best practices
- **[Monitoring Guide](monitoring.md)** - Set up monitoring

### Community
- **[Discord Server](https://discord.gg/your-invite)** - Community support
- **[GitHub Issues](https://github.com/your-org/pessoa/issues)** - Bug reports

## 🎯 Next Steps

1. **[Set up monitoring](monitoring.md)** - Monitor your deployment
2. **[Configure backups](database-maintenance.md)** - Protect your data
3. **[Set up SSL](ssl-setup.md)** - Secure your installation
4. **[User management](../getting-started/user-guide.md)** - Add users and configure access

---

**Estimated Deployment Time**: 10-15 minutes  
**Monthly Cost**: €8-32 (depending on server size)  
**Difficulty**: ⭐⭐⭐ Advanced  
**Status**: ✅ Production Ready 