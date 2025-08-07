#!/usr/bin/env python3

import os
import re
from pathlib import Path

# Files to skip
SKIP_FILES = [
    'LoggingService.ts',
    'debug.ts'
]

def should_skip_file(file_path):
    """Check if file should be skipped"""
    basename = os.path.basename(file_path)
    
    # Skip test files
    if '.test.' in basename or '.spec.' in basename:
        return True
    
    # Check exact matches
    if basename in SKIP_FILES:
        return True
    
    return False

def extract_component_name(file_path):
    """Extract component name from file path"""
    basename = os.path.basename(file_path)
    name = os.path.splitext(basename)[0]
    return name

def process_file(file_path):
    """Process a single file to replace console statements"""
    if should_skip_file(file_path):
        print(f"Skipping: {file_path}")
        return {'skipped': True}
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    component_name = extract_component_name(file_path)
    replacement_count = 0
    
    # Replace console.error
    pattern = r'console\.error\('
    if re.search(pattern, content):
        content = re.sub(pattern, f"logger.error('{component_name}', 'Error: ', ", content)
        replacement_count += len(re.findall(pattern, original_content))
    
    # Replace console.warn
    pattern = r'console\.warn\('
    if re.search(pattern, content):
        content = re.sub(pattern, f"logger.warn('{component_name}', 'Warning: ', ", content)
        replacement_count += len(re.findall(pattern, original_content))
    
    # Replace console.log
    pattern = r'console\.log\('
    if re.search(pattern, content):
        content = re.sub(pattern, f"logger.debug('{component_name}', ", content)
        replacement_count += len(re.findall(pattern, original_content))
    
    # Replace console.debug
    pattern = r'console\.debug\('
    if re.search(pattern, content):
        content = re.sub(pattern, f"logger.debug('{component_name}', ", content)
        replacement_count += len(re.findall(pattern, original_content))
    
    # Replace console.info
    pattern = r'console\.info\('
    if re.search(pattern, content):
        content = re.sub(pattern, f"logger.info('{component_name}', ", content)
        replacement_count += len(re.findall(pattern, original_content))
    
    # Add import if needed and file was modified
    if replacement_count > 0:
        if 'import logger from' not in content and 'from \'./services/LoggingService\'' not in content:
            # Calculate relative path
            file_dir = os.path.dirname(file_path)
            src_dir = Path(file_path).parent
            
            # Navigate to find services directory
            levels_up = 0
            current = Path(file_path).parent
            while current.name != 'src' and current.parent != current:
                levels_up += 1
                current = current.parent
            
            if current.name == 'src':
                if levels_up == 0:
                    import_path = './services/LoggingService'
                else:
                    import_path = '../' * levels_up + 'services/LoggingService'
            else:
                # Fallback
                import_path = '../services/LoggingService'
            
            # Add import at the top after other imports
            import_lines = []
            other_lines = []
            in_imports = False
            
            for line in content.split('\n'):
                if line.startswith('import '):
                    import_lines.append(line)
                    in_imports = True
                elif in_imports and line.strip() == '':
                    import_lines.append(line)
                else:
                    if in_imports:
                        # End of imports, add our import
                        import_lines.append(f"import logger from '{import_path}';")
                        in_imports = False
                    other_lines.append(line)
            
            if import_lines:
                content = '\n'.join(import_lines) + '\n' + '\n'.join(other_lines)
            else:
                # No imports found, add at the beginning
                content = f"import logger from '{import_path}';\n\n" + content
        
        # Write the modified content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Processed: {file_path} ({replacement_count} replacements)")
        return {'processed': True, 'replacements': replacement_count}
    
    return {'unchanged': True}

def main():
    """Main function"""
    src_dir = Path(__file__).parent.parent / 'src'
    
    # Find all TypeScript files
    all_files = list(src_dir.glob('**/*.ts')) + list(src_dir.glob('**/*.tsx'))
    
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