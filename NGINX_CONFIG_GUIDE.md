# Nginx Configuration Guide

This project uses two nginx configurations:

## 1. Frontend Container Nginx (`frontend/nginx.conf`)
- **Location**: Inside the frontend Docker container
- **Purpose**: Serves the React app and proxies API requests to the backend container
- **Used by**: `Dockerfile.prod.simple`
- **Key features**:
  - Runs on port 80 (inside container)
  - Proxies `/api/*` requests to `backend:3001`
  - CRITICAL WebSocket settings to prevent Yjs data corruption
  - No SSL (handled by main nginx)

## 2. Main Server Nginx (`nginx-mylayer-prod.conf`)
- **Location**: On the Hetzner server at `/etc/nginx/sites-available/mylayer.org`
- **Purpose**: Main reverse proxy that handles SSL and routes to Docker containers
- **Key features**:
  - Handles SSL termination with Let's Encrypt certificates
  - Proxies to frontend container on port 8080
  - Proxies `/api/*` to backend container on port 3001
  - WebSocket support with proper buffering disabled

## Important Notes

1. **Always use `Dockerfile.prod.simple`** for building the frontend
2. **Never remove the WebSocket settings** from either nginx config
3. Both configs must have:
   - `proxy_buffering off`
   - `proxy_request_buffering off`
   - Large timeouts for WebSocket connections
   - `client_max_body_size 50M`

## Deployment

The `deploy-mylayer.sh` script automatically:
- Uses the correct `frontend/nginx.conf` when building the Docker image
- Copies `nginx-mylayer-prod.conf` to the server for reference