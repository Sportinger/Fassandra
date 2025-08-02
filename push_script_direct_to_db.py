#!/usr/bin/env python3
import json
import psycopg2
import uuid
from datetime import datetime

# Database configuration
DB_CONFIG = {
    "host": "localhost",
    "database": "pessoa_db",
    "user": "pessoa_user",
    "password": "dev_password_123"
}

USER_ID = "e6f1aeee-b6ab-426f-aa12-e15ab8f3a6da"  # User a@b.c
PARSED_SCRIPT_PATH = "/home/admins/projects/pessoa/backend/debug_gemini_responses/test_pdf_parsed.json"

def create_script_in_db():
    """Create script directly in database"""
    conn = None
    try:
        # Connect to database
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Read parsed script
        with open(PARSED_SCRIPT_PATH, 'r') as f:
            parsed_script = json.load(f)
        
        # Create script
        script_id = str(uuid.uuid4())
        script_title = parsed_script.get('source_filename', 'test.pdf').replace('.pdf', '')
        created_at = datetime.utcnow()
        
        print(f"Creating script '{script_title}' with ID: {script_id}")
        
        cur.execute("""
            INSERT INTO scripts (id, title, created_by, created_at, is_public)
            VALUES (%s, %s, %s, %s, %s)
        """, (script_id, script_title, USER_ID, created_at, False))
        
        # Create blocks
        block_order = 0
        for section_index, section in enumerate(parsed_script['sections']):
            for element_index, element in enumerate(section['content']):
                block_id = str(uuid.uuid4())
                block_type = element['type']
                
                # Map to database block types
                if block_type == 'scene':
                    db_block_type = 'scene-block'
                elif block_type == 'dialogue':
                    db_block_type = 'dialogue'
                elif block_type == 'stage_direction':
                    db_block_type = 'stage_direction'
                elif block_type == 'joint_dialogue':
                    db_block_type = 'joint_dialogue'
                else:
                    db_block_type = block_type
                
                # Extract metadata
                page_number = element.get('page_number', 1)
                scene_number = element.get('scene_number')
                scene_title = element.get('scene_title')
                
                # Create clean content (remove metadata fields)
                clean_content = {k: v for k, v in element.items() 
                               if k not in ['page_number', 'scene_number', 'scene_title']}
                
                cur.execute("""
                    INSERT INTO blocks (id, script_id, block_type, content, created_at, 
                                      block_order, page_number, scene_number, scene_title)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (block_id, script_id, db_block_type, json.dumps(clean_content), 
                     created_at, block_order, page_number, scene_number, scene_title))
                
                block_order += 1
                
        conn.commit()
        print(f"\nSuccess! Created script with {block_order} blocks")
        print(f"Script ID: {script_id}")
        print(f"View at: http://localhost:3000/script/{script_id}")
        
        return script_id
        
    except Exception as e:
        print(f"Error: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    create_script_in_db()