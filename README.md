# Pessoa: AI-Powered Collaborative Scriptwriting

![Pessoa Logo](img/logo.png)

Pessoa is transforming theatre script development. It's a collaborative platform where writers, directors, and the entire production team can work together on scripts in real-time. Using AI, Pessoa can structure imported documents, making the script easier to visualize, analyze, and edit.

![App screenshot](img/app.png)

## Why Pessoa?

Traditional script development often involves juggling multiple document versions, scattered feedback, and difficulty visualizing changes. Pessoa addresses this by providing:

*   A **centralized hub** for the living script.
*   **AI assistance** to structure and understand script content quickly.
*   **Real-time synchronization** to keep everyone on the same page.
*   A **foundation for richer visualization** and analysis beyond plain text.

## Key Features

*   **Real-time Collaborative Editor:** Work together simultaneously on the same script, seeing changes instantly. Powered by Yjs/CRDTs for seamless merging of edits.
*   **AI Script Structuring:** Upload `.docx` files and let the AI analyze and structure them into scenes, characters, dialogue, and stage directions. Saves time and provides a structured data foundation.
*   **Structured Data Model:** Stores the script not just as text, but as meaningful blocks (dialogue, actions, etc.), enabling more flexible rendering and potential analysis.
*   **User Authentication:** Secure login and registration using JWT keeps your work private.
*   **WebSockets & Offline Cache:** Changes sync instantly via WebSockets when online and are cached locally using IndexedDB, allowing you to work even if the connection drops temporarily.
*   **Dockerized:** Easy setup and deployment using Docker Compose ensures a consistent environment.



## Getting Started

### Prerequisites

*   Docker and Docker Compose

### Running with Docker

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url> # Replace with actual URL
    cd pessoa
    ```

2.  **Set up environment variables:**
    -   Copy the example environment file:
        ```bash
        # On Linux/macOS/Git Bash:
        cp .env.example .env
        # On Windows Command Prompt:
        # copy .env.example .env
        # On Windows PowerShell:
        # Copy-Item .env.example .env
        ```
    -   **Edit the `.env` file** with a text editor.
    -   **Important:** You MUST set secure, unique values for `POSTGRES_PASSWORD` and `JWT_SECRET`. Do **not** commit the `.env` file to Git. The `GEMINI_API_KEY` is also required for the AI structuring feature.

3.  **Start the application stack:**
    ```bash
    # This will build the images if they don't exist
    docker compose up -d
    ```
    *(Or use `./helper/bash/start` for convenience)*

4.  **Set up HTTPS (Recommended):**
    ```bash
    # Generate SSL certificates and configure HTTPS
    ./setup-https.sh
    
    # Rebuild with HTTPS configuration
    docker-compose down
    docker-compose up --build -d
    ```

5.  **Access the application:**
    -   **HTTPS (Secure):** https://localhost:8443 or https://yourdomain.com:8443
    -   **HTTP (Redirects to HTTPS):** http://localhost:8080
    -   **Backend API:** http://localhost:3001 (internal use only)
    -   **pgAdmin:** http://localhost:5050

6.  **Development User:**
    A default admin user is created automatically for development:
    -   **Email:** `admin@pessoa.de`
    -   **Password:** `PassoaDevteam`

## Mobile Browser Compatibility & Debugging 📱

Pessoa includes comprehensive mobile browser support with advanced debugging capabilities for troubleshooting real-time collaboration issues.

### Mobile Browser Support

**Supported Mobile Browsers:**
- Chrome Mobile
- Safari Mobile (iOS)
- Samsung Internet
- Firefox Mobile
- Brave Mobile

**Key Features:**
- **Automatic Mobile Detection**: Optimized WebSocket configuration for mobile browsers
- **Console Forwarding**: Mobile console logs automatically sent to backend for debugging
- **IP Address Resolution**: Proper network configuration for mobile device access
- **Touch-Optimized Interface**: Responsive design for mobile editing

### Mobile Development Setup

1. **Find Your Network IP Address:**
   ```bash
   # Linux/macOS
   ip addr show | grep inet
   # or
   ifconfig | grep inet
   
   # Windows
   ipconfig
   ```

2. **Update Environment Configuration:**
   ```bash
   # In your .env file, set your network IP:
   APP_HOSTNAME=192.168.2.111  # Replace with your actual IP
   ```

3. **Rebuild Frontend Container:**
   ```bash
   docker-compose build --no-cache frontend
   docker-compose restart frontend
   ```

4. **Access from Mobile:**
   - **HTTP**: `http://192.168.2.111:8080`
   - **HTTPS**: `https://192.168.2.111:8443`

### Mobile Debugging System

Pessoa includes an advanced console forwarding system for debugging mobile browser issues:

**Console Forwarding Features:**
- **Automatic Activation**: Enables automatically on mobile devices
- **Real-time Logging**: Sends console logs to backend every 5 seconds
- **Device Detection**: Captures browser type, screen size, and user agent
- **YJS Integration**: Detailed WebSocket and document synchronization logging

**Using the Mobile Debug Test Page:**
1. **Access Test Page**: `http://your-ip:8080/mobile-test.html`
2. **Test Console Forwarding**: Click test buttons to generate logs
3. **Monitor Backend Logs**: `docker-compose logs backend --tail=20 -f`
4. **View Forwarded Logs**: See mobile console output in backend logs

**Backend Debug Endpoint:**
- **URL**: `POST /api/debug/console-logs`
- **Purpose**: Receives and logs mobile console data
- **Log Levels**: Error, warn, info, debug, log

### Mobile WebSocket Troubleshooting

**Common Mobile WebSocket Issues:**

1. **"localhost" Connection Errors**
   - **Problem**: Mobile browsers can't access `localhost` 
   - **Solution**: Use actual IP address in `VITE_WS_BASE_URL`
   - **Fix**: Set `APP_HOSTNAME` to your network IP address

2. **Network Policy Restrictions**
   - **Problem**: Corporate networks blocking WebSocket connections
   - **Solution**: Test on personal hotspot or different network
   - **Alternative**: Use HTTPS with proper certificates

3. **Battery Optimization**
   - **Problem**: Mobile browsers suspending WebSocket connections
   - **Solution**: Keep browser active during collaboration
   - **Detection**: Console forwarding shows connection drops

**Environment Variable Configuration for Mobile:**
```bash
# Correct for mobile access
APP_HOSTNAME=192.168.2.111
VITE_WS_BASE_URL=ws://192.168.2.111:8080/api/collab

# Incorrect - mobile browsers can't access localhost
VITE_WS_BASE_URL=ws://localhost:8080/api/collab
```

### Browser-Specific WebSocket Handling

Pessoa automatically detects and handles browser-specific WebSocket requirements:

**Chrome/Safari/Mobile Browsers:**
- Manual WebSocket URL construction with token in query string
- Shorter reconnection timeouts (3-8 seconds)
- Enhanced error handling with browser-specific messages

**Firefox/Other Browsers:**
- Standard y-websocket parameter-based authentication
- Longer reconnection timeouts (10-15 seconds)
- Standard WebSocket provider configuration

**Detection Methods:**
```javascript
// Automatic browser detection
isChrome() // Chrome-specific handling
isSafari() // Safari-specific handling  
isMobile() // Mobile-specific optimizations
```

### Mobile Performance Optimization

**Real-time Collaboration Optimizations:**
- **Reduced Heartbeat Intervals**: Prevent mobile timeout (15s vs 30s)
- **Aggressive Reconnection**: Shorter backoff times for mobile
- **Awareness Update Filtering**: Reduced bandwidth for cursor updates
- **IndexedDB Caching**: Offline-first approach for mobile reliability

**Mobile-Specific Settings:**
```javascript
// Mobile WebSocket configuration
maxBackoffTime: 3000,    // vs 8000 for desktop
resyncInterval: 8000,    // vs 12000 for desktop
```

## Custom Domain Setup

To use a custom domain (e.g., mylayer.org):

1.  **Point your domain to the server IP address**

2.  **Update environment configuration:**
    ```bash
    # Edit env.exact.copy.md
    APP_HOSTNAME=mylayer.org
    
    # Copy to hidden .env file
    cp env.exact.copy.md .env
    ```

3.  **Generate certificates for your domain:**
    ```bash
    ./generate-ssl-certs-domain.sh mylayer.org
    ```

4.  **Rebuild and restart:**
    ```bash
    docker-compose down
    docker-compose up --build -d
    ```

5.  **Access your secure application:**
    - https://mylayer.org:8443

**Note:** Browsers will show a security warning for self-signed certificates. Click "Advanced" → "Proceed to site" to continue.

## Production Deployment with GitHub Actions 🚀

Pessoa includes a fully automated CI/CD pipeline that delivers **10x faster deployments** compared to building on the server. Instead of 5-10 minute server builds, deployments complete in ~2 minutes using pre-built Docker images.

### 🎯 **How It Works**

1. **Push to dev branch** → GitHub Actions automatically triggers
2. **Builds optimized Docker images** for both frontend and backend
3. **Pushes to GitHub Container Registry** (ghcr.io)
4. **SSH deploys to production server** pulling pre-built images
5. **Zero server compilation** - just container orchestration

### 🛠️ **Setup Instructions**

#### 1. GitHub Repository Configuration

Add these **Repository Secrets** in GitHub Settings → Secrets and variables → Actions:

```bash
HETZNER_HOST=your-domain.com          # Your server domain
HETZNER_USER=your-ssh-user            # SSH username (e.g., roman)
HETZNER_SSH_KEY=your-private-key      # SSH private key for deployment
DATABASE_URL=postgres://user:pass@db:5432/dbname
VITE_API_BASE_URL=https://your-domain.com:8443
VITE_WS_BASE_URL=wss://your-domain.com:8443/api/collab
```

#### 2. Server Setup

On your production server:

```bash
# 1. Generate SSH key pair (run locally)
ssh-keygen -t ed25519 -f ~/.ssh/github-actions-deploy -C "github-actions-deploy"

# 2. Add public key to server's authorized_keys
ssh your-user@your-server "echo 'your-public-key-here' >> ~/.ssh/authorized_keys"

# 3. Copy the deployment files to your server
scp docker-compose.hetzner-github-actions.yml your-server:/opt/pessoa/
scp env.hetzner-github-actions.template your-server:/opt/pessoa/.env

# 4. Login to GitHub Container Registry on server
echo "your-github-token" | docker login ghcr.io -u your-username --password-stdin
```

#### 3. Environment Configuration

Update `/opt/pessoa/.env` on your server:

```bash
# Core settings
IMAGE_TAG=dev                          # Use 'dev' for development builds
DOCKER_REGISTRY=ghcr.io/your-username  # Your GitHub Container Registry
CONTAINER_PREFIX=main_                 # Container name prefix

# SSL Certificate paths (CRITICAL!)
SSL_CERT_PATH=/opt/pessoa/frontend/ssl/certs/server.crt
SSL_KEY_PATH=/opt/pessoa/frontend/ssl/private/server.key

# Application URLs
VITE_API_BASE_URL=https://your-domain.com:8443
VITE_WS_BASE_URL=wss://your-domain.com:8443/api/collab
```

### 🔧 **Deployment Files**

The automated deployment uses these specialized files:

- **`.github/workflows/deploy.yml`** - GitHub Actions workflow
- **`docker-compose.hetzner-github-actions.yml`** - Production compose file using pre-built images
- **`env.hetzner-github-actions.template`** - Environment template for production
- **`setup_hetzner_deployment.sh`** - Automated server setup script

### ⚡ **Performance Benefits**

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Deployment Time** | 5-10 minutes | ~2 minutes | **10x faster** |
| **Server Load** | High (Rust compilation) | Minimal (Docker pull) | **Dramatically reduced** |
| **Reliability** | Manual process | Automated pipeline | **Zero human error** |
| **Rollback** | Complex | Simple image swap | **Instant rollback** |

### 🚨 **Common Troubleshooting**

#### SSL Certificate Path Issues
**Symptom:** Frontend container keeps restarting with SSL errors
```bash
nginx: [emerg] cannot load certificate "/etc/ssl/certs/server.crt"
```

**Solution:** Verify SSL paths in `.env` match actual certificate locations:
```bash
# Check actual certificate locations
find /opt/pessoa -name "*.crt" -o -name "*.key"

# Update .env with correct paths
SSL_CERT_PATH=/path/to/actual/server.crt
SSL_KEY_PATH=/path/to/actual/server.key
```

#### Container Registry Authentication
**Symptom:** `unauthorized` errors when pulling images
```bash
Error response from daemon: pull access denied for ghcr.io/username/repo
```

**Solution:** Login to GitHub Container Registry on server:
```bash
echo "your-github-personal-access-token" | docker login ghcr.io -u your-username --password-stdin
```

#### Image Tag Mismatches
**Symptom:** `manifest unknown` errors
**Solution:** Ensure `IMAGE_TAG` in `.env` matches the branch/tag being built (e.g., `dev`, `main`, `latest`)

### 🎯 **Usage**

Once configured, deployment is incredibly simple:

```bash
# Make your changes
git add .
git commit -m "Feature: Add amazing new functionality"

# Deploy automatically
git push origin dev

# Watch the magic happen in GitHub Actions tab! ✨
```

Your application will be live at `https://your-domain.com:8443` in ~2 minutes!

## Basic Workflow

Once the application is running:

1.  Open your browser to `http://localhost:8080`.
2.  Log in using the development user: `admin@pessoa.de` / `PassoaDevteam`.
3.  Try uploading a `.docx` script file via the interface.
4.  Observe how the AI structures the content.
5.  Open the script and experiment with the collaborative editor.

## Repository Structure

| Path                                          | Purpose                                             |
|-----------------------------------------------|-----------------------------------------------------|
| `backend/`                                    | Rust/Axum API, WebSocket server, AI logic          |
| `frontend/`                                   | React/TypeScript UI, Tiptap editor, Yjs integration |
| **Production Deployment**                     |                                                     |
| `.github/workflows/deploy.yml`                | GitHub Actions CI/CD pipeline for automated deployment |
| `docker-compose.hetzner-github-actions.yml`   | Production Docker Compose using pre-built images   |
| `env.hetzner-github-actions.template`         | Production environment variables template           |
| `setup_hetzner_deployment.sh`                 | Automated production server setup script           |
| **Local Development**                         |                                                     |
| `docker-compose.yml`                          | Local development with hot-reload                   |
| `docker-compose.https.yml`                    | Local HTTPS development configuration               |
| `frontend/nginx-https.conf`                   | HTTPS nginx configuration with proxy rules         |
| `frontend/Dockerfile.https`                   | Docker configuration for HTTPS frontend            |
| `env.exact.copy.md`                           | Environment variables template                      |
| `generate-ssl-certs-domain.sh`                | SSL certificate generation script                   |
| `setup-https.sh`                              | Automated HTTPS setup script                       |
| **Documentation & Assets**                    |                                                     |
| `doc/`                                        | Advanced documentation, notes                       |
| `img/`                                        | Logos, screenshots                                  |
| `helper/`                                     | Utility scripts (like rebuild, start)              |

## Architecture Overview

Pessoa is a containerized application with the following components:

### Component Architecture
```
Browser (HTTPS) → Nginx (Frontend + Proxy) → Rust Backend → PostgreSQL
                                           ↓
                                    WebSocket Server
```

**Frontend Container (`pessoa_frontend`)**
- React/TypeScript SPA with Vite build system
- Nginx web server with SSL/TLS termination
- Acts as reverse proxy for backend API calls
- Serves static assets and handles SPA routing

**Backend Container (`pessoa_backend`)**
- Rust/Axum web server with WebSocket support
- Handles authentication, API endpoints, and real-time collaboration
- Connects to PostgreSQL for data persistence
- Processes file uploads and AI integration

**Database Container (`pessoa_db`)**
- PostgreSQL 15 with persistent data volumes
- Stores users, scripts, blocks, edits, and collaboration data

**Admin Container (`pessoa_pgadmin`)**
- Web-based PostgreSQL administration interface
- Available at http://localhost:5050

### Network Architecture & HTTPS Setup

The application supports both HTTP (development) and HTTPS (production) configurations:

**HTTPS Configuration:**
- Frontend runs on ports 8080 (HTTP redirect) and 8443 (HTTPS)
- Self-signed certificates generated automatically for development
- Nginx handles SSL termination and proxies API calls to backend
- All API calls go through HTTPS frontend proxy (no mixed content issues)

**API Proxy Configuration:**
- `/login` and `/register` → proxied to backend:3001
- `/api/*` → proxied to backend:3001  
- Everything else → served as static frontend assets

### Environment Configuration

The application uses environment files for configuration:

**Key Variables:**
- `APP_HOSTNAME`: Domain name (e.g., mylayer.org)
- `FRONTEND_HTTPS_PORT`: HTTPS port (default: 8443)
- `VITE_API_BASE_URL`: Frontend API base URL (should use HTTPS proxy)
- `ALLOWED_ORIGINS`: CORS origins for both HTTP and HTTPS
- `JWT_SECRET`: Secret for JWT token signing
- `GEMINI_API_KEY`: Google Gemini AI API key

**Environment File Structure:**
- `env.exact.copy.md`: Template with current configuration
- `.env`: Hidden file used by Docker Compose (copy from template)

## Technical Deep Dive

For a detailed technical overview of the backend (Rust/Axum/SQLx), frontend (React/Tiptap/Yjs), AI integration, WebSocket handling, database schema, and more, please see [`doc/ADVANCED_README.md`](doc/ADVANCED_README.md).

## API Endpoint Structure

The backend provides the following endpoint categories:

**Authentication (Root Level):**
- `POST /login` - User authentication
- `POST /register` - User registration

**API Endpoints (`/api` prefix):**
- `GET /api/scripts` - List user scripts
- `POST /api/scripts` - Create new script
- `GET /api/scripts/:id` - Get script with blocks
- `PATCH /api/scripts/:id` - Update script title
- `DELETE /api/scripts/:id` - Delete script
- `POST /api/scripts/:id/blocks` - Create new block
- `PATCH /api/blocks/:id` - Update block content
- `GET /api/blocks/:id/history` - Get block edit history
- `POST /api/debug/console-logs` - Mobile console log forwarding (debug)

**WebSocket Endpoints:**
- `WS /api/collab/:script_id` - Real-time collaboration

**Script Management (`/api/s` prefix):**
- `POST /api/s/upload` - Upload .docx files
- `POST /api/s/create_script_from_parsed` - Create script from AI analysis
- Various sharing and thumbnail endpoints

## Security & HTTPS Setup

### HTTPS Configuration

The application includes comprehensive HTTPS support:

**Certificate Management:**
- `./generate-ssl-certs-domain.sh` - Generates self-signed certificates with SAN support
- `./setup-https.sh` - Automated HTTPS setup script
- Supports custom domains with proper certificate generation

**Security Headers:**
- Strict Transport Security (HSTS)
- Content Security Policy headers
- XSS Protection
- Content Type sniffing protection
- Referrer Policy

**Mixed Content Prevention:**
- Frontend configured to use HTTPS API base URL
- All API calls routed through HTTPS nginx proxy
- WebSocket connections use WSS (secure WebSocket)

### Production Deployment

For production, replace self-signed certificates with proper SSL certificates:

**Let's Encrypt (Recommended):**
```bash
sudo certbot certonly --standalone -d yourdomain.com
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem frontend/ssl/certs/server.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem frontend/ssl/private/server.key
```

## Troubleshooting Common Issues

### "Not Secure" Browser Warning
- **Cause**: Self-signed certificates for development
- **Solution**: Click "Advanced" → "Proceed to site" in browser
- **Production Fix**: Use proper SSL certificates from trusted CA

### Login Not Working
- **Check**: Backend container is running (`docker-compose ps`)
- **Check**: API endpoints accessible (`curl -i http://localhost:3001/login`)
- **Check**: Frontend proxy configuration in `frontend/nginx-https.conf`
- **Check**: CORS origins include your domain in environment variables

### Mixed Content Errors
- **Cause**: HTTPS frontend trying to access HTTP backend directly
- **Solution**: Ensure `VITE_API_BASE_URL` uses HTTPS frontend proxy
- **Fix**: Update environment variables and rebuild frontend

### WebSocket Connection Issues

**Common WebSocket Problems:**

1. **Chrome WebSocket Protocol Errors**
   - **Problem**: Chrome has stricter WebSocket protocol handling than Firefox
   - **Symptoms**: WebSocket connections work in Firefox but fail in Chrome
   - **Solution**: Backend removes strict protocol requirements for Chrome compatibility
   - **Fix**: Use flexible protocol negotiation in WebSocket upgrade handler

2. **Mobile Browser WebSocket Failures**
   - **Problem**: Mobile browsers can't connect to `localhost` WebSocket URLs
   - **Symptoms**: Desktop works, mobile shows continuous connection errors
   - **Solution**: Use actual IP address in `VITE_WS_BASE_URL`
   - **Fix**: Set `APP_HOSTNAME` to network IP (e.g., `192.168.2.111`)

3. **Authentication Token Issues**
   - **Problem**: WebSocket authentication fails with "Invalid token" errors
   - **Symptoms**: Token works for API calls but not WebSocket connections
   - **Solution**: Ensure token trimming removes trailing whitespace/slashes
   - **Fix**: Clean token before WebSocket connection: `token.trim().trim_end_matches('/')`

4. **Browser-Specific Connection Handling**
   - **Chrome/Safari**: Require manual URL construction with token in query string
   - **Firefox**: Use standard y-websocket parameter-based authentication
   - **Mobile**: Need IP address access and shorter timeout configurations

**WebSocket Troubleshooting Commands:**
```bash
# Check WebSocket endpoint accessibility
curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://your-ip:8080/api/collab/test-script-id

# Monitor WebSocket connections in backend logs
docker-compose logs backend --tail=50 -f | grep -i websocket

# Test mobile WebSocket connection
# Access mobile test page: http://your-ip:8080/mobile-test.html
```

**Environment Variable Debugging:**
```bash
# Check current WebSocket URL in container
docker-compose exec frontend env | grep VITE_WS_BASE_URL

# Should show your IP address, not localhost:
# VITE_WS_BASE_URL=ws://192.168.2.111:8080/api/collab
```

**Advanced WebSocket Debugging:**
- **Check**: WebSocket endpoint uses `wss://` for HTTPS
- **Check**: Authentication token is valid and properly trimmed
- **Check**: CORS origins include WebSocket upgrade origins
- **Check**: Mobile browsers use IP address, not localhost
- **Check**: Browser-specific WebSocket configuration is applied
- **Check**: Network policies don't block WebSocket connections

### Container Communication
- **Internal**: Containers communicate via Docker network (e.g., `backend:3001`)
- **External**: Access via exposed ports (e.g., `localhost:8443`)
- **Debugging**: Use `docker-compose logs [service]` to check container logs

## Feature Checklist

Here's a summary of the currently implemented features:

*   [x] User Registration & Login (JWT based)
*   [x] Secure Password Storage (Argon2)
*   [x] Create, List, and Edit Script Titles
*   [x] Upload `.docx` Script Files
*   [x] AI-Powered Script Analysis & Structuring (via Google Gemini)
*   [x] Real-time Collaborative Text Editing (using Tiptap & Yjs)
*   [x] Real-time Presence/Cursor Display
*   [x] Basic Rich Text Formatting (Bold, Italic, Headings, Alignment, Color)
*   [x] Offline Document Caching & Syncing (via IndexedDB & WebSockets)
*   [x] WebSocket Connection Management (with status indicators & retry)
*   [x] View Block Edit History (API endpoint available)
*   [x] Dockerized Environment (Backend, Frontend, DB, Nginx)
*   [x] Pre-configured Development User (`admin@pessoa.de`)
*   [x] Basic Theme Switching Foundation (React Context + CSS Variables)
*   [x] Initial Support for Structured Block Types in Editor (Character, Dialogue, Stage Direction)
*   [x] PostgreSQL Database Backend
*   [x] Structured Data Storage (Scripts, Blocks, Users, Edits)
*   [x] Web-Based GUI (React + TypeScript)
*   [x] Rich Text Editor Interface (Tiptap)
*   [x] HTTPS/SSL Support with Self-Signed Certificates
*   [x] Nginx Reverse Proxy with Security Headers
*   [x] Custom Domain Support
*   [x] Mixed Content Prevention
*   [x] API Endpoint Proxy Configuration
*   [x] Automated SSL Certificate Generation
*   [x] Production-Ready Security Configuration
*   [x] Mobile Browser Compatibility (Chrome, Safari, Firefox, Brave)
*   [x] Mobile Console Forwarding & Debugging System
*   [x] Browser-Specific WebSocket Handling (Chrome vs Firefox)
*   [x] IP Address Resolution for Mobile Access
*   [x] Mobile-Optimized WebSocket Configuration
*   [x] Advanced Mobile Debugging Test Page

### 🆕 **Recent Editor Refactoring (2024)**
*   [x] **Modular Editor Architecture**: Complete refactoring of the editor into organized, maintainable modules
*   [x] **Responsive Design System**: DIN A4 proportional scaling that maintains consistent line breaks across all devices
*   [x] **Mobile-First Optimization**: Proper responsive design that eliminates horizontal scrolling on mobile devices
*   [x] **Consolidated CSS Architecture**: Single source of truth for styles with CSS custom properties and design tokens
*   [x] **TypeScript Type Safety**: Comprehensive type definitions for all editor components and hooks
*   [x] **Custom React Hooks**: Modular hooks for responsive design, editor core, and collaboration management
*   [x] **Component-Based UI**: Reusable UI components with proper prop typing and documentation
*   [x] **Best Practices Implementation**: Clean code architecture following React and TypeScript best practices

## 📐 **Editor Architecture & Mobile Optimization**

### **The DIN A4 Mobile Challenge**
The Pessoa editor faced a critical challenge: maintaining consistent line breaks between desktop and mobile while preserving DIN A4 formatting proportions. Previous solutions with aggressive CSS word-breaking destroyed the scriptwriting format integrity.

### **Refactored Architecture Solution**
The 2024 refactoring solved this through a comprehensive responsive design system:

```
frontend/src/components/editor/
├── components/           # UI Components
│   ├── Editor.tsx       # Main orchestrator component
│   ├── page/            # Page layout components
│   ├── toolbar/         # Floating toolbar system
│   └── ui/              # Reusable UI components
├── hooks/               # Custom React hooks
│   ├── useResponsiveDesign.ts    # Viewport & device detection
│   ├── useEditorCore.ts          # Core editor with Yjs/TipTap
│   └── useEditorInstance.ts      # Editor instance management
├── styles/              # Consolidated CSS system
│   ├── variables.css    # Design tokens & CSS custom properties
│   ├── responsive.css   # DIN A4 proportional scaling
│   └── toolbar.css      # Floating toolbar styles
├── types/               # Comprehensive TypeScript definitions
├── config/              # Configuration constants
└── extensions/          # TipTap extensions
```

### **Key Responsive Design Features**

**DIN A4 Proportional Scaling:**
- Maintains 1:1.414 aspect ratio across all screen sizes
- Uses `clamp()` functions for fluid typography and spacing
- Preserves line break consistency through proportional font scaling

**Mobile-First Breakpoint System:**
- **Mobile (0-767px)**: Full viewport utilization, touch-optimized
- **Tablet (768-1023px)**: Scaled DIN A4 with optimized padding
- **Desktop (1024px+)**: Full DIN A4 dimensions (21cm × 29.7cm)

**CSS Custom Properties:**
```css
:root {
  --page-width: clamp(300px, 85vw, 21cm);
  --page-height: calc(var(--page-width) * 1.414);
  --font-size-base: clamp(15px, 2.2vw, 16px);
  --content-padding-x: clamp(12px, 4vw, 1.5cm);
}
```

**TypeScript Type Safety:**
- Comprehensive type definitions for all components
- Proper integration with existing Pessoa infrastructure
- Type-safe responsive configuration and dimension management

### **Integration with Existing Pessoa Systems**
The refactoring maintains full compatibility with:
- **Authentication**: Uses existing `AuthContext` for user management
- **Collaboration**: Integrates with established Yjs/WebSocket infrastructure  
- **API Layer**: Maintains existing script management endpoints
- **Component System**: Works with existing `Header` and layout components

This architectural approach solved the mobile line break issue while establishing a maintainable, scalable foundation for future editor enhancements.

## Contributing

Pull requests are welcome! Please open an issue first to discuss significant changes.

For instructions on setting up a local development environment (without Docker, using Node.js and Rust directly), please refer to the [`doc/ADVANCED_README.md`](doc/ADVANCED_README.md).

## License

This project is licensed under the MIT License – see the `LICENSE` file for details.

---

📱 **Mobile Browser Support**: Pessoa now includes comprehensive mobile browser compatibility with advanced debugging capabilities. For mobile development and troubleshooting, see the [Mobile Browser Compatibility & Debugging](#mobile-browser-compatibility--debugging-) section above.

🔧 **Recent Updates**: Enhanced WebSocket handling, Chrome compatibility fixes, and mobile debugging system for improved real-time collaboration across all devices.
