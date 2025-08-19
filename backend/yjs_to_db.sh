#!/bin/bash
# Script for Claude Code to push YJS JSON data to the PostgreSQL database
# Usage: ./yjs_to_db.sh <json_file> <username>

set -e

JSON_FILE="$1"
USERNAME="$2"

if [ -z "$JSON_FILE" ] || [ -z "$USERNAME" ]; then
    echo "Error: Missing arguments"
    echo "Usage: $0 <json_file> <username>"
    echo ""
    echo "Example: $0 script_data.json admin@example.com"
    echo ""
    echo "Example JSON structure for full mode:"
    cat << 'EOF'
{
  "mode": "full",
  "metadata": {
    "title": "Example Script",
    "author": "John Doe",
    "total_pages": 8
  },
  "content": [
    {
      "type": "scene",
      "content": "ACT I - SCENE 1",
      "page": 1,
      "scene_number": "1"
    },
    {
      "type": "dialogue",
      "speaker": "CHARACTER",
      "content": "Hello, world!",
      "page": 1
    },
    {
      "type": "stage_direction",
      "content": "(Enter CHARACTER)",
      "page": 1
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

echo "Pushing YJS JSON to database..."
echo "File: $JSON_FILE"
echo "User: $USERNAME"
echo "---"

# Execute the yjs_to_db binary
cd /app && ./yjs_to_db "$JSON_FILE" "$USERNAME" 2>&1 || {
    EXIT_CODE=$?
    echo "---"
    echo "Error: YJS to DB operation failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
}

echo "---"
echo "Success: Data inserted into database as YJS document"