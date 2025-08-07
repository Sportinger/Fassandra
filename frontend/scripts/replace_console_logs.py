#!/usr/bin/env python3

import os
import re
import sys
from pathlib import Path

# Files to skip
SKIP_FILES = [
    'LoggingService.ts',
    'LoggingService.js',
    'debug.ts'  # Skip debug utility file
]

SKIP_PATTERNS = [
    '.test.ts',
    '.test.tsx',
    '.spec.ts',
    '.spec.tsx'
]

# Map console methods to logger methods
METHOD_MAP = {
    'console.log': ('debug', 'Debug log'),
    'console.debug': ('debug', 'Debug'),
    'console.info': ('info', 'Info'),
    'console.warn': ('warn', 'Warning'),
    'console.error': ('error', 'Error')
}

def should_skip_file(file_path):
    """Check if file should be skipped"""
    basename = os.path.basename(file_path)
    
    # Check exact matches
    if basename in SKIP_FILES:
        return True
    
    # Check patterns
    for pattern in SKIP_PATTERNS:
        if pattern in basename:
            return True
    
    return False

def extract_component_name(file_path):
    """Extract component name from file path"""
    basename = os.path.basename(file_path)
    name = os.path.splitext(basename)[0]
    # Remove .test, .spec suffixes if present
    name = re.sub(r'\.(test|spec)$', '', name)
    return name

def get_relative_import_path(from_file, to_file):
    """Calculate relative import path"""
    from_dir = os.path.dirname(from_file)
    rel_path = os.path.relpath(to_file, from_dir)
    # Remove .ts extension if present
    rel_path = re.sub(r'\.ts$', '', rel_path)
    # Ensure it starts with ./ or ../
    if not rel_path.startswith('.'):
        rel_path = './' + rel_path
    return rel_path.replace('\\', '/')

def process_console_statement(match, component_name, method_info):
    """Process a single console statement"""
    full_match = match.group(0)
    console_method = match.group(1)
    args = match.group(2)
    
    logger_method, default_msg = method_info
    
    # Try to extract the first argument as the message
    # This is a simple approach - may need refinement for complex cases
    if args.strip():
        # If args starts with a string literal, use it as part of the message
        if args.strip()[0] in ['"', "'", '`']:
            return f"logger.{logger_method}('{component_name}', {args})"
        else:
            # Wrap the argument as the message
            return f"logger.{logger_method}('{component_name}', '{default_msg}', {args})"
    else:
        return f"logger.{logger_method}('{component_name}', '{default_msg}')"

def process_file(file_path):
    """Process a single file"""
    if should_skip_file(file_path):
        print(f"Skipping: {file_path}")
        return {'skipped': True}
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    component_name = extract_component_name(file_path)
    has_changes = False
    needs_import = False
    replacement_count = 0
    
    # Process each console method
    for console_method, method_info in METHOD_MAP.items():
        # Pattern to match console.method(args)
        pattern = rf'{re.escape(console_method)}\s*\((.*?)\)'
        
        def replacer(match):
            nonlocal replacement_count, needs_import
            replacement_count += 1
            needs_import = True
            return process_console_statement(match, component_name, method_info)
        
        # Find and replace all occurrences
        new_content, count = re.subn(pattern, replacer, content, flags=re.DOTALL)
        if count > 0:
            content = new_content
            has_changes = True
    
    # Add import if needed
    if needs_import and 'import logger from' not in content and 'import { logger }' not in content:
        # Find the position to insert the import
        import_pattern = r'^import\s+.*?;?\s*$'
        imports = list(re.finditer(import_pattern, content, re.MULTILINE))
        
        if imports:
            # Insert after the last import
            last_import = imports[-1]
            insert_pos = last_import.end()
            
            # Calculate relative path to LoggingService
            logging_service_path = os.path.join(os.path.dirname(file_path), '../services/LoggingService')
            logging_service_path = os.path.normpath(logging_service_path)
            rel_path = get_relative_import_path(file_path, logging_service_path)
            
            import_statement = f"\nimport logger from '{rel_path}';"
            content = content[:insert_pos] + import_statement + content[insert_pos:]
        else:
            # No imports found, add at the beginning of the file
            rel_path = get_relative_import_path(file_path, 
                os.path.join(os.path.dirname(file_path), '../services/LoggingService'))
            import_statement = f"import logger from '{rel_path}';\n\n"
            content = import_statement + content
    
    if has_changes:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Processed: {file_path} ({replacement_count} replacements)")
        return {'processed': True, 'replacements': replacement_count}
    
    return {'unchanged': True}

def main():
    """Main function"""
    src_dir = Path(__file__).parent.parent / 'src'
    
    # Find all TypeScript files
    ts_files = list(src_dir.glob('**/*.ts'))
    tsx_files = list(src_dir.glob('**/*.tsx'))
    all_files = ts_files + tsx_files
    
    print(f"Found {len(all_files)} TypeScript files to process\n")
    
    stats = {
        'processed': 0,
        'skipped': 0,
        'unchanged': 0,
        'total_replacements': 0
    }
    
    for file_path in all_files:
        result = process_file(str(file_path))
        if result.get('skipped'):
            stats['skipped'] += 1
        elif result.get('processed'):
            stats['processed'] += 1
            stats['total_replacements'] += result['replacements']
        elif result.get('unchanged'):
            stats['unchanged'] += 1
    
    print('\n=== Summary ===')
    print(f"Files processed: {stats['processed']}")
    print(f"Files skipped: {stats['skipped']}")
    print(f"Files unchanged: {stats['unchanged']}")
    print(f"Total replacements: {stats['total_replacements']}")

if __name__ == '__main__':
    main()