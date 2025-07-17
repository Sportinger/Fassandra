#!/bin/bash

# Server Setup Script for Hetzner Ubuntu Server
# Run this script on your server to prepare it for Pessoa deployment

set -e

echo "🚀 Setting up Hetzner server for Pessoa deployment..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "🔧 Installing required packages..."
apt install -y curl wget git unzip software-properties-common ca-certificates gnupg lsb-release

# Install Docker
echo "🐳 Installing Docker..."
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Install Docker Compose (standalone)
echo "🔧 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create symbolic link for docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Create project directory
echo "📁 Creating project directory..."
mkdir -p /opt/pessoa
cd /opt/pessoa

# Set up firewall (optional)
echo "🔥 Configuring firewall..."
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 3001/tcp    # Backend API
ufw allow 5050/tcp    # PgAdmin
# Don't enable UFW automatically - let user decide
echo "⚠️  Firewall rules configured but not enabled. Run 'ufw enable' to activate."

# Install certbot for Let's Encrypt (optional)
echo "🔒 Installing certbot for SSL certificates..."
apt install -y certbot

# Create log directory
mkdir -p /var/log/pessoa

# Set permissions
chown -R root:root /opt/pessoa
chmod 755 /opt/pessoa

echo ""
echo "✅ Server setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Verify Docker is running: docker --version"
echo "2. Test Docker Compose: docker-compose --version"
echo "3. Run your deployment script from local machine: ./deploy_mylayer.sh"
echo ""
echo "🔧 Optional:"
echo "- Enable firewall: ufw enable"
echo "- Generate Let's Encrypt certificate: certbot certonly --standalone -d mylayer.org"
echo ""
echo "📊 System information:"
echo "- Docker version: $(docker --version)"
echo "- Docker Compose version: $(docker-compose --version)"
echo "- Available disk space: $(df -h / | awk 'NR==2 {print $4}')"
echo "- Available memory: $(free -h | awk 'NR==2 {print $7}')" 