# ScriptList Component Breakdown Plan

## Current State Analysis
- **File**: `/src/components/ScriptList.tsx`
- **Lines**: 1,065 (!)
- **State Variables**: 18+ useState hooks
- **Responsibilities**: 10+ different concerns mixed together

## Problems Identified

### 1. Massive State Management (18 state variables)
```typescript
- scripts, loading, error (data fetching)
- newScriptName, addSlotState (creation)
- deletingScriptId, confirmDelete, isDeleteModalClosing (deletion)
- sharingScript, shareUsername, sharePermission, scriptShares, sharingLoading (sharing)
- openMenuId, renamingScriptId, renameValue (UI interactions)
- isExiting (animations)
- uploadStates (via hook)
```

### 2. Mixed Responsibilities
1. **Data fetching** - API calls for scripts
2. **Upload management** - File uploads with progress tracking
3. **Sharing modal** - Complex sharing UI with permissions
4. **Delete modal** - Confirmation dialog
5. **Rename inline editing** - In-place editing
6. **Script creation** - New script flow
7. **WebSocket management** - Claude session handling
8. **Menu dropdowns** - Context menus for each card
9. **Error handling** - Multiple error states
10. **Loading states** - Various loading indicators

### 3. Memory Leak Sources
- Event listeners without cleanup (line 275)
- WebSocket connections stored on objects
- Session services not properly disposed
- Click outside handlers without removal

## Proposed Component Structure

```
src/
├── components/
│   ├── scripts/                      # New folder for script-related components
│   │   ├── ScriptList/              
│   │   │   ├── index.tsx            # Main container (150 lines max)
│   │   │   ├── ScriptList.module.css
│   │   │   └── types.ts
│   │   │
│   │   ├── ScriptCard/              
│   │   │   ├── index.tsx            # Individual card (100 lines)
│   │   │   ├── ScriptCard.module.css
│   │   │   ├── ScriptCardMenu.tsx   # Dropdown menu
│   │   │   └── ScriptCardBadges.tsx # Public/Shared badges
│   │   │
│   │   ├── ScriptCreator/           
│   │   │   ├── index.tsx            # New script creation (80 lines)
│   │   │   └── ScriptCreator.module.css
│   │   │
│   │   ├── ScriptUploadManager/     
│   │   │   ├── index.tsx            # Upload logic (150 lines)
│   │   │   ├── UploadProgress.tsx   # Progress indicators
│   │   │   └── ClaudeSession.ts     # Session management
│   │   │
│   │   ├── modals/
│   │   │   ├── ShareScriptModal/
│   │   │   │   ├── index.tsx        # Sharing UI (120 lines)
│   │   │   │   ├── ShareForm.tsx
│   │   │   │   └── SharesList.tsx
│   │   │   │
│   │   │   └── DeleteConfirmModal/
│   │   │       └── index.tsx        # Delete confirmation (50 lines)
│   │   │
│   │   └── hooks/
│   │       ├── useScripts.ts        # Data fetching logic
│   │       ├── useScriptActions.ts  # CRUD operations
│   │       └── useScriptMenu.ts     # Menu state management
```

## Implementation Phases

### Phase 1: Extract Modals (2 hours)
1. **ShareScriptModal** component
   - Move lines ~677-773 (share modal JSX)
   - Extract share-related state
   - Create props interface
   - Emit events for actions

2. **DeleteConfirmModal** component
   - Move lines ~614-668 (delete modal JSX)
   - Simple confirmation dialog
   - Callback props for confirm/cancel

### Phase 2: Extract ScriptCard (2 hours)
1. **ScriptCard** component
   - Move lines ~825-919 (card JSX)
   - Props: script, onSelect, onDelete, onShare, onRename
   - No internal state except menu open/close

2. **ScriptCardMenu** sub-component
   - Dropdown menu logic
   - Click outside handling

### Phase 3: Extract Creation & Upload (3 hours)
1. **ScriptCreator** component
   - New script slot UI
   - Name input handling
   - Creation API call

2. **ScriptUploadManager** component
   - Upload state management
   - Progress tracking
   - Claude session handling
   - **Fix memory leaks here**

### Phase 4: Create Container Hooks (2 hours)
1. **useScripts** hook
   - Data fetching
   - Refresh logic
   - Error handling

2. **useScriptActions** hook
   - Delete script
   - Rename script
   - Share script
   - Create script

### Phase 5: Assemble Clean ScriptList (1 hour)
- Wire up all components
- < 200 lines total
- Clear data flow
- Proper cleanup

## Success Metrics

### Before
- 1,065 lines in one file
- 18 state variables
- 10+ responsibilities
- Memory leaks
- Untestable

### After
- No file > 200 lines
- 3-4 state variables per component
- Single responsibility per component
- Proper cleanup
- Fully testable

## Migration Strategy

1. **Create new structure in parallel** - Don't delete old file yet
2. **Test each component in isolation** 
3. **Swap in App.tsx** when ready
4. **Delete old ScriptList.tsx**
5. **Add unit tests** for each new component

## Memory Leak Fixes

### Priority 1: Session Service
```typescript
// BAD - Current code
(placeholder as any).sessionService = sessionService;

// GOOD - New approach
const sessionManager = new SessionManager();
sessionManager.track(scriptId, sessionService);
// In cleanup:
sessionManager.dispose(scriptId);
```

### Priority 2: Event Listeners
```typescript
// Add proper cleanup in useEffect
useEffect(() => {
  const handleClick = (e) => { /* ... */ };
  document.addEventListener('click', handleClick);
  return () => document.removeEventListener('click', handleClick);
}, []);
```

### Priority 3: WebSocket Connections
- Centralize in a WebSocketManager service
- Proper connection pooling
- Cleanup on unmount

## Estimated Time: 10 hours total

But this will:
- Fix production-breaking memory leaks
- Make the code maintainable
- Enable proper testing
- Reduce bundle size
- Improve performance

## File Size Targets
- ScriptList/index.tsx: ~150 lines
- ScriptCard/index.tsx: ~100 lines  
- ShareScriptModal/index.tsx: ~120 lines
- ScriptUploadManager/index.tsx: ~150 lines
- DeleteConfirmModal/index.tsx: ~50 lines
- ScriptCreator/index.tsx: ~80 lines

**Total: ~650 lines across 6+ files instead of 1,065 in one file**