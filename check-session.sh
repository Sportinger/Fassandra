#!/bin/bash
# Check Claude session status by ID

SESSION_ID=$1

if [ -z "$SESSION_ID" ]; then
  echo "Usage: ./check-session.sh <session-id>"
  echo ""
  echo "Recent sessions:"
  docker logs dev_pessoa_backend 2>&1 | grep "Starting Claude Code" | tail -5
  exit 1
fi

# You'll need your auth token
echo "Enter your auth token (from browser dev tools):"
read -r TOKEN

curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/s/session/$SESSION_ID \
     | jq .