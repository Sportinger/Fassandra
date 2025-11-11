#!/bin/bash
# Simple live monitoring script for Fassandra production
# No dependencies - just docker stats

SERVER="91.99.69.115"
SERVER_USER="root"
APP_DIR="/home/admin/app"
CHECK_INTERVAL=5

echo "🔍 Fassandra Live Monitor"
echo "Server: $SERVER"
echo "Interval: ${CHECK_INTERVAL}s"
echo "Press Ctrl+C to stop"
echo ""

iteration=0
while true; do
    ((iteration++))

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Check #${iteration} - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Get Docker stats (using proper quote escaping)
    ssh ${SERVER_USER}@${SERVER} "cd ${APP_DIR} && docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}'" || {
        echo "⚠️  Failed to fetch Docker stats"
    }

    echo ""

    # Every 6th iteration (30 seconds), check for errors
    if (( iteration % 6 == 0 )); then
        echo "🔍 Recent errors (last 1 minute):"
        ssh ${SERVER_USER}@${SERVER} "cd ${APP_DIR} && docker compose -f docker-compose.prod.yml logs --since 1m backend 2>&1 | grep -i -E '(error|panic|failed|timeout)' | tail -n 3" || echo "  ✅ No errors"
        echo ""
    fi

    sleep $CHECK_INTERVAL
done
