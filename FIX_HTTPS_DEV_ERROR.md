# Fix for HTTPS/TLS Development Server Error

## Problem
- Browser shows `NS_ERROR_CORRUPTED_CONTENT` when accessing `https://192.168.2.111:8080`
- Module loading fails with empty MIME type
- The dev server is trying to use HTTPS with self-signed certificates that the browser rejects

## Root Cause
1. Vite is configured to use HTTPS in development mode with self-signed certificates
2. The browser doesn't trust the self-signed certificate
3. This causes module loading to fail with corrupted content errors

## Solution Applied

### 1. Created Development-Specific Vite Config
Created `vite.config.dev.ts` that:
- Disables HTTPS for development
- Uses plain HTTP on port 8080
- Configures HMR (Hot Module Replacement) to work over WebSocket

### 2. Updated Dockerfile.dev
- Removed SSL certificate generation
- Removed HTTPS port exposure
- Updated CMD to use the dev config file

### 3. Rebuild and Deploy

## Steps to Apply the Fix

```bash
# 1. Stop current containers
docker compose down

# 2. Rebuild frontend with updated configuration
docker build --no-cache -f frontend/Dockerfile.dev \
  --build-arg VITE_API_BASE_URL=http://192.168.2.111:8089 \
  --build-arg VITE_WS_BASE_URL=ws://192.168.2.111:8090/api/collab \
  -t pessoa-dev-frontend:latest ./frontend

# 3. Start services
docker compose up -d

# 4. Access the application
# Use HTTP (not HTTPS):
http://192.168.2.111:8080
```

## Alternative Quick Fix (Without Rebuild)

If you can't rebuild immediately, you can:

1. **Accept the self-signed certificate in the browser:**
   - Navigate to https://192.168.2.111:8080
   - Click "Advanced" → "Accept Risk and Continue" (Firefox) or "Proceed" (Chrome)
   
2. **Or modify the running container:**
```bash
# Get container ID
docker ps | grep frontend

# Copy the new vite config
docker cp vite.config.dev.ts <container_id>:/app/

# Restart the container
docker restart <container_id>
```

## Verification

After applying the fix:
1. Access `http://192.168.2.111:8080` (HTTP, not HTTPS)
2. Check browser console - no more NS_ERROR_CORRUPTED_CONTENT
3. Vite HMR should work properly
4. DOMPurify should load correctly

## Prevention

For future development:
1. Use HTTP for local development to avoid certificate issues
2. Only use HTTPS in staging/production with proper certificates
3. Keep development and production configs separate

## Updated Access URLs

After the fix, use:
- Frontend: `http://192.168.2.111:8080` (HTTP)
- Backend API: `http://192.168.2.111:8089`
- WebSocket: `ws://192.168.2.111:8090/api/collab`

## Note on Security

Using HTTP in local development is acceptable because:
- It's only accessible on your local network
- No sensitive data should be in development
- It avoids certificate complexity during development

For production, always use HTTPS with valid certificates.