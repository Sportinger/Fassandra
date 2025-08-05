The Core Problem
  Your production backend keeps crashing with massive memory allocation errors (9.35GB,
  14.4GB, 17.3GB, up to 33.6GB) when processing Yjs collaborative editing updates. This
  only happens in production, not in local development.
  What We've Discovered
  1. Root Cause: Corrupted Yjs binary frames are being stored in the database, likely
  due to WebSocket frame corruption during transmission through nginx proxy layers.
  2. Why Production Only: Local development connects directly to the backend (no nginx
  proxy), while production has nginx reverse proxy that was misconfigured in several
  ways.
  Everything We've Tried
  1. Fixed Double-Proxying Issue
  - Problem: Requests were going: Browser → Main nginx → Frontend nginx → Backend
  - Fix: Removed API proxying from frontend nginx.conf
  - Result: Still had issues
  2. Fixed Missing Auth Routes
  - Problem: Main nginx was missing /login, /register, /health endpoints
  - Fix: Added proper location blocks in nginx-mylayer-prod.conf
  - Result: 405 errors fixed, but memory issues persisted
  3. Removed Nginx Buffer Settings
  - Problem: Buffer settings can corrupt WebSocket frame boundaries
  - Fix: Removed all buffer configurations for WebSocket endpoints
  - Result: Still had corruption with multiple devices
  4. Disabled HTTP/2
  - Problem: HTTP/2 multiplexing was interfering with WebSocket frames when multiple
  clients connected
  - Fix: Changed from listen 443 ssl http2; to listen 443 ssl;
  - Result: Multi-device issues improved but single browser still crashes
  5. Database Cleanup (Multiple Times)
  - Deleted corrupted scripts and Yjs updates
  - Most recently deleted script e1f153ce-b4fc-428e-a97f-1c194e4f53cc
  - Database is now completely empty
  - Backend was trying to process phantom scripts even after deletion
  6. Backend Code Fixes
  - Commented out validate_state_vector call that was causing compilation errors
  - Added TODO for proper state vector validation
  Current Status
  - Database is completely empty
  - Backend restarted and currently stable
  - No active memory allocation errors
  - But as soon as you write something, the errors return
  Nginx Configuration Changes Applied
  # Key changes made:
  1. Removed HTTP/2: listen 443 ssl; (not http2)
  2. Disabled all buffering for WebSocket
  3. Added all auth endpoints
  4. Increased timeouts for long-lived connections
  5. Proper WebSocket upgrade headers
  What's Still Puzzling
  1. Even with all nginx fixes, new Yjs updates are getting corrupted
  2. The backend's snapshotting service was trying to process non-existent scripts
  3. The corruption happens immediately when you start typing
  Possible Next Steps
  1. Check client-side: The frontend might be sending malformed Yjs updates
  2. Add validation: Implement proper Yjs update validation before storing
  3. Check Yjs versions: Ensure client and server Yjs libraries are compatible
  4. Add logging: Log the raw WebSocket frames to see where corruption occurs
  5. Test without nginx: Temporarily expose backend directly to confirm nginx is the
  issue
  The key insight is that this is definitely related to the nginx proxy layer since it
  works perfectly in local development without nginx.
Bearbeiten

The user is describing a complex production issue with Yjs collaborative editing causing memory allocation errors. They've done extensive debugging and made multiple nginx configuration changes. They're asking about their earlier comment about HTTP/2 multiplexing causing WebSocket frame mixing between different client connections.

Looking at their debugging steps, they disabled HTTP/2 and mentioned "HTTP/2 multiplexing was interfering with WebSocket frames when multiple clients connected" and that "Multi-device issues improved but single browser still crashes".

This suggests they may have misunderstood the issue. HTTP/2 multiplexing doesn't mix frames between different clients (as I explained earlier), but there could be other issues with HTTP/2 and WebSockets. Let me address their specific scenario.

Looking at your debugging journey, I can see why you might have thought HTTP/2 multiplexing was mixing frames between clients, but that's not what was happening. Let me explain what was likely occurring:
Why Disabling HTTP/2 Helped (But Not For The Reason Stated)

When you disabled HTTP/2 and saw improvement with multi-device issues, the real reasons were likely:

    WebSocket Fallback Issues: With HTTP/2 enabled, your WebSocket connections were probably falling back to HTTP/1.1 in an inconsistent way, potentially causing connection state issues
    Proxy Protocol Confusion: Nginx might have been mishandling the protocol negotiation between HTTP/2 and HTTP/1.1 WebSocket upgrades, especially with multiple proxy layers
    Connection Pooling: Some proxies handle HTTP/2 connection pooling differently, which could affect how WebSocket connections are established and maintained

The Real Culprits in Your Case

Based on your extensive debugging, the issues appear to be:

    Frame Boundary Corruption: Your nginx buffer settings were likely splitting WebSocket frames at arbitrary points, corrupting the Yjs binary data
    Double Proxying: The Browser → Main nginx → Frontend nginx → Backend chain was probably mangling WebSocket frames at each hop
    Binary Data Handling: Yjs uses binary frames that are particularly sensitive to proxy misconfigurations

Why Your Comment Was Misleading

Your original statement about "WebSocket frames getting mixed between different client connections" isn't technically possible with HTTP/2, but I understand why the symptoms looked that way. What was probably happening:

    Multiple clients connecting simultaneously exposed timing/buffering issues in nginx
    These issues corrupted frames differently depending on connection timing
    This made it appear like client data was getting mixed, when actually each client's data was being independently corrupted

Moving Forward

Since you've already cleaned up most nginx issues but still see corruption, I'd focus on:

    Binary Frame Validation: Add checksums or length validation for Yjs updates before storage
    Direct WebSocket Path: Consider bypassing nginx entirely for WebSocket connections (e.g., separate WebSocket port)
    Frame Logging: Log the exact byte sequences at each layer to pinpoint where corruption occurs

The fact that it works locally without nginx strongly suggests the remaining issue is still in the proxy layer, not HTTP/2 multiplexing mixing client data.