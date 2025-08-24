# YJS Frontend Debugging Changes

## Summary of Changes

This document outlines the comprehensive logging and debugging changes made to track down issues with YJS document initialization and content updates not being sent to the backend.

## 1. YJS Document Manager Enhanced Logging

**File**: `/frontend/src/services/yjsDocumentManager.ts`

### Added logging for:
- Document creation with `[YJS_DOC_CREATE]` tag
- Client ID generation with `[YJS_CLIENT_ID]` tag
- Field initialization with `[YJS_INIT_FIELD]` and `[YJS_FIELD_CREATED]` tags
- Document updates with `[YJS_UPDATE]` tag including:
  - Update size and first bytes in hex
  - Origin of the update
  - State vector size
  - Default field length and content presence
  - Content preview for small documents
- Subdocument events with `[YJS_SUBDOCS]` tag

## 2. Editor Core Enhanced Logging

**File**: `/frontend/src/components/editor/hooks/useEditorCore.ts`

### Added logging for:
- Editor initialization with `[EDITOR_INIT]` tag
- Document state with `[EDITOR_DOC]` and `[EDITOR_DOC_STATE]` tags
- WebSocket provider creation with `[WS_PROVIDER_CREATE]` and `[WS_PROVIDER_CREATED]` tags
- WebSocket message sending with `[WS_SEND]` tag showing:
  - Message size
  - First bytes in hex
  - Message type
  - Whether it's an awareness update
- WebSocket sync state with `[WS_SYNCED]` and `[WS_SYNCED_CONTENT]` tags
- Editor configuration state with `[EDITOR_CONFIG_STATE]` tag
- Collaboration extension binding with `[COLLAB_BINDING]` tag
- Editor transactions with `[EDITOR_TRANSACTION]` tag
- Forced YJS sync with `[YJS_FORCE_SYNC]` tag

### Error Handling:
- Added global error handlers for YJS decode errors
- Catches both `window.onerror` and `window.onunhandledrejection`
- Logs errors with `[YJS_DECODE_ERROR]` tag

### WebSocket Message Interceptor:
- Intercepts WebSocket send calls to log outgoing messages
- Installs interceptor on connection and logs with `[WS_INTERCEPTOR]` tag

## 3. Content Migration Hook Enhanced Logging

**File**: `/frontend/src/components/editor/hooks/useContentMigration.ts`

### Added logging for:
- Migration checks with `[MIGRATION_CHECK]` tag
- Migration start with `[MIGRATION_START]` tag
- Migration application with `[MIGRATION_APPLY]` tag
- Migration completion with `[MIGRATION_COMPLETE]` tag

## Key Debug Points to Watch

1. **YJS Document Creation**:
   - Look for `[YJS_DOC_CREATE]` to confirm document is created
   - Check `[YJS_FIELD_CREATED]` to ensure 'default' field is initialized

2. **Editor Binding**:
   - Look for `[EDITOR_CREATED]` to confirm editor is created
   - Check `[COLLAB_BINDING]` to verify Collaboration extension found the YJS document

3. **Content Updates**:
   - Watch `[EDITOR_TRANSACTION]` for editor changes
   - Look for `[YJS_UPDATE]` to see if YJS detected the change
   - Check `[WS_SEND]` to verify updates are sent to backend

4. **Common Issues**:
   - If no `[WS_SEND]` logs appear, WebSocket may not be connected
   - If `[YJS_UPDATE]` shows but no `[WS_SEND]`, the WebSocket provider may not be syncing
   - If `[COLLAB_BINDING]` shows no YJS document, the binding failed

## Debugging Steps

1. Open browser console
2. Filter logs by 'yjsDocumentManager' or 'useEditorCore'
3. Type content in the editor
4. Look for the sequence:
   - `[EDITOR_TRANSACTION]` - Editor detected change
   - `[YJS_UPDATE]` - YJS document updated
   - `[WS_SEND]` - Update sent to backend
5. If any step is missing, that's where the issue is

## Expected Log Sequence for Successful Update

1. `[YJS_DOC_CREATE]` - Document created
2. `[YJS_FIELD_CREATED]` - Default field initialized
3. `[WS_PROVIDER_CREATED]` - WebSocket provider ready
4. `[EDITOR_CREATED]` - Editor initialized
5. `[COLLAB_BINDING]` - Collaboration extension bound
6. `[WS_SYNCED]` - WebSocket synchronized
7. User types content...
8. `[EDITOR_TRANSACTION]` - Change detected
9. `[YJS_UPDATE]` - YJS document updated
10. `[WS_SEND]` - Update sent to backend