#!/bin/bash

# Browser Tools Server Stop Script
# This script stops the browser tools server gracefully

echo "🛑 Stopping Browser Tools Server..."

# Check if PID file exists
if [ -f "browser_tools_server.pid" ]; then
    PID=$(cat browser_tools_server.pid)
    
    # Check if process is running
    if kill -0 $PID 2>/dev/null; then
        echo "🔄 Stopping process $PID..."
        kill $PID
        
        # Wait for graceful shutdown
        sleep 2
        
        # Force kill if still running
        if kill -0 $PID 2>/dev/null; then
            echo "⚡ Force killing process $PID..."
            kill -9 $PID
        fi
        
        echo "✅ Browser Tools Server stopped successfully"
    else
        echo "⚠️ Process $PID is not running"
    fi
    
    # Clean up PID file
    rm -f browser_tools_server.pid
else
    echo "⚠️ PID file not found, trying to kill by port..."
    lsof -ti:3025 | xargs kill -9 2>/dev/null || true
fi

# Clean up log file
rm -f browser_tools_server.log

echo "�� Cleanup completed" 