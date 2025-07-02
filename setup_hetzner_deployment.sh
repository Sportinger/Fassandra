#!/bin/bash

# Hetzner Server Setup Script for GitHub Actions Deployment
# Run this script on your Hetzner server (mylayer.org)

echo "🚀 Setting up GitHub Actions deployment for Pessoa..."

# Create deployment directory if it doesn't exist
mkdir -p /opt/pessoa

# Go to deployment directory
cd /opt/pessoa

# Download deployment files from GitHub
echo "📁 Downloading deployment files..."

# Download docker-compose file
curl -s "https://raw.githubusercontent.com/Sportinger/pessoa/dev/docker-compose.hetzner-github-actions.yml" -o docker-compose.hetzner-github-actions.yml

# Download environment template
curl -s "https://raw.githubusercontent.com/Sportinger/pessoa/dev/env.hetzner-github-actions.template" -o .env

echo "✅ Deployment files downloaded!"

# Create backup of current setup
if [ -f "docker-compose.yml" ]; then
    echo "📋 Creating backup of current docker-compose.yml..."
    cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)
fi

echo "🔧 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit /opt/pessoa/.env to match your configuration"
echo "2. Stop current containers: docker-compose down"
echo "3. Wait for GitHub Actions to build and push images"
echo "4. Start new containers: docker-compose -f docker-compose.hetzner-github-actions.yml up -d"
echo ""
echo "🌐 Your site will continue to work at: https://mylayer.org:8443" 