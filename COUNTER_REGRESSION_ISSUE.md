# Yjs Counter Regression Issue - Detailed Analysis

## Problem Summary
The application experiences a critical memory allocation failure (attempting to allocate 9.5GB to 16GB of RAM) when the backend proceQsses certain Yjs document updates. This causes the backend container to crash repeatedly.

## Root Cause
The issue is a **counter regression** in Yjs update sequences. When creating a new document, the counter sequence has a gap:
- Update 1: Counter 00 (initial)
- Update 2: Counter 02→03 (MISSING counter 01!)

When the backend's snapshot service tries to process these updates, it attempts to fill the gap by allocating massive amounts of memory, causing the crash.

## Detailed Analysis

### 1. The Counter Gap Pattern
Both documents show the same pattern in their initial updates:

**Document 1 (56fc0431-8639-4bca-bf0d-22199fb64a26):**
```
Update 450: Client e1a9a8810d starts with counter 00
Update 451: Counter jumps from 02→03 (missing 01!)
Update 452: Counter 03→04 (continues normally)
```

**Document 2 (3f4fbf2d-7bde-41e9-8fc0-2b39a0c400e7):**
```
Update 767: Client f1fdc7f705 starts with counter 00  
Update 768: Counter jumps from 02→03 (missing 01!)
```

### 2. Why The Singleton Fix Didn't Work

The singleton document manager IS deployed and working:
- ✅ `yjsDocumentManager.ts` exists and is in the production bundle
- ✅ `YjsDocumentProvider` wraps the app
- ✅ `useEditorCore` uses `yjsDocumentManager.getDocument()`
- ✅ Documents persist across reconnections

**BUT** the issue occurs on INITIAL document creation, not reconnection:
1. When creating a NEW document, even the singleton must create a new `Y.Doc()`
2. Something in the initialization sequence causes counter 01 to be skipped
3. This happens consistently for all new documents

### 3. Why Document 1 "Worked" But Document 2 Crashed

Document 1 appeared to work because:
1. The backend initially processed it when you had deleted the problematic updates
2. Once past the initial updates, subsequent updates had continuous counters
3. The snapshot was successfully created and cached

Document 2 crashed because:
1. It was a fresh document with the counter gap
2. The backend tried to process update 767 (with the gap)
3. The `encode_state_as_update_v1` function tried to fill the gap
4. This triggered the massive memory allocation

### 4. The Real Problem Location

The issue is NOT in reconnection (which the singleton fixes), but in the initial document setup:

```typescript
// In yjsDocumentManager.ts
getDocument(scriptId: string): Y.Doc {
  if (!this.documents.has(scriptId)) {
    const doc = new Y.Doc();  // New document creation
    
    // This initialization might be causing the counter skip
    doc.transact(() => {
      doc.getXmlFragment('default');
    }, 'initializeDefaultFragment');
    
    // ... rest of setup
  }
}
```

### 5. Backend Processing Issue

The backend's Rust Yjs implementation has a bug when processing updates with counter gaps:

```rust
// When it sees counter 00 then 02→03, it tries to:
// 1. Reconstruct the missing state for counter 01
// 2. This causes encode_state_as_update_v1 to allocate huge memory
// 3. The allocation fails and crashes the process
```

## Immediate Workaround

1. **Delete problematic updates from database:**
```sql
-- Find and delete updates with counter gaps
DELETE FROM yjs_document_updates 
WHERE script_id = '3f4fbf2d-7bde-41e9-8fc0-2b39a0c400e7'
AND id IN (767, 768);

-- Reset snapshot processing
DELETE FROM script_snapshots_meta 
WHERE script_id = '3f4fbf2d-7bde-41e9-8fc0-2b39a0c400e7';
```

2. **Restart the backend:**
```bash
docker restart mylayer_pessoa_backend
```

## Permanent Solutions

### Option 1: Fix Frontend Initialization (Recommended)
Ensure the initial document transaction includes all operations atomically:

```typescript
// In yjsDocumentManager.ts
getDocument(scriptId: string): Y.Doc {
  if (!this.documents.has(scriptId)) {
    const doc = new Y.Doc();
    
    // Perform ALL initial operations in a single transaction
    doc.transact(() => {
      const fragment = doc.getXmlFragment('default');
      // Add any other initial setup here
      // This ensures counter continuity
    }, 'initializeDocument');
    
    // Event handlers AFTER initial transaction
    doc.on('update', ...);
  }
}
```

### Option 2: Fix Backend Counter Gap Handling
Add validation in the backend to detect and handle counter gaps gracefully:

```rust
// In yjs_processor_service.rs
// Before calling encode_state_as_update_v1, check for gaps
// If gap detected, skip or handle specially
```

### Option 3: Implement Update Validation
Add validation before saving updates to the database:

```typescript
// Validate update sequence before sending to backend
// Reject or fix updates with counter gaps
```

## Testing the Fix

1. Create a new document
2. Check the update sequence:
```sql
SELECT id, encode(update_data, 'hex') as hex 
FROM yjs_document_updates 
WHERE script_id = 'NEW_SCRIPT_ID' 
ORDER BY id LIMIT 5;
```
3. Verify no counter gaps exist
4. Confirm backend processes without crashing

## Prevention

1. **Monitor for counter gaps:**
   - Add logging to detect gaps early
   - Alert when gaps are detected

2. **Validate updates:**
   - Check counter continuity before database insertion
   - Reject invalid update sequences

3. **Improve error handling:**
   - Catch memory allocation failures
   - Provide better error messages
   - Implement automatic recovery

## Current Status

- ✅ Singleton document manager is deployed and working for reconnections
- ❌ Counter gaps still occur on new document creation
- ❌ Backend crashes when processing updates with counter gaps
- ⚠️ Workaround: Manually delete problematic updates and restart

## Next Steps

1. Investigate why the initial Y.Doc transaction creates a counter gap
2. Fix the initialization sequence to ensure continuous counters
3. Add backend protection against counter gap memory allocation issues
4. Implement monitoring to detect issues early