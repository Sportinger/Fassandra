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
    echo "Expected JSON (always 5-page chunked). Accepts a single chunk, an array of chunks, or {\"chunks\":[...]}:"
    cat << 'EOF'
{
  "chunks": [
    {
      "mode": "chunked",
      "chunk": { "number": 1, "total": 2, "pages_start": 1, "pages_end": 5 },
      "metadata": { "title": "Example Script", "author": "John Doe", "total_pages": 8 },
      "content": [ { "type": "scene", "content": "ACT I - SCENE 1", "page": 1, "scene_number": "1" } ],
      "context": { "last_scene": "1", "last_speaker": "CHARACTER" }
    },
    {
      "mode": "chunked",
      "chunk": { "number": 2, "total": 2, "pages_start": 6, "pages_end": 8 },
      "content": [ { "type": "dialogue", "speaker": "CHARACTER", "content": "Goodbye", "page": 6 } ],
      "context": { "last_scene": "1.1", "last_speaker": "CHARACTER" }
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
