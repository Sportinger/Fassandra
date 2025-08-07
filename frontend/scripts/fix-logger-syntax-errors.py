#!/usr/bin/env python3
"""
Fix the syntax errors introduced by incorrect logger transformations.
"""

import re
from pathlib import Path

def fix_malformed_logger_calls(content):
    """Fix logger calls that were incorrectly transformed"""
    
    # Pattern 1: Fix calls like: logger.method('cat', 'msg', { message: val1, data: val2 })
    # Should be: logger.method('cat', 'msg', { val1, val2 })
    pattern1 = r"logger\.(debug|info|warn|error)\s*\(([^,]+),\s*([^,]+),\s*\{\s*message:\s*([^,}]+),\s*data:\s*([^}]+)\s*\}\s*\)"
    
    def replacer1(match):
        method = match.group(1)
        category = match.group(2)
        message = match.group(3)
        arg1 = match.group(4).strip()
        arg2 = match.group(5).strip()
        
        # If arg1 and arg2 look like they were part of a string, combine them
        if "clearer" in arg1 or "and closer" in arg2:
            # This was likely a string that got split
            return f"logger.{method}({category}, {message})"
        else:
            # These are actual separate data items - combine into single object
            return f"logger.{method}({category}, {message}, {{ arg1: {arg1}, arg2: {arg2} }})"
    
    content = re.sub(pattern1, replacer1, content)
    
    # Pattern 2: Fix incomplete string literals
    # Look for patterns where a string was incorrectly split
    pattern2 = r"'([^']+),\s*\{\s*message:\s*([^,}]+),\s*data:\s*([^}]+)\s*\}"
    
    def replacer2(match):
        part1 = match.group(1)
        part2 = match.group(2)
        part3 = match.group(3)
        
        # Check if this looks like it was a single string
        if "clearer" in part2 or "and closer" in part3:
            return f"'{part1}, {part2.strip()}, {part3.strip()}'"
        else:
            return match.group(0)
    
    content = re.sub(pattern2, replacer2, content)
    
    return content

def fix_file(file_path):
    """Fix logger issues in a single file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    content = fix_malformed_logger_calls(content)
    
    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    src_dir = Path('/home/admins/projects/pessoa/frontend/src')
    
    # Files with syntax errors from the build output
    files_to_fix = [
        'components/editor/components/AudioTranscription.tsx',
        'components/editor/hooks/useEditorCore.ts',
        'components/editor/utils/contentConverters.ts',
        'components/editor/utils/formatters.ts'
    ]
    
    print("🔧 Fixing logger syntax errors...")
    fixed_count = 0
    
    for file_rel in files_to_fix:
        file_path = src_dir / file_rel
        if file_path.exists():
            if fix_file(file_path):
                print(f"  ✅ Fixed: {file_rel}")
                fixed_count += 1
            else:
                print(f"  ⏭️  No changes needed: {file_rel}")
        else:
            print(f"  ❌ Not found: {file_rel}")
    
    print(f"\n✨ Fixed {fixed_count} files")

if __name__ == '__main__':
    main()