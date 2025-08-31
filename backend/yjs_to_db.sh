#!/bin/bash
# Script for Claude Code to push YJS JSON data to the PostgreSQL database
# Usage: ./yjs_to_db.sh <json_file> <username> [script_id]

set -e

JSON_FILE="$1"
USERNAME="$2"
SCRIPT_ID="$3"

if [ -z "$JSON_FILE" ] || [ -z "$USERNAME" ]; then
    echo "Error: Missing arguments"
    echo "Usage: $0 <json_file> <username> [script_id]"
    echo ""
    echo "Example: $0 /tmp/script_data.json admin@example.com"
    echo ""
    echo "Expected JSON (always 5-page chunked):"
    cat << 'EOF'
{
  "mode": "chunked",
  "chunk": {
    "number": 1,
    "total": 10,
    "pages_start": 1,
    "pages_end": 5
  },
  "metadata": {
    "title": "Example Script",
    "author": "John Doe",
    "total_pages": 50
  },
  "content": [
    { "type": "scene", "content": "ACT I - SCENE 1", "page": 1, "scene_number": "1" },
    { "type": "dialogue", "speaker": "CHARACTER", "content": "Hello, world!", "page": 1 },
    { "type": "stage_direction", "content": "(Enter CHARACTER)", "page": 1 }
  ],
  "context": {
    "last_scene": "1",
    "last_speaker": "CHARACTER"
  }
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
if [ -n "$SCRIPT_ID" ]; then
  cd /app && ./yjs_to_db "$JSON_FILE" "$USERNAME" "$SCRIPT_ID" 2>&1 || {
    EXIT_CODE=$?
    echo "---"
    echo "Error: YJS to DB operation failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
  }
else
  cd /app && ./yjs_to_db "$JSON_FILE" "$USERNAME" 2>&1 || {
    EXIT_CODE=$?
    echo "---"
    echo "Error: YJS to DB operation failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
  }
fi

echo "---"
echo "Success: Data inserted into database as YJS document"
