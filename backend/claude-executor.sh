#!/bin/bash
# Claude executor wrapper that handles running as appropriate user

# Check if we're root
if [ "$EUID" -eq 0 ]; then
    # Running as root, switch to appuser
    echo "[claude-executor] Running as root, switching to appuser" >&2
    # Don't pass API key - use browser authentication instead
    exec su - appuser -c "claude --print --dangerously-skip-permissions"
else
    # Not root, run directly
    echo "[claude-executor] Running as non-root user (uid: $EUID)" >&2
    exec claude --print --dangerously-skip-permissions
fi