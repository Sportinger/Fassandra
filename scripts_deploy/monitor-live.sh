#!/bin/bash
# Live monitoring script for Fassandra production
# Monitors Docker containers, backend metrics, and logs performance issues

set -e

SERVER="91.99.69.115"
SERVER_USER="root"
APP_DIR="/home/admin/app"
LOG_FILE="/tmp/fassandra-monitor.log"
ALERT_THRESHOLD_CPU=80  # Alert if CPU > 80%
ALERT_THRESHOLD_MEM=80  # Alert if Memory > 80%
CHECK_INTERVAL=5  # Check every 5 seconds

echo "Starting Fassandra Live Monitor..."
echo "Logging to: $LOG_FILE"
echo "Monitoring server: $SERVER"
echo ""

# Function to format timestamp
timestamp() {
    date "+%Y-%m-%d %H:%M:%S"
}

# Function to check Docker container stats
check_docker_stats() {
    ssh ${SERVER_USER}@${SERVER} "cd ${APP_DIR} && docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}'"
}

# Function to check backend metrics
check_backend_metrics() {
    # Fetch Prometheus metrics from backend
    ssh ${SERVER_USER}@${SERVER} "curl -s http://localhost:3000/metrics" | grep -E "^(http_requests_total|http_request_duration|memory_usage|active_connections)" || true
}

# Function to analyze and detect issues
analyze_performance() {
    local stats="$1"

    # Parse CPU and memory usage
    while IFS= read -r line; do
        if [[ $line =~ backend.*([0-9]+\.[0-9]+)%.*([0-9]+\.[0-9]+)% ]]; then
            cpu="${BASH_REMATCH[1]%.*}"  # Remove decimals
            mem="${BASH_REMATCH[2]%.*}"

            if (( $(echo "$cpu > $ALERT_THRESHOLD_CPU" | bc -l) )); then
                echo "⚠️  [$(timestamp)] ALERT: Backend CPU usage high: ${cpu}%" | tee -a "$LOG_FILE"
            fi

            if (( $(echo "$mem > $ALERT_THRESHOLD_MEM" | bc -l) )); then
                echo "⚠️  [$(timestamp)] ALERT: Backend Memory usage high: ${mem}%" | tee -a "$LOG_FILE"
            fi
        fi

        if [[ $line =~ frontend.*([0-9]+\.[0-9]+)%.*([0-9]+\.[0-9]+)% ]]; then
            cpu="${BASH_REMATCH[1]%.*}"
            mem="${BASH_REMATCH[2]%.*}"

            if (( $(echo "$cpu > $ALERT_THRESHOLD_CPU" | bc -l) )); then
                echo "⚠️  [$(timestamp)] ALERT: Frontend CPU usage high: ${cpu}%" | tee -a "$LOG_FILE"
            fi

            if (( $(echo "$mem > $ALERT_THRESHOLD_MEM" | bc -l) )); then
                echo "⚠️  [$(timestamp)] ALERT: Frontend Memory usage high: ${mem}%" | tee -a "$LOG_FILE"
            fi
        fi
    done <<< "$stats"
}

# Function to check for error patterns in logs
check_error_logs() {
    echo ""
    echo "🔍 Checking for errors in last minute..."
    ssh ${SERVER_USER}@${SERVER} "cd ${APP_DIR} && docker compose -f docker-compose.prod.yml logs --since 1m backend 2>&1 | grep -i -E '(error|panic|failed|timeout|deadlock)' | tail -n 5" || true
}

# Main monitoring loop
echo "Starting continuous monitoring (Ctrl+C to stop)..."
echo ""

iteration=0
while true; do
    ((iteration++))

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 [$(timestamp)] Check #${iteration}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Get Docker stats
    stats=$(check_docker_stats)
    echo "$stats"
    echo ""

    # Analyze for issues
    analyze_performance "$stats"

    # Every 6th iteration (30 seconds), check backend metrics and logs
    if (( iteration % 6 == 0 )); then
        echo ""
        echo "📈 Backend Metrics:"
        check_backend_metrics
        check_error_logs
    fi

    echo ""
    sleep $CHECK_INTERVAL
done
