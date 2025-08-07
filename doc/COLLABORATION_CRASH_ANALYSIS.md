# Collaboration-Specific Crash Analysis

## BREAKTHROUGH DISCOVERY 🎉

After fixing the port configuration (3001 → 3000), we've identified the exact trigger:

### Working Scenario ✅
- Single user creates new document
- Single user types and edits
- All updates process successfully
- No memory allocation issues

### Crashing Scenario ❌
- User A creates document (works)
- User A types (works)
- User B opens same document in another tab
- **CRASH**: Backend tries to allocate 16GB when syncing state to User B

## Why This Happens

When a second client connects to an existing document with a counter gap:

1. **Initial Creation** (User A):
   - Creates Y.Doc with counter gap (missing 01)
   - Backend processes updates incrementally
   - Works because updates are processed one-by-one

2. **Sync Request** (User B joins):
   - Backend needs to send full document state to User B
   - Calls `encode_state_as_update_v1()` to create sync message
   - This function tries to reconstruct the ENTIRE state
   - Hits the counter gap and attempts 16GB allocation
   - Crashes with 2GB Docker limit

## The Key Difference

```rust
// Single user - processes updates incrementally
apply_update(&mut doc, &update) // Works even with gap

// Multi-user sync - reconstructs entire state
encode_state_as_update_v1(&doc, &StateVector::default()) // CRASHES on gap
```

## Evidence

1. **Port fix success**: Single-user editing now works perfectly
2. **Collaboration trigger**: Crash only happens when second client connects
3. **Sync-specific**: The crash happens during state synchronization, not update processing

## Why Local Dev Doesn't Crash (Even with Collaboration)

Possible reasons:
1. **Memory availability**: Even with 2GB limit, local might handle it differently
2. **Timing**: Local network is faster, might process differently
3. **State size**: Production might have accumulated more state

## Solutions

### Immediate Workaround
Increase memory to 20GB in production temporarily:
```yaml
deploy:
  resources:
    limits:
      memory: 20G
```

### Proper Fix (Frontend)
Fix the Y.Doc initialization to prevent counter gap:
```typescript
// In yjsDocumentManager.ts
const doc = new Y.Doc();
// Ensure first transaction includes ALL initialization
doc.transact(() => {
  const fragment = doc.getXmlFragment('default');
  // Initialize prosemirror structure
  const pmState = fragment.get('prosemirror');
  // All initialization in ONE transaction
}, 'init');
```

### Proper Fix (Backend)
Add protection in Rust when encoding state:
```rust
// Detect counter gaps before encoding
// Use incremental encoding instead of full state
// Or handle gaps gracefully
```

## Reproduction Steps

1. Deploy with port 3000 fix ✅
2. User A: Create new document ✅
3. User A: Type some text ✅
4. User B: Open same document in new tab ❌ CRASH

## Next Investigation

1. Log the exact sync message size when User B connects
2. Check if awareness updates affect this
3. Test with different document sizes
4. Monitor memory usage during sync

## Temporary Solution

Since single-user works, you could:
1. Temporarily disable real-time collaboration
2. Or increase memory limit to 20GB
3. Or implement a "single-user edit mode" until fixed

This is MAJOR progress - we've isolated the exact trigger!