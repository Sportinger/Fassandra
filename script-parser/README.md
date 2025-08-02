# Script Parser for Pessoa Theater Database

This is the **ONLY** way to upload and parse theater scripts into the Pessoa database.

## Directory Structure

```
script-parser/
├── input/          # Place PDF or JSON files here
├── output/         # Generated SQL files and extracted text
├── scripts/        # Parsing scripts
└── parse_script.py # Main parsing script
```

## Usage

### Basic Usage

```bash
python parse_script.py <input_file> <user_email>
```

### Examples

```bash
# Parse a pre-parsed JSON file
python parse_script.py input/test_parsed.json a@b.c

# Parse a PDF file (first 10 pages)
python parse_script.py input/script.pdf user@example.com
```

## Supported Input Formats

1. **JSON Files** (`.json`) - Pre-parsed script data following our schema
2. **PDF Files** (`.pdf`) - Raw PDF scripts (requires manual parsing or AI assistance)

## Database Schema

The parser expects scripts in this JSON format:

```json
{
  "title": "Script Title",
  "subtitle": "Optional Subtitle",
  "sections": [
    {
      "section_number": "1",
      "title": "Scene Title",
      "content": [
        {
          "type": "scene",
          "scene_number": "1",
          "scene_title": "Opening Scene",
          "page_number": 1
        },
        {
          "type": "dialogue",
          "speaker": "CHARACTER",
          "line": "The actual dialogue text",
          "page_number": 1,
          "scene_number": "1",
          "scene_title": "Opening Scene"
        }
      ]
    }
  ]
}
```

## Content Types

- `scene` → `scene-block` (in database)
- `dialogue` → `dialogue`
- `stage_direction` → `stage_direction`
- `joint_dialogue` → `joint_dialogue`
- `monologue` → `monologue`
- `reading` → `reading`

## Process Flow

1. **User Verification** - Checks if the user email exists in the database
2. **File Loading** - Loads JSON or extracts text from PDF
3. **SQL Generation** - Creates a transaction-safe SQL file
4. **Optional Execution** - Asks if you want to insert into database

## Notes

- PDF parsing currently requires pre-parsed JSON files
- The script generates SQL files in the `output/` directory
- All operations are wrapped in database transactions for safety
- Single quotes in text are automatically escaped
- Scene metadata is stored in separate columns