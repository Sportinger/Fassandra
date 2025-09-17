Maintenance (Retention & Cleanup)

Summary
- Yjs updates: Compact updates are safe to delete after a retention period (e.g., 30 days).
- Uploads: Remove old temporary uploads regularly (e.g., 30 days).
- Logs: Configure system logrotate or container log limits.

Cleanup Script
- Script: `scripts_deploy/maintenance/cleanup.sh`
- Env:
  - `DATABASE_URL` (required)
  - `DAYS_YJS` (default 30)
  - `DAYS_UPLOADS` (default 30)
  - `UPLOADS_DIR` (default `backend/uploads/scripts`)

Example execution:
```
export DATABASE_URL="postgres://user:pass@localhost:5432/fassandra"
bash scripts_deploy/maintenance/cleanup.sh
```

Cron Examples
- Daily at 02:15:
```
15 2 * * * DATABASE_URL='postgres://user:pass@localhost:5432/fassandra' \
    DAYS_YJS=30 DAYS_UPLOADS=30 \
    bash /path/to/repo/scripts_deploy/maintenance/cleanup.sh >> /var/log/fassandra_maintenance.log 2>&1
```

Container Logs
- With Docker: configure `--log-opt max-size=10m --log-opt max-file=3` per service, or use daemon defaults.
- With system logrotate: rotate Nginx/Caddy logs, journal, etc.

