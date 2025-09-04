Fassandra Upload + Claude Parsing — Sanitary Runbook Summary

- Period: 2025-09-04 08:55–09:05 UTC (latest run highlighted)
- Outcome: Parsing session launched successfully using host Claude CLI; chunked mode detected (4 pages, 1 chunk). Frontend reported completion. No errors observed after auth/config fixes.

What Happened (latest run)
- 08:58:50Z: Backend accepts PDF upload and starts a parsing session.
  - Session ID: [UUID]
  - Input: [/app/uploads/scripts/<upload_id>_test_removed_chunks]
- 08:58:50Z: Session initializes parser with chunked strategy (Total pages: 4, Chunks: 1).
- 08:58:51Z: Backend selects Claude CLI from host NVM mount.
  - CLI: /host-claude/bin/claude
  - Config: HOME=/home/appuser, XDG_CONFIG_HOME=/home/appuser/.config
- 08:58:51Z: Prompt sent to Claude; stream-json initialized.
- 08:58:52Z–08:58:58Z: Claude session starts; assistant acknowledges parsing task and proceeds to examine directory and initialize processing.
- Subsequent steps: Page progress and chunk completion logged (omitted here); import executed; frontend reported success.

Operational Changes (this run)
- Use host Claude CLI inside backend container via docker-compose:
  - env: `CLAUDE_BIN=/host-claude/bin/claude`
  - mounts:
    - `~/.nvm/versions/node/v22.19.0/bin:/host-claude/bin:ro`
    - `~/.nvm/versions/node/v22.19.0/lib/node_modules:/host-claude/lib/node_modules:ro`
- Allow Claude to persist config/tokens inside container:
  - `~/.config/claude-code:/home/appuser/.config/claude-code:rw`
  - `~/.claude:/home/appuser/.claude:rw`

Sanitization Rules
- Mask UUIDs → [UUID]
- Mask user IDs and session IDs → [ID]
- Replace absolute upload paths with [/app/uploads/scripts/<upload_id>_chunks]
- Drop IP addresses if present → [IP]
- Remove API keys, tokens, or secrets (e.g., values starting with `sk-`) → [SECRET]

Sanitized Excerpt (latest run)
```
INFO backend::handlers::script_upload_handler: Returning upload response: session_id=[UUID], message=Claude Code session started. Processing 'test_removed.pdf'
INFO backend::services::claude_session_service: Starting Claude Code with input path: [/app/uploads/scripts/<upload_id>_test_removed_chunks]
INFO backend::services::claude_session_service: [Claude] [PROGRESS] Starting chunked parsing - Total pages: 4, Chunks: 1
INFO backend::services::claude_session_service: Using Claude at: /host-claude/bin/claude (...PATH elided...)
INFO backend::services::claude_session_service: Using Claude config from HOME=/home/appuser XDG_CONFIG_HOME=/home/appuser/.config
INFO backend::services::claude_session_service: Sending prompt to Claude stdin
INFO backend::services::claude_session_service: Prompt sent successfully
INFO backend::services::claude_session_service: [Claude] {"type":"system","subtype":"init", ... "model":"claude-sonnet-4-20250514" ...}
INFO backend::services::claude_session_service: [Claude] {"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"... initializing parsing process ..."}]}}
```

Notes
- The “[PROGRESS] Starting chunked parsing …” line confirms correct page and chunk detection.
- Subsequent “[PROGRESS] Page … processed” and “[CHUNK_COMPLETE] …” lines indicate live parsing progress.
- Import completion is reflected by success lines from importer or final completion markers.

If You Need Raw Logs
- Run on server: `docker logs --since 30m mylayer_fassandra_backend`
- For sanitized grep: `docker logs --since 30m mylayer_fassandra_backend | grep -i -E "claude_session_service|\[PROGRESS\]|\[CHUNK_COMPLETE\]|Success|Script ID"`

