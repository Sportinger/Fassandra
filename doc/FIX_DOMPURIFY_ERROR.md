# Fix for DOMPurify Import Error

## Problem
The browser is getting `NS_ERROR_CORRUPTED_CONTENT` when trying to load `MultiPageView.tsx` because the Docker container doesn't have the DOMPurify dependency installed.

## Root Cause
1. We added `dompurify` to pasckage.json locally
2. The Docker container was built before this dependency was added
3. The container is trying to serve a module that imports DOMPurify but doesn't have it installed

## Solution

### Option 1: Rebuild the Docker container (Recommended)
```bash
# Stop the current containers
docker compose down

# Rebuild with the new dependencies
./deploy.dev.sh --no-cache

# OR if you want to be more specific:
docker build --no-cache -f frontend/Dockerfile.dev -t pessoa-dev-frontend:latest ./frontend
docker compose up -d
```

### Option 2: Install dependency in running container (Quick fix)
```bash
# Get the container ID
docker ps | grep frontend

# Install the missing package in the running container
docker exec -it <container_id> npm install dompurify @types/dompurify

# Restart the container
docker restart <container_id>
```

### Option 3: Mount node_modules as volume (Development optimization)
Update your docker-compose.yml to exclude node_modules from the volume mount:

```yaml
frontend:
  volumes:
    - ./frontend:/app
    - /app/node_modules  # This prevents host node_modules from overriding container's
```

## Prevention
To avoid this in the future:
1. Always rebuild containers after adding new dependencies
2. Use `--no-cache` flag when dependencies change
3. Consider using a volume for node_modules to keep container dependencies isolated

## Verification
After fixing, you should see:
- No more MIME type errors
- MultiPageView component loads correctly
- DOMPurify sanitizes HTML content properly

## Commands Summary
```bash
# Full rebuild (safest)
cd /home/admins/projects/pessoa
./deploy.dev.sh --no-cache

# Or just rebuild frontend
docker compose down frontend
docker build --no-cache -f frontend/Dockerfile.dev -t pessoa-dev-frontend:latest ./frontend
docker compose up -d frontend
```