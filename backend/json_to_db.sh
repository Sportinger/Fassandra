#!/bin/bash
# Script for Claude Code to push JSON data to the PostgreSQL database
# Usage: ./json_to_db.sh <json_file> <username>

set -e

JSON_FILE="$1"
USERNAME="$2"

if [ -z "$JSON_FILE" ] || [ -z "$USERNAME" ]; then
    echo "Error: Missing arguments"
    echo "Usage: $0 <json_file> <username>"
    echo ""
    echo "Example: $0 script_data.json admin@example.com"
    echo ""
    echo "Example JSON structure:"
    cat << 'EOF'
{
  "title": "Example Script",
  "author": "John Doe",
  "year": 2024,
  "language": "en",
  "description": "A sample script",
  "blocks": [
    {
      "block_type": "scene",
      "content": "ACT I - SCENE 1",
      "sequence_number": 1
    },
    {
      "block_type": "dialogue",
      "content": "Hello, world!",
      "character_name": "CHARACTER",
      "sequence_number": 2
    },
    {
      "block_type": "stage_direction",
      "content": "(Enter CHARACTER)",
      "sequence_number": 3
    }
  ]
}
EOF
    exit 1
fi

if [ ! -f "$JSON_FILE" ]; then
    echo "Error: JSON file not found: $JSON_FILE"
    exit 1
fi

echo "Pushing JSON to database..."
echo "File: $JSON_FILE"
echo "User: $USERNAME"
echo "---"

# Execute the json_to_db binary
cd /app && ./json_to_db "$JSON_FILE" "$USERNAME" 2>&1 || {
    EXIT_CODE=$?
    echo "---"
    echo "Error: JSON to DB operation failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
}

echo "---"
echo "Success: Data inserted into database"