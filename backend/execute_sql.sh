#!/bin/bash
# Script for Claude Code to execute SQL in the PostgreSQL database
# Usage: ./execute_sql.sh <sql_file>

set -e

SQL_FILE="$1"

if [ -z "$SQL_FILE" ]; then
    echo "Error: No SQL file provided"
    echo "Usage: $0 <sql_file>"
    exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
    echo "Error: SQL file not found: $SQL_FILE"
    exit 1
fi

echo "Executing SQL from: $SQL_FILE"
echo "---"

# Execute SQL and capture both stdout and stderr
PGPASSWORD=dev_password_123 psql -h db -U fassandra_user -d fassandra_db -f "$SQL_FILE" 2>&1 || {
    EXIT_CODE=$?
    echo "---"
    echo "Error: SQL execution failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
}

echo "---"
echo "Success: SQL executed successfully" 
