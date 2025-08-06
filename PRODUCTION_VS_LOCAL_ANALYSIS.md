# Production vs Local Environment Analysis

## Executive Summary
The backend Docker images are IDENTICAL (same image ID: 9e4bb2647985), yet production crashes with memory allocation errors while local handles the same counter gap successfully.

## Critical Findings

### 1. Port Configuration Issue (FIXED)
- **Problem**: Caddy was configured to proxy to backend:3001, but backend runs on 3000
- **Fixed**: Updated Caddyfile and .env.mylayer to use port 3000

### 2. Identical Backend Code
- **Local backend image**: 9e4bb2647985 (16 hours old)
- **Production backend image**: 9e4bb2647985 (same!)
- **Conclusion**: The issue is NOT in the backend code itself

### 3. Key Environmental Differences

#### Network Path
| Aspect | Local | Production |
|--------|-------|------------|
| Connection | Direct to backend:3000 | Via Caddy proxy |
| Protocol | ws:// | wss:// (TLS) |
| Network | Host network | Docker bridge (pessoa-network) |
| Buffering | None | Disabled (flush_interval -1) |

#### Caddy WebSocket Configuration
```
reverse_proxy backend:3000 {
    header_up Upgrade {header.Upgrade}
    header_up Connection {header.Connection}
    flush_interval -1  # Disable buffering
    transport http {
        read_timeout 24h
        write_timeout 24h
    }
}
```

#### Memory Limits (Same)
- Both environments: 2GB limit, 512MB reservation
- Backend handles it fine locally but crashes in production

## The Real Problem

Since the backend code is identical, the issue must be in how Yjs updates reach the backend:

### Theory 1: WebSocket Frame Fragmentation
Caddy might be fragmenting or reassembling WebSocket frames differently, causing the Yjs decoder to see the updates in a different order or structure.

### Theory 2: Timing/Buffering
Even with `flush_interval -1`, Caddy's proxy layer introduces timing differences that might affect how quickly updates are processed.

### Theory 3: Binary Data Corruption
The WebSocket proxy might be corrupting binary data in specific cases, causing the Yjs decoder to misinterpret the update and attempt massive memory allocation.

### Theory 4: Update Batching
Production updates might arrive in different batches through Caddy, triggering different code paths in the Yjs processor.

## Evidence Supporting Proxy Issue

1. **Same code, different behavior**: Identical Docker images behave differently
2. **Memory allocation only in production**: The 16GB allocation attempt only happens behind Caddy
3. **Counter gap exists in both**: Both environments have the missing counter 01
4. **Local processes successfully**: Local backend handles the gap without issues

## Recommended Solutions

### Immediate Fix (Workaround)
1. Increase production memory limit temporarily to 20GB
2. Or bypass Caddy for WebSocket connections (direct port exposure)

### Proper Fixes

#### Option 1: Fix Caddy WebSocket Handling
```caddyfile
handle /api/collab {
    reverse_proxy backend:3000 {
        # More explicit WebSocket configuration
        header_up Upgrade websocket
        header_up Connection upgrade
        header_up Sec-WebSocket-Version 13
        
        # Ensure binary frames aren't modified
        flush_interval -1
        buffer_requests off
        
        # Increase buffer sizes
        transport http {
            read_buffer_size 64KB
            write_buffer_size 64KB
        }
    }
}
```

#### Option 2: Direct WebSocket Port
Expose WebSocket on a separate port bypassing Caddy:
```yaml
backend:
  ports:
    - "3001:3001"  # Direct WebSocket port
```

#### Option 3: Use Different Proxy
Replace Caddy with nginx or Traefik for WebSocket handling.

## Testing Strategy

1. **Test with increased memory**: Temporarily set 20GB limit in production
2. **Test direct connection**: Expose backend port directly, bypass Caddy
3. **Monitor WebSocket frames**: Log frame sizes and timing in both environments
4. **Compare update sequences**: Log exact update order and timing

## Next Steps

1. Deploy the port 3000 fix
2. Test if issue persists
3. If yes, try direct WebSocket port bypass
4. Implement proper fix in frontend to prevent counter gaps