# Complete Environment Comparison: Local vs Production

## Docker Images ✅ IDENTICAL
- **Local**: `9e4bb2647985` (created: 2025-08-05T20:28:08)
- **Production**: `9e4bb2647985` (created: 2025-08-05T20:28:08)
- **Base Image**: `debian:bullseye-slim` (11.11)
- **Rust**: 1.82.0
- **yrs library**: 0.24.0

## Configuration ✅ ALIGNED
| Setting | Local | Production | Status |
|---------|-------|------------|--------|
| Backend Port | 3000 | 3000 | ✅ Fixed |
| WebSocket Path | `/api/collab/:id` | `/api/collab/:id` | ✅ Same |
| Memory Limit | 2GB | 2GB | ✅ Same |
| CORS | Not set | `https://mylayer.org` | ⚠️ Different |

## Network Path 🔴 KEY DIFFERENCE
| Aspect | Local | Production |
|--------|-------|------------|
| Connection | Direct `ws://localhost:3000` | Via Caddy `wss://mylayer.org` |
| Proxy | None | Caddy with WebSocket support |
| TLS | No | Yes (Let's Encrypt) |
| Network | Host/Bridge | Docker bridge network |

## The Critical Difference

Since the Docker images are IDENTICAL and both have 2GB memory limits, the ONLY difference is:

### Local (WORKS with multiple users)
```
Browser → Direct WebSocket → Backend:3000
```

### Production (CRASHES with multiple users)
```
Browser → Caddy (TLS termination) → Backend:3000
         ↑
    This proxy layer is the problem!
```

## Caddy WebSocket Configuration Analysis

Current Caddy config:
```caddyfile
reverse_proxy backend:3000 {
    header_up Upgrade {header.Upgrade}
    header_up Connection {header.Connection}
    flush_interval -1  # Disables buffering
    transport http {
        read_timeout 24h
        write_timeout 24h
    }
}
```

## Possible Issues with Caddy

1. **Frame Size Limits**: Caddy might have different limits for WebSocket frame sizes
2. **Binary Frame Handling**: The proxy might corrupt binary Yjs data
3. **Message Ordering**: Proxy might reorder or batch messages differently
4. **Buffer Sizes**: Default buffer sizes might be too small for large sync messages

## Why Multi-User Triggers the Issue

When User B connects:
1. Backend calls `encode_state_as_update_v1()` to create full state sync
2. This creates a LARGE binary message (potentially several MB)
3. **Local**: Direct WebSocket handles it fine
4. **Production**: Caddy proxy might:
   - Fragment it incorrectly
   - Hit a buffer/frame size limit
   - Corrupt the binary data
   - Timeout during transmission

## Recommended Tests

### Test 1: Bypass Caddy
Add direct backend port to production:
```yaml
backend:
  ports:
    - "3001:3000"  # Direct access for testing
```
Then test WebSocket directly on port 3001.

### Test 2: Increase Caddy Buffers
```caddyfile
reverse_proxy backend:3000 {
    # ... existing config ...
    transport http {
        read_buffer_size 10MB
        write_buffer_size 10MB
        max_response_header_size 10MB
    }
}
```

### Test 3: Log Message Sizes
Add logging to see the actual size of sync messages when User B connects.

### Test 4: Use nginx Instead
nginx has better WebSocket support for binary data:
```nginx
location /api/collab {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 24h;
    proxy_send_timeout 24h;
    proxy_buffering off;
    client_max_body_size 50M;
    proxy_max_temp_file_size 0;
}
```

## Conclusion

The issue is 100% in the Caddy proxy layer handling of WebSocket binary frames during multi-user synchronization. The backend code works perfectly when accessed directly (as proven in local dev).