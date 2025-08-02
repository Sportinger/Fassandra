# Claude PDF Parser Agent - Precise Instructions

You are a PDF script parser that will extract theater script content from `/home/admins/projects/pessoa/doc/test.pdf` and insert it into the PostgreSQL database.

## Database Structure

### scripts table:
- `id` UUID PRIMARY KEY DEFAULT uuid_generate_v4()
- `title` TEXT NOT NULL
- `created_by` UUID REFERENCES users(id)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `is_public` BOOLEAN DEFAULT FALSE
- `thumbnail` TEXT NULL

### blocks table:
- `id` UUID PRIMARY KEY DEFAULT uuid_generate_v4()
- `script_id` UUID REFERENCES scripts(id) ON DELETE CASCADE
- `block_type` TEXT NOT NULL
- `content` TEXT NOT NULL (JSON format)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `block_order` INTEGER NOT NULL DEFAULT 0
- `page_number` INTEGER DEFAULT 1 NOT NULL
- `metadata` JSONB NULL
- `scene_number` VARCHAR(50) NULL
- `scene_title` VARCHAR(255) NULL

## Environment Setup

```bash
# Database connection
export DATABASE_URL="postgresql://pessoa_user:Dkn1t9wh4p2m6l3f8@localhost:5432/pessoa"

# Working directory
cd /home/admins/projects/pessoa
```

## Step 1: Read PDF and Create JSON

Read the PDF file `/home/admins/projects/pessoa/doc/test.pdf` directly and create a JSON structure matching this exact schema:

```json
{
  "title": "Main Title",
  "subtitle": "Subtitle if present",
  "adaptation_by": ["Author Name 1", "Author Name 2"],
  "sections": [
    {
      "section_number": "1",
      "title": "Section Title",
      "participants": ["Character1", "Character2"],
      "setting_note": "Setting description if present",
      "content": [
        {
          "type": "scene",
          "page_number": 1,
          "scene_number": "1",
          "scene_title": "PROLOG"
        },
        {
          "type": "dialogue",
          "speaker": "CHARACTER_NAME",
          "line": "The actual dialogue text goes here",
          "page_number": 1
        },
        {
          "type": "stage_direction",
          "description": "Stage direction text",
          "page_number": 1
        }
      ]
    }
  ]
}
```

### Critical Requirements:
- Extract ALL dialogue text, not just speaker names
- Include accurate page numbers from the PDF
- Identify all speakers, scenes, and stage directions
- Preserve the original order and structure

### Scene Recognition:
When you encounter patterns like '1/ PROLOG', '2/ DER TOD', 'ACT I', 'SCENE 2':
- Create a content element with `type: "scene"`
- Extract `scene_number` (e.g., "1", "2", "ACT I")
- Extract `scene_title` (e.g., "PROLOG", "DER TOD")

### Valid Content Types:
- `scene` - Scene headers
- `dialogue` - Character dialogue
- `monologue` - Extended single character speech
- `stage_direction` - Stage directions
- `joint_dialogue` - Multiple speakers
- `reading` - Reading passages

Save this JSON to `/tmp/parsed_script.json` and validate it:

```bash
# Validate the JSON
jq . /tmp/parsed_script.json
```

If there are JSON errors, fix them and try again until the JSON is valid.

## Step 2: Create Database Entries

### IMPORTANT Database Notes:
- Use `uuid_generate_v4()` for generating UUIDs (not gen_random_uuid)
- The `content` field in blocks must be valid JSON as a TEXT string
- `block_order` must be sequential integers starting from 1
- `page_number` must match the actual PDF page numbers
- `scene_number` and `scene_title` should be filled when a scene element is encountered

### 2.1 Generate Script ID and Create Script

```bash
# Generate Script ID using uuid_generate_v4()
SCRIPT_ID=$(psql "$DATABASE_URL" -t -c "SELECT uuid_generate_v4();")

# Get user ID for user 'abc'
USER_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM users WHERE username = 'abc';")

# Verify user exists
if [ -z "$USER_ID" ]; then
    echo "ERROR: User 'abc' not found!"
    echo "Checking existing users..."
    psql "$DATABASE_URL" -c "SELECT id, username, email FROM users ORDER BY created_at DESC LIMIT 5;"
    # If user doesn't exist, you may need to create them first
    exit 1
fi

echo "Creating script for user 'abc' (ID: $USER_ID)"

# Create the script entry
psql "$DATABASE_URL" << EOF
INSERT INTO scripts (id, title, created_by, created_at, is_public, thumbnail)
VALUES ('$SCRIPT_ID'::uuid, 'TITLE_HERE', '$USER_ID'::uuid, NOW(), false, NULL);
EOF

# Verify script was created with correct user
psql "$DATABASE_URL" -c "SELECT s.id, s.title, u.username FROM scripts s JOIN users u ON s.created_by = u.id WHERE s.id = '$SCRIPT_ID'::uuid;"
```

### 2.2 Create Script and Blocks Using the Parsed JSON

Now process the JSON to create the script and blocks:

```bash
# Read the JSON and create blocks
PARSED_JSON=$(cat /tmp/parsed_script.json)
TITLE=$(echo "$PARSED_JSON" | jq -r '.title // "Untitled Script"')

# Create the script
psql "$DATABASE_URL" << EOF
INSERT INTO scripts (id, title, created_by, created_at, is_public, thumbnail)
VALUES ('$SCRIPT_ID'::uuid, '$TITLE', '$USER_ID'::uuid, NOW(), false, NULL);
EOF

# Generate SQL for blocks based on the JSON structure
python3 << 'PYTHON_EOF'
import json
import sys

with open('/tmp/parsed_script.json', 'r') as f:
    parsed = json.load(f)

script_id = sys.argv[1] if len(sys.argv) > 1 else 'SCRIPT_ID_HERE'
block_order = 0
current_scene_number = None
current_scene_title = None

print("BEGIN;")
print("-- Insert blocks from parsed JSON")

for section in parsed.get('sections', []):
    for content in section.get('content', []):
        block_order += 1
        block_type = content.get('type', 'unknown')
        page_number = content.get('page_number', 1)
        
        # Update scene tracking for scene elements
        if block_type == 'scene':
            current_scene_number = content.get('scene_number', '')
            current_scene_title = content.get('scene_title', '')
        
        # Create content JSON based on type
        if block_type == 'dialogue':
            content_json = json.dumps({
                "speaker": content.get('speaker', ''),
                "line": content.get('line', '')
            })
        elif block_type == 'stage_direction':
            content_json = json.dumps({
                "description": content.get('description', '')
            })
        elif block_type == 'scene':
            content_json = json.dumps({
                "scene_number": content.get('scene_number', ''),
                "title": content.get('scene_title', ''),
                "setting": ""
            })
        elif block_type == 'monologue':
            content_json = json.dumps({
                "speaker": content.get('speaker', ''),
                "lines": content.get('lines', [])
            })
        elif block_type == 'joint_dialogue':
            content_json = json.dumps({
                "speakers": content.get('speakers', []),
                "line": content.get('line', '')
            })
        elif block_type == 'reading':
            content_json = json.dumps({
                "speaker": content.get('speaker', ''),
                "reading_text": content.get('reading_text', ''),
                "source": content.get('source', ''),
                "language": content.get('language', '')
            })
        else:
            content_json = json.dumps(content)
        
        # Escape single quotes for SQL
        content_json = content_json.replace("'", "''")
        scene_num = (current_scene_number or '').replace("'", "''") if current_scene_number else 'NULL'
        scene_ttl = (current_scene_title or '').replace("'", "''") if current_scene_title else 'NULL'
        
        # Format scene fields for SQL
        scene_num_sql = f"'{scene_num}'" if scene_num != 'NULL' else 'NULL'
        scene_ttl_sql = f"'{scene_ttl}'" if scene_ttl != 'NULL' else 'NULL'
        
        print(f"INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title) VALUES")
        print(f"(uuid_generate_v4(), '{script_id}'::uuid, '{block_type}', '{content_json}', NOW(), {block_order}, {page_number}, {scene_num_sql}, {scene_ttl_sql});")

print("\nCOMMIT;")
PYTHON_EOF $SCRIPT_ID > /tmp/blocks_insert.sql

# Execute the generated SQL
psql "$DATABASE_URL" < /tmp/blocks_insert.sql
```

## Step 3: Verify Everything

```bash
# Execute the batch insert
psql "$DATABASE_URL" < /tmp/blocks_insert.sql

# Detailed verification
psql "$DATABASE_URL" << EOF
-- Check script exists
SELECT id, title, created_by FROM scripts WHERE id = '$SCRIPT_ID'::uuid;

-- Count blocks by type
SELECT block_type, COUNT(*) as count 
FROM blocks 
WHERE script_id = '$SCRIPT_ID'::uuid 
GROUP BY block_type;

-- Show first 5 blocks
SELECT block_order, block_type, page_number, 
       SUBSTRING(content::text, 1, 100) as content_preview
FROM blocks 
WHERE script_id = '$SCRIPT_ID'::uuid 
ORDER BY block_order 
LIMIT 5;

-- Verify page number continuity
SELECT COUNT(DISTINCT page_number) as total_pages,
       MIN(page_number) as first_page,
       MAX(page_number) as last_page
FROM blocks WHERE script_id = '$SCRIPT_ID'::uuid;
EOF
```

## Step 4: Error Handling

If JSON formatting fails, fix it iteratively:

```bash
# Test JSON validity for a single block
echo '{"speaker":"HAMLET","line":"To be or not to be"}' | jq .

# If errors occur, check the PostgreSQL log
psql "$DATABASE_URL" -c "SELECT content FROM blocks WHERE script_id = '$SCRIPT_ID'::uuid LIMIT 1;" | jq .
```

## Important Rules:

1. **JSON Format**: The `content` field must be valid JSON. Escape quotes and newlines:
   - Replace `"` with `\"`
   - Replace newlines with `\n`
   - Remove or escape special characters

2. **Block Types**: Valid types are:
   - `dialogue`
   - `monologue`
   - `stage_direction`
   - `scene`
   - `joint_dialogue`
   - `reading`

3. **Block Order**: Must be sequential integers starting from 1

4. **Page Numbers**: Preserve original page numbers from the PDF

## Final Verification

```bash
# Complete verification query
psql "$DATABASE_URL" << EOF
SELECT 
    s.title as script_title,
    COUNT(b.id) as total_blocks,
    STRING_AGG(DISTINCT b.block_type, ', ') as block_types,
    MAX(b.page_number) as total_pages
FROM scripts s
LEFT JOIN blocks b ON s.id = b.script_id
WHERE s.id = '$SCRIPT_ID'::uuid
GROUP BY s.id, s.title;
EOF
```

## Success Criteria:
- Script record exists in database
- All blocks are inserted with proper JSON content
- Block order is sequential
- Page numbers are preserved
- No JSON parsing errors
- Verification queries return expected counts

Start with Step 1 and proceed sequentially. Show the output of each verification step.