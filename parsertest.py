#!/usr/bin/env python3
"""
Theater Script Parser for Pessoa Database

This script parses theater scripts from various sources (PDF, JSON) and inserts them 
into the PostgreSQL database using SQL generation approach.

Usage:
    python parse_script.py <input_file> <user_email>
    
Example:
    python parse_script.py input/test.pdf a@b.c
"""

import json
import subprocess
import uuid
import sys
import os
from pathlib import Path
from datetime import datetime

# Database configuration
DB_URL = "postgres://pessoa_user:dev_password_123@localhost:5432/pessoa_db"

def verify_user(email):
    """Verify user exists in database and get their ID."""
    cmd = f"""PGPASSWORD=dev_password_123 psql -h localhost -U pessoa_user -d pessoa_db -t -c "SELECT id, username FROM users WHERE email = '{email}' OR username = '{email}';" """
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Database error: {result.stderr}")
        return None, None
        
    lines = result.stdout.strip().split('\n')
    if not lines or lines[0].strip() == '':
        print(f"User with email '{email}' not found in database.")
        
        # List available users
        list_cmd = """PGPASSWORD=dev_password_123 psql -h localhost -U pessoa_user -d pessoa_db -c "SELECT username, email FROM users ORDER BY email;" """
        list_result = subprocess.run(list_cmd, shell=True, capture_output=True, text=True)
        print("\nAvailable users:")
        print(list_result.stdout)
        return None, None
    
    # Parse the result
    parts = lines[0].strip().split('|')
    if len(parts) >= 2:
        user_id = parts[0].strip()
        username = parts[1].strip()
        return user_id, username
    
    return None, None

def extract_pdf_text(pdf_path, max_pages=None):
    """Extract text from PDF using pdftotext."""
    output_file = Path("output") / f"{Path(pdf_path).stem}_extracted.txt"
    
    cmd = ["pdftotext"]
    if max_pages:
        cmd.extend(["-l", str(max_pages)])
    cmd.extend([pdf_path, str(output_file)])
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error extracting PDF: {result.stderr}")
        return None
        
    with open(output_file, 'r', encoding='utf-8') as f:
        return f.read()

def parse_script_content(content, source_filename):
    """
    Parse script content into JSON structure.
    This is a simplified parser - in production, you might use AI or more sophisticated parsing.
    """
    # For now, we'll assume the content is already in parsed JSON format
    # In a real implementation, this would parse the raw text into the structured format
    
    # Check if content is already JSON (from existing parsed files)
    try:
        if isinstance(content, str) and content.strip().startswith('{'):
            return json.loads(content)
    except:
        pass
    
    # If not JSON, create a basic structure
    # In production, this would be much more sophisticated
    print("Warning: Manual text parsing not implemented. Please provide pre-parsed JSON.")
    return None

def create_sql_file(parsed_script, user_id, script_id):
    """Generate SQL file for database insertion."""
    sql_content = f"""
BEGIN;

-- Insert script
INSERT INTO scripts (id, title, created_by, created_at, is_public)
VALUES ('{script_id}'::uuid, '{parsed_script.get('title', 'Untitled').replace("'", "''")}', '{user_id}'::uuid, NOW(), false);

-- Insert all blocks
"""

    block_order = 0
    for section in parsed_script.get('sections', []):
        for content_item in section.get('content', []):
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
VALUES ('{block_id}'::uuid, '{script_id}'::uuid, '{db_block_type}', '{content_json}'::jsonb, NOW(), {block_order}, {page_number}, {scene_number_sql}, {scene_title_sql});"""
            
            block_order += 1

    sql_content += f"""

COMMIT;

-- Verify the insertion
SELECT 'Script created with ID: ' || id || ', Total blocks: ' || 
       (SELECT COUNT(*) FROM blocks WHERE script_id = scripts.id) as result
FROM scripts 
WHERE id = '{script_id}'::uuid;
"""
    
    return sql_content, block_order

def main():
    if len(sys.argv) < 3:
        print("Usage: python parse_script.py <input_file> <user_email>")
        print("Example: python parse_script.py input/test.pdf a@b.c")
        sys.exit(1)
    
    input_file = sys.argv[1]
    user_email = sys.argv[2]
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found.")
        sys.exit(1)
    
    print(f"Processing script: {input_file}")
    print(f"For user: {user_email}")
    
    # Verify user exists
    user_id, username = verify_user(user_email)
    if not user_id:
        print("Aborting: User not found.")
        sys.exit(1)
    
    print(f"Found user: {username} (ID: {user_id})")
    
    # Load or parse the script
    file_ext = Path(input_file).suffix.lower()
    
    if file_ext == '.json':
        # Load pre-parsed JSON
        with open(input_file, 'r', encoding='utf-8') as f:
            parsed_script = json.load(f)
        print(f"Loaded parsed JSON with {len(parsed_script.get('sections', []))} sections")
    
    elif file_ext == '.pdf':
        # Extract PDF text (first 10 pages by default)
        print("Extracting PDF text...")
        pdf_text = extract_pdf_text(input_file, max_pages=10)
        if not pdf_text:
            print("Failed to extract PDF text.")
            sys.exit(1)
        
        # Parse the text (simplified for now)
        parsed_script = parse_script_content(pdf_text, Path(input_file).name)
        if not parsed_script:
            print("Failed to parse script content.")
            print("Please provide a pre-parsed JSON file instead.")
            sys.exit(1)
    
    else:
        print(f"Unsupported file type: {file_ext}")
        print("Supported types: .json, .pdf")
        sys.exit(1)
    
    # Generate script ID
    script_id = str(uuid.uuid4())
    
    # Create SQL file
    sql_content, block_count = create_sql_file(parsed_script, user_id, script_id)
    
    # Save SQL file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    sql_filename = f"output/script_{timestamp}_{script_id[:8]}.sql"
    
    with open(sql_filename, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    
    print(f"\nCreated SQL file: {sql_filename}")
    print(f"Script ID: {script_id}")
    print(f"Total blocks: {block_count}")
    
    # Ask user if they want to execute
    response = input("\nExecute SQL and insert into database? (y/n): ")
    
    if response.lower() == 'y':
        # Execute the SQL
        result = subprocess.run([
            'psql', DB_URL, '-f', sql_filename
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("\nDatabase insertion successful!")
            print(result.stdout)
            print(f"\nView script at: http://localhost:3000/script/{script_id}")
        else:
            print("\nDatabase insertion failed!")
            print(result.stderr)
            sys.exit(1)
    else:
        print("\nSQL file saved but not executed.")
        print(f"To execute later: psql {DB_URL} -f {sql_filename}")

if __name__ == "__main__":
    main()