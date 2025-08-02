#!/bin/bash
# Initialize Claude Code and Gemini CLI configuration on container startup

set -e

# Use appuser's home directory for persistent storage
if [ "$(whoami)" = "appuser" ]; then
    USER_HOME="/home/appuser"
else
    USER_HOME="/root"
fi

# Set HOME environment variable to the correct user directory
export HOME="$USER_HOME"

echo "Initializing Claude Code for user: $(whoami)"
echo "Home directory: $USER_HOME"

# Ensure .claude directory exists with proper permissions
mkdir -p "$USER_HOME/.claude"

# If running as root, ensure appuser can write to the directory
if [ "$(whoami)" = "root" ]; then
    chown -R appuser:appuser "$USER_HOME/.claude"
fi

# Function to set bypass permissions
set_bypass_permissions() {
    CLAUDE_JSON="$USER_HOME/.claude.json"

    # Only create if it doesn't exist
    if [ ! -f "$CLAUDE_JSON" ]; then
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
    else
        echo "Claude config already exists at: $CLAUDE_JSON"
    fi
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

# Initialize Gemini CLI configuration
echo "Initializing Gemini CLI configuration..."

# Ensure .gemini directory exists with proper permissions
mkdir -p "$USER_HOME/.gemini"
mkdir -p "$USER_HOME/.gemini/commands"
mkdir -p "$USER_HOME/.gemini/extensions"

# If running as root, ensure appuser can write to the directory
if [ "$(whoami)" = "root" ]; then
    chown -R appuser:appuser "$USER_HOME/.gemini"
fi

# Create a global GEMINI.md file if it doesn't exist
if [ ! -f "$USER_HOME/.gemini/GEMINI.md" ]; then
    cat > "$USER_HOME/.gemini/GEMINI.md" << 'EOF'
# Gemini CLI Global Configuration

This is the global configuration file for Gemini CLI.

## Default Settings
- Use Gemini 2.5 Pro model
- Enable full context window (1 million tokens)
- Auto-authenticate with Google account when available
EOF
    echo "Gemini global config created at: $USER_HOME/.gemini/GEMINI.md"
fi

# Also create a project-specific .gemini directory if needed
if [ ! -d "/app/.gemini" ]; then
    mkdir -p /app/.gemini
    mkdir -p /app/.gemini/commands
fi

echo "Gemini CLI configuration ready" 