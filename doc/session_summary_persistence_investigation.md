# Pessoa Persistence Investigation Summary

## Session Date: January 2025

### Initial Problem
Database entries only appeared after leaving the editor and reopening it, despite WebSocket synchronization working properly for real-time collaboration.

### Investigation Process

1. **Examined the data flow**: WebSocket → yjs_document_updates table → Snapshot Service → blocks table
2. **Discovered snapshot timing issue**: Updates were only processed every 60 seconds
3. **Improved timing**: Reduced to 500ms intervals for near real-time updates
4. **Found fragment mismatch**: Frontend used 'default', backend expected 'content'
5. **Fixed compatibility**: Backend now handles both fragment names
6. **Identified root cause**: Initial document structure not syncing properly

### Key Findings

#### ✅ What Was Already Working
- Yjs binary updates saved immediately (< 1ms)
- Real-time collaboration between users
- Backend correctly decodes Yjs updates (verified with tests)
- WebSocket connection and authentication

#### ❌ The Real Issue
Not a timing problem, but a **document initialization problem**:
- When creating a new document, the initial structure isn't synchronized
- Backend receives updates but sees an empty document structure
- Only works after reload because the initialization code runs differently

### Changes Made

1. **Snapshot Service Timing**:
   - Interval: 10s → 2s → **500ms** 
   - Eligibility: 60s → 10s → **1s**
   - Result: ~0.5-1s delay instead of ~60s

2. **Fragment Compatibility**:
   - Backend now checks for both 'default' and 'content' fragments
   - Frontend simplified to use Tiptap's default configuration

3. **Logging & Debugging**:
   - Added hex logging for WebSocket binary messages
   - Added Yjs document structure inspection
   - Created test to verify Yjs decoding works

### Performance Impact

With 500ms snapshots:
- Slightly higher CPU usage (2x/second document reconstruction)
- More database writes (but still batched, not per-keystroke)
- Acceptable for most use cases
- Can be adjusted if needed (750ms or 1s still very responsive)

### Next Steps

1. **Fix Initial Sync**: Ensure the initial document structure (empty paragraph) is synchronized when a new editor is created
2. **Consider Event-Driven Snapshots**: Trigger on user disconnect, inactivity, or update count
3. **Optimize Snapshot Process**: Only process recently updated scripts
4. **Monitor Performance**: Watch CPU/DB load in production

### Technical Details

The Yjs document structure mismatch was subtle:
- Tiptap creates: `Y.Doc → XmlFragment('default') → paragraph elements`
- Backend expects: Same structure, but wasn't receiving the initial empty paragraph
- Solution: Ensure initial `transact()` operations trigger sync

### Lessons Learned

1. Real-time collaboration systems have multiple layers of state
2. Timing improvements can mask deeper structural issues
3. Comprehensive logging is essential for debugging binary protocols
4. Version compatibility between Yjs implementations is critical

### Code References

- Main changes: `backend/src/snapshotting_service.rs`, `backend/src/main.rs`
- Frontend adjustments: `frontend/src/components/Editor.tsx`
- Documentation: `doc/persistence_improvements.md`
- Test added: `backend/src/test_yjs.rs` 