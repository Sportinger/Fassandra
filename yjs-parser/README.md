# YJS Script Parser

Node.js service that generates proper YJS documents for script imports, using the same libraries as the frontend (TipTap, Y.js).

## Why This Exists

The Rust YRS library has limitations with XML structures that TipTap expects. This Node.js service uses the actual JavaScript Y.js library to create properly formatted YJS documents that are 100% compatible with the frontend editor.

## How It Works

1. Reads script JSON data (same format as before)
2. Creates a YJS document with proper TipTap structure
3. Generates binary YJS updates (exactly like the frontend does)
4. Stores these updates directly in the database
5. Frontend loads and renders them perfectly

## Installation

```bash
cd yjs-parser
npm install
```

## Usage

### Import a Full Script

```bash
npm run import-script script.json username
```

### Import Chunked Scripts

```bash
# First chunk (creates the script)
npm run import-script chunk1.json username

# Subsequent chunks (use the script ID from chunk 1)
npm run import-script chunk2.json username -s <script-id>
npm run import-script chunk3.json username -s <script-id>
```

### JSON Format

Same as before - works with both full and chunked modes:

```json
{
  "mode": "full",
  "metadata": {
    "title": "Script Title",
    "author": "Author Name",
    "total_pages": 10
  },
  "content": [
    {
      "type": "scene",
      "content": "INT. OFFICE - DAY",
      "page": 1
    },
    {
      "type": "dialogue",
      "speaker": "CHARACTER",
      "content": "Dialogue text",
      "page": 1
    }
  ]
}
```

## Integration with Existing System

This replaces the Rust `yjs_to_db` binary. Instead of:

```bash
yjs_to_db script.json username
```

Use:

```bash
npm run import-script script.json username
```

The YJS updates are stored in the same database tables and are fully compatible with the WebSocket collaboration system.

## Benefits

- ✅ Uses real Y.js library (not limited Rust version)
- ✅ Creates proper TipTap-compatible structures
- ✅ Same binary format as frontend
- ✅ Direct database insertion (no WebSocket needed)
- ✅ Works with existing collaboration system
- ✅ No frontend changes required