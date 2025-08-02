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

# Create SQL file with all inserts
sql_content = f"""
BEGIN;

-- Insert script
INSERT INTO scripts (id, title, created_by, created_at, is_public)
VALUES ('{SCRIPT_ID}'::uuid, '{parsed_script.get('source_filename', 'test.pdf').replace('.pdf', '')}', '{USER_ID}'::uuid, NOW(), false);

-- Insert all blocks
"""

block_order = 0
for section in parsed_script['sections']:
    for content_item in section['content']:
        block_id = str(uuid.uuid4())
        block_type = content_item['type']
        
        # Map content types to database block types
        type_mapping = {
            'scene': 'scene-block',
            'dialogue': 'dialogue',
            'stage_direction': 'stage_direction',
            'joint_dialogue': 'joint_dialogue',
            'monologue': 'monologue',
            'reading': 'reading',
            'unknown': 'unknown'
        }
        db_block_type = type_mapping.get(block_type, block_type)
        
        # Extract metadata
        page_number = content_item.get('page_number', 1)
        scene_number = content_item.get('scene_number')
        scene_title = content_item.get('scene_title')
        
        # Create clean content (remove metadata fields)
        clean_content = {k: v for k, v in content_item.items() 
                        if k not in ['page_number', 'scene_number', 'scene_title']}
        
        # Escape single quotes in JSON
        content_json = json.dumps(clean_content).replace("'", "''")
        
        # Handle NULL values for scene metadata
        scene_number_sql = f"'{scene_number}'" if scene_number else "NULL"
        scene_title_sql = f"'{scene_title.replace(chr(39), chr(39)+chr(39))}'" if scene_title else "NULL"
        
        sql_content += f"""
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('{block_id}'::uuid, '{SCRIPT_ID}'::uuid, '{db_block_type}', '{content_json}'::jsonb, NOW(), {block_order}, {page_number}, {scene_number_sql}, {scene_title_sql});"""
        
        block_order += 1

sql_content += """

COMMIT;

-- Verify the insertion
SELECT 'Script created with ID: ' || id || ', Total blocks: ' || 
       (SELECT COUNT(*) FROM blocks WHERE script_id = scripts.id) as result
FROM scripts 
WHERE id = '""" + SCRIPT_ID + """'::uuid;
"""

# Write SQL to file
with open('/home/admins/projects/pessoa/complete_script_insert.sql', 'w') as f:
    f.write(sql_content)

print(f"Created SQL file with {block_order} blocks")
print(f"Script ID: {SCRIPT_ID}")

# Execute the SQL
result = subprocess.run([
    'psql', DB_URL, '-f', '/home/admins/projects/pessoa/complete_script_insert.sql'
], capture_output=True, text=True)

if result.returncode == 0:
    print("\nDatabase insertion successful!")
    print(result.stdout)
else:
    print("\nDatabase insertion failed!")
    print(result.stderr)