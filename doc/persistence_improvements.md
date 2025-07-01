# Persistence Improvements for Pessoa

## Current State
- Yjs updates are saved immediately (within milliseconds)
- Blocks table is updated via snapshots every ~1 minute
- This creates a delay between collaborative state and structured data

## Implemented Quick Fix

### Version 1 (Initial improvement):
I've made the following changes to reduce the delay:
1. Snapshot service now runs every 2 seconds (was 10)
2. Scripts are eligible for snapshot after 10 seconds (was 1 minute)

This reduced the maximum delay from ~1 minute to ~10 seconds.

### Version 2 (Near real-time - Current):
To achieve near real-time updates:
1. Snapshot service now runs every **500ms** (0.5 seconds)
2. Scripts are eligible for snapshot after just **1 second**

This reduces the maximum delay to ~1.5 seconds, with typical delays of 0.5-1 second.

## Critical Issue Found: Empty Content Fragment

### The Problem
After extensive investigation, I discovered that while Yjs updates ARE being saved immediately, the backend cannot extract blocks because:

1. **The frontend is configured to use 'default' fragment** - Tiptap's default configuration
2. **The backend is looking for both 'default' and 'content'** - Fixed to handle both
3. **Empty documents aren't being initialized properly** - The real issue!

When you start typing in a fresh editor:
- Tiptap sends binary Yjs updates 
- Backend saves them successfully
- BUT: The Yjs document structure isn't properly initialized
- Result: No blocks can be extracted until you reload

### Why It Works After Reload
When you leave and return to the editor, the initialization code explicitly:
1. Creates the XmlFragment ('default' or 'content')
2. Populates it with proper paragraph structure
3. This allows the backend to extract blocks correctly

## Recommended Solution

### The Real Fix: Initialize Yjs Document Structure Properly

The issue is NOT with persistence timing - it's with document initialization. We need to ensure that when a fresh editor is created, it properly initializes the Yjs document structure that the backend expects.

#### Frontend Changes Needed:
1. When creating a new document, ensure the Yjs doc has the proper structure
2. Initialize with at least one paragraph element
3. Ensure the Collaboration extension properly syncs this initial state

## Performance Considerations

With 500ms intervals:
- CPU usage will increase (document reconstruction 2x per second)
- Database writes increase (more frequent snapshot updates)
- Still much more efficient than per-keystroke updates
- Acceptable for most use cases

## Future Improvements to Consider

### 1. Event-Driven Snapshots
Instead of only time-based snapshots, trigger them on:
- User disconnect from a script
- After N updates accumulate (e.g., 50 updates)
- When no activity for X seconds
- On-demand when blocks are requested

### 2. Optimize the Snapshot Process
- Only process scripts with recent updates
- Cache parsed Yjs documents
- Use database transactions for batch updates

### 3. WebSocket Protocol Enhancement
Consider implementing the y-websocket sync protocol properly to ensure initial document state is synchronized correctly between frontend and backend.

## Trade-offs Analysis

### Current Approach (Async Queue + Snapshots)
**Pros:**
- ✅ High performance for real-time collaboration
- ✅ Handles high concurrency well
- ✅ Full history preserved
- ✅ Resilient to failures

**Cons:**
- ❌ Eventual consistency (10+ second delay)
- ❌ Complex architecture
- ❌ CPU intensive (frequent document reconstruction)

### Direct Updates Approach
**Pros:**
- ✅ Immediate consistency
- ✅ Simpler conceptually

**Cons:**
- ❌ Would block WebSocket performance
- ❌ Difficult to map Yjs updates to SQL updates
- ❌ Risk of data inconsistency
- ❌ Doesn't scale well

## Recommendation

Keep the current architecture but optimize it:

1. **Short term** (Done): Reduce snapshot intervals to 2-10 seconds
2. **Medium term**: Add event-driven snapshot triggers
3. **Long term**: Implement read-through cache for on-demand block generation

The current architecture is sound for a collaborative editing system. The delay is a reasonable trade-off for the benefits it provides. With the implemented changes, the delay is now minimal (10 seconds max) while maintaining all the architectural benefits.

## Implementation Notes

To further reduce the interval, you could change:
- `backend/src/main.rs`: `Duration::from_secs(1)` for 1-second checks
- `backend/src/snapshotting_service.rs`: `INTERVAL '5 seconds'` for 5-second eligibility

However, be mindful of:
- CPU usage from frequent document reconstruction
- Database write load
- Diminishing returns below 5-10 second delays

## Next Steps
1. Debug what Tiptap actually puts in the Yjs document
2. Consider migrating to a more reliable persistence strategy
3. Add better error handling and logging for Yjs operations

The current implementation is architecturally sound, but there's a fundamental mismatch between how Tiptap structures Yjs documents and what the backend expects. 