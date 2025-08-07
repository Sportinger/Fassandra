# PDF Script Parsing Process Documentation

## Overview
This document captures the exact process used to parse a PDF theater script (test.pdf) and insert it into the PostgreSQL database for the Pessoa project.

## Step-by-Step Process

### 1. Analyze PDF Structure
- Read the PDF file (`/home/admins/projects/pessoa/doc/test.pdf`)
- Identify script structure:
  - 8 pages total
  - Contains scenes: "PROLOG" and "DER TOD, MARY ERFINDET EINE SCHAUERGESCHICHTE"
  - Various content types: scene markers, dialogue, stage directions, etc.

### 2. Understand Database Schema
```sql
-- Scripts table
CREATE TABLE scripts (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE
);

-- Blocks table  
CREATE TABLE blocks (
    id UUID PRIMARY KEY,
    script_id UUID REFERENCES scripts(id),
    block_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    block_order INTEGER NOT NULL DEFAULT 0,
    page_number INTEGER NOT NULL DEFAULT 1,
    scene_number VARCHAR(50),
    scene_title TEXT
);
```

### 3. Create JSON Representation
Created `/home/admins/projects/pessoa/backend/debug_gemini_responses/test_pdf_parsed.json` with structure:
```json
{
  "source_filename": "test.pdf",
  "sections": [
    {
      "type": "text",
      "content": [
        {
          "type": "scene",
          "scene_number": "PROLOG",
          "scene_title": "PROLOG",
          "page_number": 1
        },
        {
          "type": "dialogue",
          "speaker": "FRANKENSTEIN",
          "line": "Dialog text...",
          "page_number": 1
        },
        // ... more content items
      ]
    }
  ]
}
```

### 4. Insert Data into Database

#### Initial Approach (Partial - Only 47 blocks)
Created SQL file, but it was incomplete.

#### Complete Solution - Python Script
Created `/home/admins/projects/pessoa/insert_complete_script.py`:
```python
#!/usr/bin/env python3
import json
import subprocess
import uuid

# Load the parsed script JSON
with open('/home/admins/projects/pessoa/backend/debug_gemini_responses/test_pdf_parsed.json', 'r') as f:
    parsed_script = json.load(f)

# Configuration
DB_URL = "postgres://pessoa_user:dev_password_123@localhost:5432/pessoa_db"
USER_ID = "e6f1aeee-b6ab-426f-aa12-e15ab8f3a6da"  # User a@b.c
SCRIPT_ID = str(uuid.uuid4())

# Create SQL with proper handling of:
# - Scene metadata (scene_number, scene_title as separate columns)
# - Content type mapping (scene -> scene-block)
# - Proper JSON escaping
# - NULL handling for optional fields
```

This successfully inserted all 152 blocks.

### 5. Frontend Display Issues and Fixes

#### Issue 1: "Untitled Scene" Display
- **Problem**: Frontend showed "Untitled Scene" for all scenes
- **Root Cause**: Frontend was looking for scene data in JSON content field instead of database columns
- **Solution**: Updated `contentConverters.ts` to use `block.scene_number` and `block.scene_title`

#### Issue 2: Scene Numbers Accumulating
- **Problem**: Scene numbers kept prepending on refresh ("1 1 1 1...")
- **Root Cause**: `updateAllSceneNumbers` was running on every document change
- **Solution**: Added initial load delay and made function more selective

#### Issue 3: Scene Names Not Persisting
- **Problem**: Edited scene names reverted to original after refresh
- **Root Cause**: Save mechanism only sent content field, not scene metadata
- **Solution**: 
  1. Created backend endpoint `/api/blocks/:id` to update blocks with scene metadata
  2. Added `processContentSnapshotWithSceneData` to extract and update scene data
  3. Integrated scene processing into the real-time sync mechanism

## Key Technical Decisions

1. **Data Normalization**: Store scene_number and scene_title as separate database columns rather than embedding in JSON
2. **Frontend Architecture**: Update frontend to read from proper database fields
3. **Save Mechanism**: Process HTML content to extract scene metadata and update blocks accordingly

## Files Modified/Created

### Backend
- `/home/admins/projects/pessoa/backend/src/handlers/block.rs` - New block update handler
- `/home/admins/projects/pessoa/backend/src/handlers/mod.rs` - Register block module
- `/home/admins/projects/pessoa/backend/src/core/server.rs` - Add block routes

### Frontend
- `/home/admins/projects/pessoa/frontend/src/api.ts` - Add updateBlock with scene metadata
- `/home/admins/projects/pessoa/frontend/src/utils/contentSnapshotProcessor.ts` - Process scene updates
- `/home/admins/projects/pessoa/frontend/src/components/editor/hooks/useEditorCore.ts` - Integrate scene processing
- `/home/admins/projects/pessoa/frontend/src/components/editor/utils/contentConverters.ts` - Use DB fields
- `/home/admins/projects/pessoa/frontend/src/components/editor/extensions/SceneBlock.ts` - Fix scene display

### Data Processing
- `/home/admins/projects/pessoa/insert_complete_script.py` - Complete insertion script
- `/home/admins/projects/pessoa/backend/debug_gemini_responses/test_pdf_parsed.json` - Parsed PDF data

## Lessons Learned

1. Always verify complete data insertion (check row counts)
2. Frontend should use normalized database fields, not expect denormalized JSON
3. Save mechanisms must preserve all metadata fields, not just content
4. Auto-numbering features need careful timing to avoid conflicts with data loading

## Next Steps for pdf-script-parser.md Agent

The agent should:
1. Parse PDF files using a similar JSON structure
2. Map content types correctly (scene -> scene-block)
3. Extract scene metadata into separate fields
4. Use the Python script approach for reliable database insertion
5. Verify all blocks are inserted by checking counts