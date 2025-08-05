#!/bin/bash
# Monitor Claude session on remote server

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Claude Session Monitor${NC}"
echo "========================"

# Default to monitoring latest session
SESSION_TYPE=${1:-latest}

if [ "$SESSION_TYPE" = "latest" ]; then
    echo -e "${YELLOW}Monitoring latest Claude session...${NC}"
    ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115 'docker exec mylayer_pessoa_backend tail -f /tmp/claude-sessions/latest.log 2>/dev/null || docker logs -f mylayer_pessoa_backend 2>&1 | grep -E "\[Claude\]|\[STDERR\]" --line-buffered'
elif [ "$SESSION_TYPE" = "logs" ]; then
    echo -e "${YELLOW}Monitoring Claude output from backend logs...${NC}"
    ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115 'docker logs -f mylayer_pessoa_backend 2>&1 | grep -E "\[Claude\]|\[STDERR\]" --line-buffered'
elif [ "$SESSION_TYPE" = "active" ]; then
    echo -e "${YELLOW}Looking for active Claude process...${NC}"
    ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115 'docker exec mylayer_pessoa_backend ps aux | grep -E "claude.*--print" | grep -v grep'
else
    # Assume it's a specific session ID
    echo -e "${YELLOW}Monitoring Claude session: $SESSION_TYPE${NC}"
    ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115 "docker exec mylayer_pessoa_backend tail -f /tmp/claude-sessions/session_${SESSION_TYPE}.log"
fi

echo -e "\n${RED}Press Ctrl+C to stop monitoring${NC}"