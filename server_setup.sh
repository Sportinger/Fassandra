#!/bin/bash

# Server setup script for Lexema
# This script sets up a fresh Ubuntu server with all necessary components

set -e  # Exit on error

echo "=== Starting Lexema Server Setup ==="

# 1. Update system packages
echo "Updating system packages..."
apt update && apt upgrade -y

# 2. Create non-root user
echo "Creating user 'lexema'..."
if ! id -u lexema >/dev/null 2>&1; then
    useradd -m -s /bin/bash lexema
    usermod -aG sudo lexema
    
    # Copy SSH keys to new user
    mkdir -p /home/lexema/.ssh
    cp /root/.ssh/authorized_keys /home/lexema/.ssh/
    chown -R lexema:lexema /home/lexema/.ssh
    chmod 700 /home/lexema/.ssh
    chmod 600 /home/lexema/.ssh/authorized_keys
    
    # Allow sudo without password for lexema user
    echo "lexema ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/lexema
    
    echo "User 'lexema' created successfully"
else
    echo "User 'lexema' already exists"
fi

# 3. Configure firewall
echo "Configuring firewall..."
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 4. Install Docker and Docker Compose
echo "Installing Docker..."
apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add lexema user to docker group
usermod -aG docker lexema

# 5. Install nginx
echo "Installing nginx..."
apt install -y nginx

# 6. Install fail2ban
echo "Installing fail2ban..."
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# 7. Configure automatic security updates
echo "Configuring automatic security updates..."
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# 8. Create swap file (2GB)
echo "Creating swap file..."
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
    echo "Swap file created"
else
    echo "Swap file already exists"
fi

# 9. Install certbot for Let's Encrypt
echo "Installing certbot..."
apt install -y certbot python3-certbot-nginx

# 10. Install additional useful tools
echo "Installing additional tools..."
apt install -y htop git wget curl vim net-tools

# 11. Secure SSH
echo "Securing SSH..."
sed -i 's/#PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# 12. Create project directories
echo "Creating project directories..."
mkdir -p /home/lexema/app/{backend,frontend,data,logs}
chown -R lexema:lexema /home/lexema/app

echo "=== Server Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. You can now SSH as: ssh lexema@91.99.69.115"
echo "2. Docker and Docker Compose are installed"
echo "3. Nginx is installed and ready for configuration"
echo "4. Firewall is configured with ports 22, 80, and 443 open"
echo "5. Project directories created at /home/lexema/app/"
echo ""
echo "Security notes:"
echo "- Root login is disabled (SSH key only)"
echo "- Password authentication is disabled"
echo "- Fail2ban is active"
echo "- Automatic security updates are enabled"