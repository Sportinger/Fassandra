#!/bin/bash

# Real-time database monitor for blocks table
# Shows current blocks at top + real-time changes below

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Terminal control codes
CLEAR='\033[2J'
HOME='\033[H'
SAVE_CURSOR='\033[s'
RESTORE_CURSOR='\033[u'

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

# Function to get current blocks (for top section)
get_current_blocks() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            id,
            LEFT(script_id::text, 8) as script_id,
            block_type,
            LEFT(content, 60) as content_preview,
            TO_CHAR(created_at, 'MM-DD HH24:MI') as created,
            block_order
        FROM blocks 
        ORDER BY id DESC 
        LIMIT 10;
    " 2>/dev/null
}

# Function to get new blocks since last check (for change log)
get_new_blocks() {
    local last_timestamp="$1"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT 
            '[' || LEFT(id::text, 8) || '...] ' ||
            'Script:' || LEFT(script_id::text, 8) || ' | ' ||
            'Type:' || block_type || ' | ' ||
            'Order:' || COALESCE(block_order::text, 'null') || ' | ' ||
            'Content: ' || LEFT(COALESCE(content, ''), 50)
        FROM blocks 
        WHERE created_at > '$last_timestamp'::timestamp 
        ORDER BY created_at ASC;
    " 2>/dev/null
}

# Function to display full screen
display_screen() {
    local changes_log="$1"
    
    # Clear screen and go to top
    echo -e "${CLEAR}${HOME}"
    
    # Header
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}       REAL-TIME BLOCKS TABLE MONITOR${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo -e "${YELLOW}Database: ${DB_NAME}@${DB_HOST}:${DB_PORT} | $(date '+%H:%M:%S')${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
    
    # Current Blocks Section
    echo -e "${CYAN}📊 CURRENT BLOCKS (Last 10):${NC}"
    echo -e "${CYAN}--------------------------------${NC}"
    get_current_blocks
    echo -e "${CYAN}--------------------------------${NC}"
    echo ""
    
    # Changes Log Section
    echo -e "${GREEN}📝 REAL-TIME CHANGES LOG:${NC}"
    echo -e "${GREEN}--------------------------------${NC}"
    if [[ -n "$changes_log" ]]; then
        echo -e "$changes_log"
    else
        echo -e "${YELLOW}Waiting for changes...${NC}"
    fi
    echo -e "${GREEN}--------------------------------${NC}"
    echo -e "${MAGENTA}Press Ctrl+C to stop monitoring${NC}"
}

# Function to test database connection
test_connection() {
    echo -e "${YELLOW}Testing database connection...${NC}"
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connection successful${NC}"
        return 0
    else
        echo -e "${RED}✗ Database connection failed${NC}"
        echo -e "${RED}Make sure the database is running and accessible${NC}"
        return 1
    fi
}

# Main monitoring function
monitor_blocks() {
    # Test connection first
    if ! test_connection; then
        exit 1
    fi
    
    # Initialize
    local last_timestamp=$(get_max_timestamp)
    local changes_log=""
    local max_log_lines=15
    
    # Initial display
    display_screen "$changes_log"
    
    # Monitoring loop
    while true; do
        # Check for new blocks
        current_timestamp=$(get_max_timestamp)
        
        if [[ -n "$current_timestamp" && -n "$last_timestamp" && "$current_timestamp" != "$last_timestamp" ]]; then
            # Get new blocks
            local new_blocks=$(get_new_blocks "$last_timestamp")
            local display_time=$(date '+%H:%M:%S')
            
            # Add to changes log
            if [[ -n "$new_blocks" ]]; then
                while IFS= read -r line; do
                    if [[ -n "$line" && "$line" != "" ]]; then
                        changes_log="${GREEN}[$display_time]${NC} ${YELLOW}NEW:${NC} $line\n$changes_log"
                    fi
                done <<< "$new_blocks"
            fi
            
            # Limit log size (keep only recent entries)
            local line_count=$(echo -e "$changes_log" | wc -l)
            if [[ $line_count -gt $max_log_lines ]]; then
                changes_log=$(echo -e "$changes_log" | head -n $max_log_lines)
            fi
            
            # Update last_timestamp
            last_timestamp=$current_timestamp
        fi
        
        # Refresh display every cycle
        display_screen "$changes_log"
        
        # Wait before next check
        sleep 3
    done
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Stopping monitor...${NC}"
    exit 0
}

# Set up signal handler for graceful shutdown
trap cleanup SIGINT SIGTERM

# Start monitoring
monitor_blocks 