#!/bin/bash
# Production Security Status Check
# Run this on your production server

echo "🔍 PRODUCTION SECURITY CHECK"
echo "============================"
echo ""

# 1. Firewall Status
echo "1. FIREWALL STATUS:"
echo "-------------------"
sudo ufw status verbose
echo ""

# 2. Exposed Ports
echo "2. EXPOSED PORTS (Non-localhost):"
echo "---------------------------------"
sudo ss -tuln | grep LISTEN | grep -v "127.0.0" | awk '{print $5}' | sort -u
echo ""

# 3. Docker Exposed Ports
echo "3. DOCKER EXPOSED PORTS:"
echo "------------------------"
sudo docker ps --format "table {{.Names}}\t{{.Ports}}" 2>/dev/null || echo "Docker not running"
echo ""

# 4. Failed SSH Attempts
echo "4. RECENT FAILED SSH ATTEMPTS:"
echo "-------------------------------"
sudo grep "Failed password" /var/log/auth.log | tail -5 2>/dev/null || echo "No recent failures"
echo ""

# 5. Security Summary
echo "📊 SECURITY SUMMARY:"
echo "-------------------"

# Check UFW
if sudo ufw status | grep -q "Status: active"; then
    echo "✅ Firewall: ACTIVE"
else
    echo "❌ Firewall: INACTIVE - CRITICAL!"
fi

# Check for exposed database
if sudo ss -tuln | grep -E ":5432|:3306|:27017" | grep -v "127.0.0"; then
    echo "❌ Database ports exposed - CRITICAL!"
else
    echo "✅ Database ports: Protected"
fi

# Check for exposed admin tools
if sudo ss -tuln | grep -E ":5050|:8080|:3000" | grep -v "127.0.0"; then
    echo "⚠️  Admin/Dev ports exposed - WARNING!"
else
    echo "✅ Admin ports: Protected"
fi

# Check fail2ban
if systemctl is-active fail2ban >/dev/null 2>&1; then
    echo "✅ Fail2ban: ACTIVE"
else
    echo "⚠️  Fail2ban: INACTIVE - Consider enabling"
fi

echo ""
echo "Run 'sudo ./secure-production-setup.sh' to fix any issues!"