#!/bin/bash

echo "=== Claude Session Monitor ==="
echo "Options:"
echo "1. Watch live Claude output"
echo "2. Check active Claude processes"
echo "3. View Claude working directory"
echo "4. Enter Claude container shell"
echo ""

case "${1:-1}" in
  1)
    echo "📋 Monitoring Claude output (Ctrl+C to stop)..."
    docker logs -f dev_pessoa_backend 2>&1 | grep --line-buffered "\[Claude\]" | sed 's/.*\[Claude\] //'
    ;;
    
  2)
    echo "🔍 Checking for active Claude processes..."
    docker exec dev_pessoa_backend sh -c "pgrep -la claude 2>/dev/null || echo 'No Claude processes running'"
    ;;
    
  3)
    echo "📁 Claude working directory and recent files:"
    docker exec dev_pessoa_backend sh -c "ls -la /app/uploads/scripts/ | tail -10"
    echo ""
    echo "📝 Any generated JSON files:"
    docker exec dev_pessoa_backend sh -c "find /app -name '*.json' -mmin -5 -type f 2>/dev/null | grep -v node_modules | head -10"
    ;;
    
  4)
    echo "🐚 Entering container shell (type 'exit' to leave)..."
    echo "You can run 'claude' manually to test"
    docker exec -it dev_pessoa_backend /bin/bash
    ;;
    
  *)
    echo "Invalid option"
    ;;
esac