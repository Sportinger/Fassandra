#!/bin/bash
# PRODUCTION SERVER SECURITY SETUP SCRIPT
# Run this on your production server at 91.99.69.115

set -e

echo "🔒 PRODUCTION SERVER SECURITY HARDENING"
echo "======================================="

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
   echo "Please run with sudo: sudo ./secure-production-setup.sh"
   exit 1
fi

echo "1. Installing security tools..."
apt-get update
apt-get install -y ufw fail2ban unattended-upgrades

echo "2. Configuring UFW firewall..."
# Reset UFW to defaults
ufw --force reset

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (restrict to your IP if possible)
echo "Allowing SSH on port 22..."
ufw allow 22/tcp comment 'SSH'

# Allow HTTP and HTTPS for web traffic
echo "Allowing HTTP and HTTPS..."
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Enable UFW
echo "Enabling firewall..."
ufw --force enable

echo "3. Configuring fail2ban..."
# Create jail.local for SSH protection
cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF

# Restart fail2ban
systemctl restart fail2ban
systemctl enable fail2ban

echo "4. Setting up automatic security updates..."
# Configure unattended-upgrades
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

# Enable automatic updates
echo 'APT::Periodic::Update-Package-Lists "1";' > /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Download-Upgradeable-Packages "1";' >> /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::AutocleanInterval "7";' >> /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Unattended-Upgrade "1";' >> /etc/apt/apt.conf.d/20auto-upgrades

echo "5. Checking current listening ports..."
echo "Current services listening on all interfaces:"
ss -tuln | grep -E "0\.0\.0\.0|::" | grep -v "127.0.0"

echo "6. Docker security check..."
# Check if docker is exposing services incorrectly
if command -v docker &> /dev/null; then
    echo "Docker containers with exposed ports:"
    docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -E "0\.0\.0\.0|::"
fi

echo ""
echo "✅ SECURITY SETUP COMPLETE!"
echo ""
echo "Current firewall status:"
ufw status verbose

echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Change root password: passwd root"
echo "2. Disable root SSH login: edit /etc/ssh/sshd_config"
echo "   Set: PermitRootLogin no"
echo "3. Restart SSH: systemctl restart sshd"
echo "4. Update docker-compose.prod.yml to remove pgadmin"
echo "5. Redeploy with: docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "🔒 To access PgAdmin safely, use SSH tunnel:"
echo "   ssh -L 5050:localhost:5050 admin@91.99.69.115"