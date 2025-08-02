#!/bin/bash
# Initialize Claude Code configuration on container startup

set -e

# Use /tmp as home for Claude since it's writable by all users
USER_HOME="/tmp"
export HOME="/tmp"

echo "Initializing Claude Code for user: $(whoami)"
echo "Home directory: $USER_HOME"

# Ensure .claude directory exists with proper permissions
mkdir -p "$USER_HOME/.claude"
# Fix permissions if running as non-root
if [ "$(whoami)" = "appuser" ]; then
    # Ensure we own the .claude directory
    if [ -d "$USER_HOME/.claude" ] && [ ! -w "$USER_HOME/.claude" ]; then
        echo "Warning: .claude directory not writable, permissions may need fixing"
    fi
fi

# Function to set bypass permissions
set_bypass_permissions() {
    CLAUDE_JSON="$USER_HOME/.claude.json"

    echo "Creating Claude configuration with bypass permissions..."
    cat > "$CLAUDE_JSON" << 'EOF'
{
  "permissionMode": "bypass",
  "bypassPermissionsModeAccepted": true,
  "allowedTools": ["*"],
  "hasTrustDialogAccepted": true,
  "hasCompletedProjectOnboarding": true,
  "autoUpdates": false,
  "theme": "dark"
}
EOF

    # Set proper permissions
    chmod 600 "$CLAUDE_JSON"
    echo "Claude global config created at: $CLAUDE_JSON"
}

# Set bypass permissions
set_bypass_permissions

# Also create a project-specific settings file
if [ ! -d "/app/.claude" ]; then
    mkdir -p /app/.claude
fi

if [ ! -f "/app/.claude/settings.json" ]; then
    cat > /app/.claude/settings.json << 'EOF'
{
  "permissions": {
    "allow": ["*"],
    "deny": [],
    "defaultMode": "bypassPermissions"
  }
}
EOF
    echo "Project settings created at: /app/.claude/settings.json"
fi

echo "Claude Code configuration ready with bypass permissions for non-root user" 