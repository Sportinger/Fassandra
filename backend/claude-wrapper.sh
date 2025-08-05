#!/bin/bash
# Wrapper script to ensure Claude Code runs with proper environment

export PATH="/home/appuser/.npm-global/bin:$PATH"
export HOME="/home/appuser"

# Run Claude Code with all arguments passed to this script
exec /home/appuser/.npm-global/bin/claude "$@"