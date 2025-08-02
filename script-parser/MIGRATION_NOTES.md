# Script Parser Migration Notes

## What Changed

We've consolidated all script parsing into a single, clean CLI tool located in `/script-parser/`.

### Removed:
- ❌ API endpoints `/api/scripts/upload` and `/api/scripts/create_script_from_parsed`
- ❌ Multiple Python scripts in root directory
- ❌ `/backend/debug_gemini_responses/` directory
- ❌ Scattered SQL files in root

### New Structure:
- ✅ Single parsing tool: `/script-parser/parse_script.py`
- ✅ Organized folders: `input/`, `output/`, `scripts/`
- ✅ Direct database insertion via SQL generation
- ✅ No API dependencies

## Why This Change?

1. **Simplicity**: One way to do things, not three
2. **Security**: No public API endpoints for script upload
3. **Reliability**: Direct SQL approach with transactions
4. **Maintenance**: All parsing logic in one place

## How to Use

```bash
cd /home/admins/projects/pessoa/script-parser
python parse_script.py input/script.json user@email.com
```

## For Developers

The backend application service still contains the parsing methods internally, but they're not exposed via API. This allows for future internal use if needed, but enforces that all script uploads go through the CLI tool.

## Database Changes

No database schema changes were made. The same tables and structure are used:
- `scripts` table for script metadata
- `blocks` table for script content
- Proper user verification via email