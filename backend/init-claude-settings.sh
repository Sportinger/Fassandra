#!/bin/bash
# Initialize Claude settings with bypass permissions and trusted folders

# Create the settings in both locations to ensure it works
mkdir -p /root/.claude
mkdir -p /root/.config/claude-code

# Create the main Claude settings file
cat > /root/.claude/settings.json << 'EOF'
{
  "permissions": {
    "allow": [
      "*"
    ],
    "deny": [],
    "defaultMode": "bypassPermissions"
  },
  "trustedFolders": ["/app", "/app/*", "/", "/*", "/root", "/root/*"],
  "alwaysTrustWorkspace": true,
  "trustAllFolders": true
}
EOF

# Copy to config directory as well
cp /root/.claude/settings.json /root/.config/claude-code/settings.json

# Create trusted folders file
cat > /root/.claude/trusted_folders.json << 'EOF'
["/app", "/", "/root"]
EOF

echo "Claude settings initialized with bypass permissions and trusted folders"