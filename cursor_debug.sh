#!/bin/bash

echo "=== Cursor Debug Script ==="
echo "Date: $(date)"
echo ""

echo "=== System Info ==="
echo "OS: $(uname -a)"
echo "User: $(whoami)"
echo ""

echo "=== Cursor Installation ==="
which cursor
echo "Cursor version:"
cursor --version
echo ""

echo "=== Running Processes ==="
pgrep -fl cursor
echo ""

echo "=== AppImage Location ==="
ls -la /tmp/.mount_Cursor*/ 2>/dev/null || echo "No AppImage mount found"
echo ""

echo "=== Cursor Config ==="
ls -la ~/.cursor/ 2>/dev/null || echo "No .cursor directory found"
echo ""

echo "=== Recent Logs ==="
journalctl --user --since "1 hour ago" | grep -i cursor | head -10 || echo "No recent logs found"
echo ""

echo "=== Disk Space ==="
df -h /tmp
df -h /home
echo ""

echo "=== Memory Usage ==="
free -h
echo ""

echo "=== Network Connectivity ==="
ping -c 1 google.com > /dev/null 2>&1 && echo "Internet: OK" || echo "Internet: FAILED"
echo ""

echo "=== AppImage Permissions ==="
ls -la ~/Downloads/cursor*.AppImage 2>/dev/null || echo "No AppImage found in Downloads"
echo ""

echo "=== End Debug Script ==="