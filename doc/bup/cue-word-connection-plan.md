# Cue-to-Word Connection Feature Implementation Plan

## Overview
Enable users to connect stage cues (light, sound, video, props) to specific words in the script by dragging cues onto words, creating a visual red bracket connection.

## Requirements
- **Direction**: Cue → Word only (no click-click interaction)
- **Cardinality**: One cue → One word, but one word → Multiple cues
- **Visual**: Red bracket (┐│┘) around connected words
- **Deletion**: Connection removed when text is deleted
- **Interaction**: Always active drag-and-drop
- **Purpose**: Timing cues with specific dialogue/text

## Architecture Changes

### 1. Frontend - TipTap Extensions

#### A. New Mark: `CueConnection`
```typescript
// extensions/CueConnectionMark.ts
- Store cueId, cueType, cueNumber
- Render red bracket around marked text
- Handle multiple cues per word
```

#### B. Enhanced `CueBlock` Extension
```typescript
// extensions/CueBlock.ts modifications
- Add drag event handlers
- Visual feedback during drag (cursor change, highlight)
- Drop zone detection for words
```

#### C. Connection Renderer
```typescript
// components/CueConnectionRenderer.tsx
- Renders bracket using CSS pseudo-elements
- Stacks multiple brackets for words with multiple cues
- Hover shows cue details
```

### 2. Database Schema

#### A. Use Existing Infrastructure
- Store in `blocks.metadata` JSONB column
- Structure:
```json
{
  "cueConnections": [
    {
      "cueId": "cue-uuid",
      "cueType": "light",
      "cueNumber": "Q101",
      "wordPosition": {
        "start": 45,
        "end": 52,
        "text": "thunder"
      }
    }
  ]
}
```

### 3. YJS Real-time Sync

#### A. Mark-based Storage
- Cue connections stored as TipTap marks
- Automatic position tracking as text changes
- Survives collaborative edits

#### B. Update Protocol
```typescript
// When connection created:
1. Apply mark to selected text
2. Update YJS document
3. Sync to all connected clients
4. Queue for database persistence
```

### 4. Snapshot Service Updates

#### A. Content Extractor Service
```rust
// content_extractor_service.rs modifications
- Extract cue connection marks from YJS
- Include in ContentBlock metadata
- Preserve connection data during snapshots
```

#### B. HTML Parser Service
```rust
// html_parser_service.rs modifications
- Parse cue connection marks from HTML
- Reconstruct connections in fallback mode
```

## Implementation Steps

### Phase 1: Frontend Foundation
1. Create `CueConnectionMark` extension
2. Add drag handlers to `CueBlock`
3. Implement word detection on hover
4. Create visual bracket renderer

### Phase 2: Data Persistence
1. Update YJS sync to handle marks
2. Modify snapshot service to preserve connections
3. Add connection data to block metadata

### Phase 3: UI Polish
1. Add visual feedback during drag
2. Implement multi-cue stacking
3. Add hover tooltips
4. Create connection management UI

### Phase 4: Testing & Optimization
1. Test with collaborative editing
2. Performance optimization for many connections
3. Handle edge cases (deleted text, undo/redo)
4. Cross-page connection handling

## Technical Considerations

### Performance
- Lazy render brackets (only visible connections)
- Debounce position calculations
- Use CSS for visual rendering (no canvas/SVG)

### Edge Cases
- Text deletion removes connections
- Undo/redo preserves connections
- Copy/paste behavior (connections don't copy)
- Multi-page scripts (connections on same page only)

### User Experience
- Clear visual feedback during drag
- Highlight valid drop targets
- Show existing connections clearly
- Easy to remove connections (right-click menu?)

## Migration Strategy
- No database migration needed (uses existing JSONB)
- Backwards compatible (old scripts work fine)
- Progressive enhancement (feature can be disabled)

## Future Enhancements
- Filter view by cue type
- Export cue sheet with word references
- Timeline view of all cues
- Batch connection management