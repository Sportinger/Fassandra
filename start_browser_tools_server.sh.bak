#!/bin/bash

# Browser Tools Server Startup Script
# This script starts the browser tools server that the MCP server depends on

echo "🚀 Starting Browser Tools Server..."

# Kill any existing server on port 3025
lsof -ti:3025 | xargs kill -9 2>/dev/null || true

# Start the browser tools server in the background
npx @agentdeskai/browser-tools-server > browser_tools_server.log 2>&1 &

# Store the PID for later cleanup
echo $! > browser_tools_server.pid

# Wait a moment for the server to start
sleep 3

# Check if server is running
if curl -s http://localhost:3025 > /dev/null 2>&1; then
    echo "✅ Browser Tools Server started successfully on port 3025"
    echo "📋 Server logs: browser_tools_server.log"
    echo "🔧 PID file: browser_tools_server.pid"
else
    echo "❌ Failed to start Browser Tools Server"
    exit 1
fi

echo "🎯 Browser Tools MCP server can now connect successfully"
echo "💡 To stop the server: kill \$(cat browser_tools_server.pid)" 