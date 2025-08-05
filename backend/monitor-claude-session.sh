#!/bin/bash
# Monitor active Claude session in the container

# Function to find Claude process
find_claude_process() {
    docker exec mylayer_pessoa_backend ps aux | grep -E "claude.*--print" | grep -v grep | awk '{print $2}'
}

# Function to attach to Claude session using strace
attach_to_session() {
    local pid=$1
    echo "Attaching to Claude session (PID: $pid)"
    echo "Press Ctrl+C to detach"
    docker exec mylayer_pessoa_backend strace -p $pid -s 2000 2>&1 | grep -E "(write|read)" | grep -v "SIGCHLD"
}

# Function to tail Claude output from backend logs
tail_session_logs() {
    echo "Monitoring Claude session output from backend logs..."
    docker logs -f mylayer_pessoa_backend 2>&1 | grep -E "\[Claude\]|\[STDERR\]" --line-buffered
}

# Main logic
echo "Checking for active Claude session..."
CLAUDE_PID=$(find_claude_process)

if [ -z "$CLAUDE_PID" ]; then
    echo "No active Claude session found."
    echo "Monitoring backend logs for Claude output instead..."
    tail_session_logs
else
    echo "Found active Claude session with PID: $CLAUDE_PID"
    echo ""
    echo "Choose monitoring method:"
    echo "1) Attach to process with strace (see raw I/O)"
    echo "2) Tail backend logs (see formatted output)"
    echo "3) Both (split terminal recommended)"
    read -p "Choice [1-3]: " choice
    
    case $choice in
        1)
            attach_to_session $CLAUDE_PID
            ;;
        2)
            tail_session_logs
            ;;
        3)
            echo "Starting log tail in background..."
            tail_session_logs &
            sleep 2
            attach_to_session $CLAUDE_PID
            ;;
        *)
            echo "Invalid choice, defaulting to log tail"
            tail_session_logs
            ;;
    esac
fi