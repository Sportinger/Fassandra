#!/bin/bash
set -e

echo "=== Claude Code Headless Test ==="
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    export ANTHROPIC_API_KEY=$(grep "^ANTHROPIC_API_KEY=" .env | cut -d'=' -f2-)
fi

echo -e "${GREEN}API key length: ${#ANTHROPIC_API_KEY}${NC}"
echo

# Test 1: Simple non-interactive test
echo -e "${BLUE}Test 1: Simple headless test${NC}"
echo "Command: claude -p 'Say hello' --no-interactive"
docker exec -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" dev_pessoa_backend \
    claude -p "Say hello" --no-interactive 2>&1 || echo "Exit code: $?"
echo

# Test 2: With max turns set to 1
echo -e "${BLUE}Test 2: Single turn test${NC}"
echo "Command: claude -p 'What is 2+2?' --max-turns 1"
docker exec -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" dev_pessoa_backend \
    claude -p "What is 2+2?" --max-turns 1 2>&1 || echo "Exit code: $?"
echo

# Test 3: Generate SQL output (what our service needs)
echo -e "${BLUE}Test 3: SQL generation test${NC}"
cat > /tmp/sql_prompt.txt << 'EOF'
Generate PostgreSQL SQL to insert a script titled "Test Script" for user with email "abc@example.com".
Output ONLY SQL statements starting with BEGIN and ending with COMMIT.
No explanations, no markdown.
EOF

echo "Prompt: Generate SQL..."
docker exec -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" dev_pessoa_backend \
    claude -p "$(cat /tmp/sql_prompt.txt)" --no-interactive --max-turns 1 2>&1 | head -50
echo

# Test 4: Check Claude Code version and help
echo -e "${BLUE}Test 4: Claude Code version and help${NC}"
docker exec dev_pessoa_backend claude --version 2>&1 || true
echo
docker exec dev_pessoa_backend claude --help 2>&1 | head -20
echo

# Test 5: Test with explicit headless/batch mode flags
echo -e "${BLUE}Test 5: Testing batch/headless mode flags${NC}"
echo "Looking for headless/batch mode options..."
docker exec dev_pessoa_backend claude --help 2>&1 | grep -E "(batch|headless|non-interactive|quiet)" || echo "No headless flags found"

rm -f /tmp/sql_prompt.txt 