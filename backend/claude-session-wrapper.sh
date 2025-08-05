#!/bin/bash
# Claude session wrapper that creates a named pipe for monitoring

SESSION_DIR="/tmp/claude-sessions"
mkdir -p $SESSION_DIR

# Generate session ID if not provided
SESSION_ID=${1:-$(date +%Y%m%d_%H%M%S)}
PIPE_FILE="$SESSION_DIR/claude_session_$SESSION_ID.pipe"

# Create named pipe
mkfifo $PIPE_FILE 2>/dev/null || true

echo "Starting Claude session: $SESSION_ID"
echo "Monitor with: tail -f $PIPE_FILE"
echo "Or from host: ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115 'docker exec mylayer_pessoa_backend tail -f $PIPE_FILE'"

# Run Claude and tee output to both stdout and the pipe
/home/appuser/.npm-global/bin/claude "$@" 2>&1 | tee $PIPE_FILE

# Clean up pipe when done
rm -f $PIPE_FILE