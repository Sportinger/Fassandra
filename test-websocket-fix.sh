#!/bin/bash

echo "WebSocket Connection Test Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test WebSocket connection
test_websocket() {
    local url=$1
    local description=$2
    
    echo -e "\n${YELLOW}Testing: ${description}${NC}"
    echo "URL: ${url}"
    
    # Check if wscat is installed
    if ! command -v wscat &> /dev/null; then
        echo -e "${RED}wscat is not installed. Installing...${NC}"
        npm install -g wscat
    fi
    
    # Test connection with timeout
    echo "Attempting connection..."
    timeout 5s wscat -c "${url}" &
    local pid=$!
    
    sleep 3
    
    if ps -p $pid > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Connection established successfully${NC}"
        kill $pid 2>/dev/null
        return 0
    else
        echo -e "${RED}✗ Connection failed${NC}"
        return 1
    fi
}

# Main tests
echo -e "\n${YELLOW}1. Testing direct backend connection${NC}"
test_websocket "ws://localhost:3001/api/collab" "Direct backend WebSocket"

echo -e "\n${YELLOW}2. Testing through nginx proxy (if domain is configured)${NC}"
echo "Note: Replace 'yourdomain.com' with your actual domain"
# test_websocket "wss://yourdomain.com/api/collab" "Nginx proxied WebSocket"

echo -e "\n${YELLOW}3. Checking nginx error logs${NC}"
echo "Recent nginx errors:"
sudo tail -n 20 /var/log/nginx/error.log | grep -i "websocket\|upstream\|proxy" || echo "No recent WebSocket-related errors found"

echo -e "\n${YELLOW}4. Testing with curl for upgrade headers${NC}"
echo "Testing WebSocket upgrade request:"
curl -i -N \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    http://localhost:3001/api/collab

echo -e "\n${YELLOW}5. Memory usage check${NC}"
echo "Current memory usage:"
free -h

echo -e "\n${YELLOW}Done!${NC}"
echo "If connections are failing, check:"
echo "1. Backend is running: docker ps | grep backend"
echo "2. Nginx config is valid: sudo nginx -t"
echo "3. Enable debug logging in nginx (uncomment the error_log line in location /api)"