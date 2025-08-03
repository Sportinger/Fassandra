#!/bin/bash
echo "=== Monitoring Claude Code Sessions ==="
echo "Watching for upload requests and Claude Code activity..."
echo ""

# Monitor backend logs for upload and session activity
docker logs -f dev_pessoa_backend 2>&1 | grep -E --line-buffered "(upload-pdf|claude|Claude|session|Returning upload response|start_session|pdf_path)" &

# Also check for Claude Code processes periodically
while true; do
    sleep 5
    if docker exec dev_pessoa_backend pgrep -f "claude" > /dev/null 2>&1; then
        echo "[MONITOR] Claude Code process detected!"
        docker exec dev_pessoa_backend ps aux | grep claude
    fi
done