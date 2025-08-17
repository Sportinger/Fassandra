#!/bin/bash

echo "Testing Claude installation..."

# Test 1: Check if claude exists and is executable
echo "1. Checking Claude binary..."
if command -v claude &> /dev/null; then
    echo "✓ Claude found at: $(which claude)"
    echo "  Version: $(claude --version)"
else
    echo "✗ Claude not found in PATH"
fi

# Test 2: Check all possible locations
echo -e "\n2. Checking all Claude locations..."
for path in /usr/bin/claude /home/appuser/.npm-global/bin/claude; do
    if [ -e "$path" ]; then
        echo "✓ Found: $path"
        ls -la "$path"
    else
        echo "✗ Not found: $path"
    fi
done

# Test 3: Test simple Claude execution
echo -e "\n3. Testing Claude execution..."
echo "What is 2+2?" | timeout 5 claude --print --dangerously-skip-permissions 2>&1 | head -20

# Test 4: Check Claude settings
echo -e "\n4. Checking Claude settings..."
for path in /root/.claude/settings.json /root/.config/claude-code/settings.json /home/appuser/.config/claude-code/settings.json; do
    if [ -f "$path" ]; then
        echo "✓ Settings found at: $path"
        cat "$path" | jq -c '.permissions' 2>/dev/null || cat "$path"
    fi
done

echo -e "\nTest complete!"