#!/bin/bash
echo "Monitoring for upload activity... Press Ctrl+C to stop"
docker exec dev_pessoa_backend sh -c "tail -f /proc/1/fd/1 2>&1" | grep -E "(upload|claude|POST|/api/s/)" --line-buffered | grep -v "sqlx" | grep -v "snapshot"