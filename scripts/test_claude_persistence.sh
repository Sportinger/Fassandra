#!/bin/bash
# Script to test Claude Code persistence in Docker

echo "Testing Claude Code persistence..."

# Check if containers are running
if ! docker-compose ps | grep -q "pessoa_backend.*Up"; then
    echo "Backend container is not running. Please start it with: docker-compose up -d"
    exit 1
fi

echo "1. Creating test agent in Claude Code..."
docker-compose exec backend bash -c '
    cd /app
    # Create a test agent configuration
    mkdir -p /home/appuser/.claude/agents
    cat > /home/appuser/.claude/agents/test-persistence-agent.json << EOF
{
    "name": "test-persistence-agent",
    "type": "test",
    "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "capabilities": ["persistence-test"]
}
EOF
    echo "Test agent created at: /home/appuser/.claude/agents/test-persistence-agent.json"
    ls -la /home/appuser/.claude/agents/
'

echo -e "\n2. Checking volume mount..."
docker volume inspect dev_claude_config

echo -e "\n3. Restarting container to test persistence..."
docker-compose restart backend

# Wait for container to be ready
echo "Waiting for container to restart..."
sleep 10

echo -e "\n4. Checking if agent persisted after restart..."
docker-compose exec backend bash -c '
    if [ -f /home/appuser/.claude/agents/test-persistence-agent.json ]; then
        echo "✓ SUCCESS: Agent configuration persisted!"
        cat /home/appuser/.claude/agents/test-persistence-agent.json
    else
        echo "✗ FAILED: Agent configuration was lost!"
        ls -la /home/appuser/.claude/
    fi
'

echo -e "\n5. Checking Claude configuration..."
docker-compose exec backend bash -c '
    echo "Claude config files:"
    ls -la /home/appuser/.claude* 2>/dev/null || echo "No .claude files found"
    echo -e "\nChecking .claude.json content:"
    cat /home/appuser/.claude.json 2>/dev/null || echo "No .claude.json found"
'