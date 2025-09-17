#!/usr/bin/env bash
set -euo pipefail

# Simple maintenance cleanup script
# - deletes compacted Yjs updates older than N days
# - deletes old temp uploads
# - example log rotation left to system logrotate

# Config via env vars or defaults
DAYS_YJS=${DAYS_YJS:-30}
DAYS_UPLOADS=${DAYS_UPLOADS:-30}
UPLOADS_DIR=${UPLOADS_DIR:-"backend/uploads/scripts"}

# DATABASE_URL must be provided, e.g.:
# export DATABASE_URL="postgres://user:pass@localhost:5432/fassandra"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set" >&2
  exit 1
fi

echo "Pruning compacted Yjs updates older than ${DAYS_YJS} days..."
psql "$DATABASE_URL" <<SQL
DELETE FROM yjs_recent_updates
WHERE is_compacted = true
  AND created_at < NOW() - INTERVAL '${DAYS_YJS} days';
VACUUM ANALYZE yjs_recent_updates;
SQL

echo "Deleting uploads older than ${DAYS_UPLOADS} days in ${UPLOADS_DIR}..."
if [[ -d "$UPLOADS_DIR" ]]; then
  find "$UPLOADS_DIR" -type f -mtime +${DAYS_UPLOADS} -print -delete
else
  echo "Uploads dir not found: $UPLOADS_DIR (skipping)"
fi

echo "Done."

