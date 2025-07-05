#!/bin/bash

# Simple test to debug timestamp detection

# Load environment variables
set -o allexport
source .env
set +o allexport

# Database connection
DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="$POSTGRES_DB"
DB_USER="$POSTGRES_USER"
DB_PASS="$POSTGRES_PASSWORD"

PGPASSWORD="$DB_PASS"
export PGPASSWORD

echo "=== TIMESTAMP DEBUG TEST ==="

# Get current timestamp
current_ts=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT MAX(created_at) FROM blocks;" 2>/dev/null | sed 's/^[ \t]*//')

echo "Current timestamp: '$current_ts'"

# Wait for a moment
echo "Waiting 3 seconds..."
sleep 3

# Check again
new_ts=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT MAX(created_at) FROM blocks;" 2>/dev/null | sed 's/^[ \t]*//')

echo "After wait timestamp: '$new_ts'"

# Compare
if [[ "$current_ts" != "$new_ts" ]]; then
    echo "✅ CHANGE DETECTED!"
    
    # Get new blocks
    echo "Getting new blocks since: $current_ts"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            id,
            block_type,
            created_at,
            LEFT(content, 30) as content
        FROM blocks 
        WHERE created_at > '$current_ts'::timestamp 
        ORDER BY created_at ASC;
    " 2>/dev/null
else
    echo "❌ No change detected"
fi

echo ""
echo "Now try creating a block in your app and run this again!" 