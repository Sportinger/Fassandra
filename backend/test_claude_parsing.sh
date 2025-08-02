#!/bin/bash

# Test script for Claude Code PDF parsing without frontend
# Usage: ./test_claude_parsing.sh <pdf_path> <username>

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Claude Code PDF Parser Test Script${NC}"
echo "===================================="

# Check if ANTHROPIC_API_KEY is set
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}ERROR: ANTHROPIC_API_KEY environment variable is not set${NC}"
    echo ""
    echo "To set it temporarily for this session:"
    echo "  export ANTHROPIC_API_KEY='your-api-key-here'"
    echo ""
    echo "To set it permanently, add it to backend/.env:"
    echo "  ANTHROPIC_API_KEY=your-api-key-here"
    echo ""
    echo "Get your API key from: https://console.anthropic.com/"
    exit 1
fi

# Check arguments
if [ "$#" -ne 2 ]; then
    echo -e "${RED}Usage: $0 <pdf_path> <username>${NC}"
    echo "Example: $0 /home/admins/projects/pessoa/doc/test.pdf abc"
    exit 1
fi

PDF_PATH="$1"
USERNAME="$2"

# Check if PDF exists
if [ ! -f "$PDF_PATH" ]; then
    echo -e "${RED}ERROR: PDF file not found: $PDF_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ API Key is set${NC}"
echo -e "${GREEN}✓ PDF file exists: $PDF_PATH${NC}"
echo ""

# Test 1: Direct Claude Code CLI test
echo -e "${YELLOW}Test 1: Testing Claude Code CLI directly${NC}"
echo "----------------------------------------"

# Create a test prompt for the pdf-script-parser agent
PROMPT="Please use the pdf-script-parser agent to parse the following PDF script and insert it into the database:

PDF Path: $PDF_PATH
Username: $USERNAME

The agent should:
1. Extract the script content from the PDF
2. Parse it to identify dialogue, stage directions, and other theatrical elements  
3. Insert the parsed data into the PostgreSQL database with the specified username as the owner

Please execute this task now using the pdf-script-parser agent."

# Save prompt to a temporary file
TEMP_PROMPT=$(mktemp)
echo "$PROMPT" > "$TEMP_PROMPT"

echo "Testing Claude Code CLI..."
echo ""

# Test if claude command exists
if ! command -v claude &> /dev/null; then
    echo -e "${RED}ERROR: 'claude' command not found${NC}"
    echo "Claude Code CLI needs to be installed in the Docker container"
    echo ""
    echo "To test inside the Docker container:"
    echo "  docker exec -it dev_pessoa_backend /bin/bash"
    echo "  claude --version"
    exit 1
fi

# Run Claude Code with the prompt
echo "Running: claude -p \"<prompt>\" --output-format json --max-turns 10"
claude -p "$PROMPT" --output-format json --max-turns 10 | jq '.' || {
    echo -e "${RED}Failed to run Claude Code${NC}"
    exit 1
}

echo ""
echo -e "${GREEN}✓ Claude Code CLI test completed${NC}"

# Clean up
rm -f "$TEMP_PROMPT"

# Test 2: Test via backend API (if backend is running)
echo ""
echo -e "${YELLOW}Test 2: Testing via Backend API${NC}"
echo "-------------------------------"

# Check if backend is running
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
    
    # First, we need to login to get a token
    echo ""
    echo "Note: To test the API endpoints, you need to:"
    echo "1. Have a user account (username: $USERNAME)"
    echo "2. Get an auth token by logging in"
    echo ""
    echo "Example API call (requires auth token):"
    echo "  curl -X POST http://localhost:3000/api/s/parse-pdf/$(realpath $PDF_PATH) \\"
    echo "    -H 'Authorization: Bearer YOUR_AUTH_TOKEN'"
else
    echo -e "${YELLOW}Backend is not running on localhost:3000${NC}"
    echo ""
    echo "To test the API:"
    echo "1. Start the backend: cd backend && cargo run"
    echo "2. Or use Docker: docker-compose up"
fi

echo ""
echo -e "${GREEN}Test script completed!${NC}" 