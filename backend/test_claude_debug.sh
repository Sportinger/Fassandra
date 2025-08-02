#!/bin/bash
set -e

echo "=== Claude Code Debug Test Script ==="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if API key is set
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}Error: ANTHROPIC_API_KEY not set${NC}"
    echo "Please set: export ANTHROPIC_API_KEY=your_key"
    exit 1
fi

echo -e "${GREEN}✓ API key is set (length: ${#ANTHROPIC_API_KEY})${NC}"
echo

# Function to test Claude Code
test_claude() {
    local test_name="$1"
    local command="$2"
    
    echo -e "${BLUE}Test: $test_name${NC}"
    echo "Command: $command"
    echo "---"
    
    if eval "$command"; then
        echo -e "${GREEN}✓ Success${NC}"
    else
        echo -e "${RED}✗ Failed${NC}"
    fi
    echo
}

# Test 1: Basic Claude Code test
test_claude "Basic Claude Code Test" \
    "docker exec -e ANTHROPIC_API_KEY=\"$ANTHROPIC_API_KEY\" dev_pessoa_backend claude -p 'Say hello' --output-format json 2>&1 | jq -C . || echo 'Raw output'"

# Test 2: Verbose mode test
test_claude "Verbose Mode Test" \
    "docker exec -e ANTHROPIC_API_KEY=\"$ANTHROPIC_API_KEY\" dev_pessoa_backend claude -p 'Say hello' --verbose --output-format json 2>&1 | head -100"

# Test 3: Test with debug environment variable
test_claude "With Debug Environment Variable" \
    "docker exec -e ANTHROPIC_API_KEY=\"$ANTHROPIC_API_KEY\" -e CLAUDE_CODE_DEBUG=true -e RUST_LOG=debug dev_pessoa_backend claude -p 'What is 2+2?' --output-format json 2>&1 | head -50"

# Test 4: List available agents
echo -e "${BLUE}Test: List Available Agents${NC}"
echo "Checking if pdf-script-parser agent exists..."
docker exec -e ANTHROPIC_API_KEY=\"$ANTHROPIC_API_KEY\" dev_pessoa_backend claude agents list 2>&1 || echo "No agents command available"
echo

# Test 5: Simple PDF test (if test.pdf exists)
if docker exec dev_pessoa_backend test -f /app/test.pdf; then
    echo -e "${BLUE}Test: PDF Processing Simulation${NC}"
    echo "Testing with actual prompt format..."
    
    cat > /tmp/test_prompt.txt << 'EOF'
Please use the pdf-script-parser agent to parse the following PDF script and insert it into the database:

PDF Path: /app/test.pdf
Username: testuser

The agent should:
1. Extract the script content from the PDF
2. Parse it to identify dialogue, stage directions, and other theatrical elements  
3. Insert the parsed data into the PostgreSQL database with the specified username as the owner

Please execute this task now using the pdf-script-parser agent.
EOF

    docker exec -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" dev_pessoa_backend bash -c "claude -p '$(cat /tmp/test_prompt.txt)' --output-format json --verbose 2>&1" | head -100
else
    echo -e "${YELLOW}Skipping PDF test - no test.pdf found${NC}"
fi

echo
echo -e "${GREEN}=== Debug test complete ===${NC}"
echo
echo "To enable full debugging in the backend service, set these environment variables:"
echo "  CLAUDE_CODE_DEBUG=true"
echo "  RUST_LOG=debug,backend=trace" 