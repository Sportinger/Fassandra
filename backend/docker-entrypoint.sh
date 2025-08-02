#!/bin/bash
# Docker entrypoint script for the backend container

set -e

# Initialize Claude Code configuration
/app/init-claude.sh

# Execute the main command
exec "$@" 