# Chrome WebSocket Issue Fix for Pessoa YJS Collaboration

## Problem Description

The real-time YJS collaborative editing feature works in Firefox but fails in Chrome. This is a common issue due to Chrome's stricter WebSocket protocol handling and security policies.

## Root Causes

1. **Protocol Negotiation**: Chrome is more strict about WebSocket protocol negotiation
2. **Security Policies**: Chrome enforces stricter CORS and security policies
3. **Mixed Content**: Chrome blocks mixed HTTP/HTTPS content more aggressively
4. **WebSocket Implementation**: Chrome's WebSocket implementation differs from Firefox

## Solution Overview

I've implemented a comprehensive fix that includes:

1. **Frontend Changes**: Browser-specific WebSocket handling
2. **Backend Changes**: Flexible protocol negotiation
3. **Debug Tools**: Comprehensive diagnostics

## Changes Made

### 1. Frontend Changes (`frontend/src/components/editor/hooks/useYjsConnection.ts`)

- Added Chrome browser detection
- Implemented Chrome-specific WebSocket configuration
- Added fallback protocol negotiation
- Enhanced error handling with browser-specific messages

### 2. Backend Changes (`backend/src/ws.rs`)

- Removed strict protocol requirement
- Made WebSocket upgrade more flexible
- Improved Chrome compatibility

### 3. Debug Tools

- **Debug Script**: `frontend/src/debug-chrome.ts`
- **Test Page**: `frontend/src/chrome-websocket-test.html`
- **Console Debugging**: Available in development mode

## How to Test the Fix

### Option 1: Use the Standalone Test Page

1. Open `frontend/src/chrome-websocket-test.html` in your browser
2. Enter your configuration:
   - Base URL: `https://localhost:8443` (or your domain)
   - Script ID: Any test script ID
   - Token: Your JWT token (get from browser dev tools)
3. Click "Run All Tests"

### Option 2: Use Browser Console Debugging

1. Open your application in Chrome
2. Open Developer Tools (F12)
3. Go to Console tab
4. Run: `debugChromeWebSocket('your-script-id', 'your-token', 'https://localhost:8443')`

### Option 3: Check Application Logs

1. Open your application in Chrome
2. Open Developer Tools (F12)
3. Go to Console tab
4. Look for logs starting with `[Editor]` or `Browser info:`

## Common Issues and Solutions

### Issue 1: Protocol Negotiation Failure

**Symptoms:**
- WebSocket connection fails immediately
- Error: "WebSocket connection failed"
- Chrome shows protocol errors

**Solution:**
- The fix now tries connection without explicit protocol first
- Falls back to `yjs-ws` protocol if needed
- Backend accepts connections without protocol requirement

### Issue 2: CORS/Security Policy

**Symptoms:**
- "Access denied" errors
- "Origin not allowed" errors
- Connection fails during handshake

**Solution:**
- Ensure your domain is in `ALLOWED_ORIGINS` environment variable
- Use HTTPS/WSS for secure contexts
- Check nginx CORS configuration

### Issue 3: Mixed Content

**Symptoms:**
- "Mixed content" errors in Chrome
- WebSocket connection blocked
- Works in Firefox but not Chrome

**Solution:**
- Use HTTPS for the application
- Ensure WebSocket uses WSS protocol
- Check `isSecureContext` in browser

## Environment Configuration

Ensure these environment variables are set correctly:

```bash
# Frontend
VITE_WS_BASE_URL=wss://your-domain.com:8443/api/collab

# Backend
ALLOWED_ORIGINS=https://your-domain.com:8443,https://localhost:8443
```

## Verification Steps

1. **Start the application**:
   ```bash
   docker-compose up --build
   ```

2. **Test in Chrome**:
   - Open https://localhost:8443
   - Login with: `admin@pessoa.de` / `PassoaDevteam`
   - Create or open a script
   - Check console for connection logs

3. **Test in Firefox** (for comparison):
   - Open the same URL in Firefox
   - Login and test collaboration
   - Compare behavior

## Debug Output

Look for these log messages in the browser console:

### Success (Chrome):
```
✅ Chrome browser detected
🔌 Connecting to WebSocket: wss://localhost:8443/api/collab/script-id
✅ Chrome: WebSocket provider created without explicit protocol
📦 WebSocket status: connected
```

### Failure (Chrome):
```
❌ Chrome browser detected
🔌 Connecting to WebSocket: wss://localhost:8443/api/collab/script-id
❌ Chrome: Failed to create WebSocket provider without protocol
❌ Chrome: Failed to create WebSocket provider with protocol
❌ Chrome WebSocket connection failed
```

## Troubleshooting Steps

1. **Check Browser Console**:
   - Look for WebSocket errors
   - Check network tab for failed connections
   - Verify token authentication

2. **Test Basic Connectivity**:
   ```bash
   # Test if backend is running
   curl -I https://localhost:8443/api/scripts
   
   # Test WebSocket endpoint
   wscat -c wss://localhost:8443/api/collab/test-id?token=your-token
   ```

3. **Compare Browsers**:
   - Test same script in Firefox
   - Compare console logs
   - Check if issue is Chrome-specific

4. **Check Server Logs**:
   ```bash
   docker-compose logs backend | grep -i websocket
   ```

## Advanced Debugging

For deeper debugging, use the Chrome WebSocket test tool:

1. Open `frontend/src/chrome-websocket-test.html`
2. Enter your configuration
3. Run comprehensive tests
4. Check detailed results and logs

## When to Use This Fix

- YJS collaboration works in Firefox but not Chrome
- WebSocket connection errors in Chrome console
- Protocol negotiation failures
- Mixed content warnings related to WebSocket

## Recovery Steps

If the fix doesn't work:

1. **Revert to Firefox**: Use Firefox as a temporary workaround
2. **Check Token**: Ensure JWT token is valid and not expired
3. **Restart Services**: Restart backend and frontend containers
4. **Clear Cache**: Clear browser cache and cookies
5. **Check Logs**: Review both frontend and backend logs

## Additional Resources

- [Chrome WebSocket API Documentation](https://developer.chrome.com/docs/web-platform/websockets/)
- [YJS WebSocket Provider Issues](https://github.com/yjs/y-websocket/issues)
- [Pessoa Advanced README](doc/ADVANCED_README.md)

## Contact

If you continue to experience issues after trying these solutions, please:

1. Run the debug tools and collect logs
2. Test in both Chrome and Firefox
3. Check server logs for WebSocket errors
4. Provide browser version and OS information 