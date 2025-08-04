# Hetzner Server Setup - mylayer.org

## Server Details
- **IP**: 91.99.69.115
- **OS**: Ubuntu 24.04 LTS
- **Domain**: mylayer.org
- **SSL**: Let's Encrypt (auto-renewing)

## Access
```bash
# SSH as admin (recommended)
ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115

# SSH as root (emergency only)
ssh -i ~/.ssh/id_rsa_lexema_de root@91.99.69.115
```

## Users
- **admin**: Non-root user with sudo (password: 0854)
- **root**: SSH key only, no password login

## Installed Software
- **Docker**: 28.3.3 + Docker Compose 2.39.1
- **Nginx**: 1.24.0 (reverse proxy)
- **Fail2ban**: Brute force protection
- **UFW**: Firewall (ports 22, 80, 443)

## Directory Structure
```
/home/admin/app/
├── backend/     # Backend code
├── frontend/    # Frontend code
├── data/        # Persistent data
├── logs/        # Application logs
└── nginx/       # Nginx configs
```

## Security
- ✅ SSH: Key-only authentication
- ✅ Firewall: Only SSH/HTTP/HTTPS
- ✅ Fail2ban: Auto-blocks attackers
- ✅ Updates: Automatic security patches
- ✅ SSL: HTTPS enforced

## Deployment Commands
```bash
# Deploy as admin user
cd /home/admin/app
git clone [your-repo]
docker compose up -d

# View logs
docker compose logs -f

# Restart services
docker compose restart
```

## Nginx Config
Located at: `/etc/nginx/sites-available/mylayer.org`
- HTTP → HTTPS redirect
- SSL certificates: `/etc/letsencrypt/live/mylayer.org/`
- Ready for proxy to Docker containers

## Maintenance
```bash
# Check services
systemctl status docker nginx fail2ban

# SSL renewal (automatic, but manual check)
sudo certbot renew --dry-run

# System updates
sudo apt update && sudo apt upgrade
```