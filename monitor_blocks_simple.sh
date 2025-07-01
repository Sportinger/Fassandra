#!/bin/bash

# Simple real-time database monitor for blocks table
# Optimized for Cursor terminal - NO FLASHING VERSION

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Database connection details
if [ ! -f ".env" ]; then
    echo "Error: .env file not found!"
    exit 1
fi

# Load environment variables
set -o allexport
source .env
set +o allexport

# Database connection string
DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="$POSTGRES_DB"
DB_USER="$POSTGRES_USER"
DB_PASS="$POSTGRES_PASSWORD"

# Connection string for psql
PGPASSWORD="$DB_PASS"
export PGPASSWORD

# Function to get current max timestamp
get_max_timestamp() {
    local result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COALESCE(MAX(created_at), '1970-01-01'::timestamp) FROM blocks;" 2>/dev/null | sed 's/^[ \t]*//; s/[ \t]*$//')
    if [[ -z "$result" || "$result" == "" ]]; then
        echo "1970-01-01 00:00:00+00"
    else
        echo "$result"
    fi
}

# Function to get current blocks count
get_blocks_count() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM blocks;" 2>/dev/null | tr -d ' '
}

# Function to get recent blocks (simplified)
get_recent_blocks() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            LEFT(id::text, 8) || '...' as id,
            LEFT(script_id::text, 8) as script,
            block_type,
            LEFT(COALESCE(content, ''), 30) as content,
            TO_CHAR(created_at, 'HH24:MI:SS') as time,
            block_order as ord
        FROM blocks 
        ORDER BY created_at DESC 
        LIMIT 5;
    " 2>/dev/null
}

# Function to get new blocks since last check
get_new_blocks() {
    local last_timestamp="$1"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT 
            LEFT(id::text, 8) || '... | ' ||
            LEFT(script_id::text, 8) || ' | ' ||
            block_type || ' | ' ||
            'Order:' || COALESCE(block_order::text, 'null') || ' | ' ||
            LEFT(COALESCE(content, ''), 40)
        FROM blocks 
        WHERE created_at > '$last_timestamp'::timestamp 
        ORDER BY created_at ASC;
    " 2>/dev/null
}

# Function to test database connection
test_connection() {
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        return 0
    else
        echo -e "${RED}Database connection failed${NC}"
        return 1
    fi
}

# Function to display full status
display_full_status() {
    local changes_log="$1"
    local blocks_count=$(get_blocks_count)
    
    clear
    echo "========================================"
    echo "  BLOCKS MONITOR | $(date '+%H:%M:%S')"
    echo "========================================"
    echo "Database: $DB_NAME | Total Blocks: $blocks_count"
    echo ""
    
    echo "RECENT BLOCKS:"
    echo "----------------------------------------"
    get_recent_blocks
    echo "----------------------------------------"
    echo ""
    
    echo "REAL-TIME CHANGES:"
    echo "----------------------------------------"
    if [[ -n "$changes_log" ]]; then
        echo -e "$changes_log"
    else
        echo "Waiting for new blocks..."
    fi
    echo "----------------------------------------"
    echo "Press Ctrl+C to stop | Monitoring every 2s"
    echo ""
}

# Function to show monitoring indicator without clearing screen
show_monitoring_indicator() {
    local counter="$1"
    local dots=""
    local num_dots=$((counter % 4))
    for ((i=0; i<num_dots; i++)); do
        dots="$dots."
    done
    
    # Move cursor to bottom and show indicator
    echo -ne "\r${CYAN}Monitoring${dots}${NC}    "
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Stopping monitor...${NC}"
    exit 0
}

# Set up signal handler
trap cleanup SIGINT SIGTERM

# Main monitoring function
monitor_blocks() {
    # Test connection first
    if ! test_connection; then
        exit 1
    fi
    
    echo -e "${GREEN}Starting blocks monitor (no-flash mode)...${NC}"
    
    # Initialize
    local last_timestamp=$(get_max_timestamp)
    local changes_log=""
    local max_log_lines=8
    local counter=0
    local has_displayed_initial=false
    
    # Monitoring loop
    while true; do
        # Check for new blocks
        current_timestamp=$(get_max_timestamp)
        local has_changes=false
        
        if [[ -n "$current_timestamp" && -n "$last_timestamp" && "$current_timestamp" != "$last_timestamp" ]]; then
            # Get new blocks
            local new_blocks=$(get_new_blocks "$last_timestamp")
            local display_time=$(date '+%H:%M:%S')
            
            # Add to changes log
            if [[ -n "$new_blocks" ]]; then
                while IFS= read -r line; do
                    if [[ -n "$line" && "$line" != "" ]]; then
                        changes_log="[$display_time] ${GREEN}NEW:${NC} $line\n$changes_log"
                        has_changes=true
                    fi
                done <<< "$new_blocks"
            fi
            
            # Limit log size
            local line_count=$(echo -e "$changes_log" | wc -l)
            if [[ $line_count -gt $max_log_lines ]]; then
                changes_log=$(echo -e "$changes_log" | head -n $max_log_lines)
            fi
            
            # Update last_timestamp
            last_timestamp=$current_timestamp
        fi
        
        # Only clear and redisplay if there are changes OR if this is the first time
        if [[ "$has_changes" == true || "$has_displayed_initial" == false ]]; then
            display_full_status "$changes_log"
            has_displayed_initial=true
            echo -e "${CYAN}Ready - watching for changes...${NC}"
        else
            # Just show a subtle monitoring indicator
            show_monitoring_indicator $counter
        fi
        
        # Increment counter for dots animation
        counter=$((counter + 1))
        
        # Wait before next check
        sleep 2
    done
}

# Start monitoring
monitor_blocks 