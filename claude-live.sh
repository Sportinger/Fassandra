#!/bin/bash
# Live view of Claude session

echo "🔍 Starting live Claude session monitor..."
echo "This will show:"
echo "- Claude commands and output"
echo "- File operations"
echo "- Database operations"
echo ""
echo "Press Ctrl+C to stop"
echo "="*50

# Monitor multiple patterns for complete picture
docker exec dev_pessoa_backend sh -c "tail -f /proc/1/fd/1 2>&1" | \
  grep -E --line-buffered "(Claude|parse_pdf|json_to_db|Reading PDF|Creating JSON|INSERT INTO|Success:|Error:|script_id)" | \
  sed -e 's/.*\[Claude\] /[CLAUDE] /' \
      -e 's/.*Starting Claude.*/\n🚀 CLAUDE SESSION STARTED\n/' \
      -e 's/.*Success:.*/✅ &/' \
      -e 's/.*Error:.*/❌ &/' \
      -e 's/.*script_id.*/📄 &/'