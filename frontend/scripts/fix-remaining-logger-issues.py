#!/usr/bin/env python3
"""
Fix remaining logger issues where we have 4 arguments.
These are cases where the data parameter was split into two parts.
"""

import re
from pathlib import Path

def fix_four_arg_logger_calls(file_path):
    """Fix logger calls that have 4 arguments by combining the last two"""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    fixed_lines = []
    changes_made = False
    
    for line in lines:
        # Pattern for logger calls with 4 arguments
        # Example: logger.error('category', 'message', data1, data2)
        pattern = r'(logger\.(debug|info|warn|error)\s*\([^,]+,\s*[^,]+,\s*)([^,]+),\s*([^)]+)\)'
        
        def check_and_fix(match):
            nonlocal changes_made
            prefix = match.group(1)  # logger.method('category', 'message', 
            arg3 = match.group(3).strip()  # third argument
            arg4 = match.group(4).strip()  # fourth argument
            
            # Count the number of commas to verify we have 4 arguments
            full_match = match.group(0)
            comma_count = full_match.count(',')
            
            if comma_count == 3:  # 4 arguments (3 commas)
                changes_made = True
                # Combine the last two arguments into an object
                combined = f"{prefix}{{ message: {arg3}, data: {arg4} }})"
                return combined
            else:
                return match.group(0)
        
        # Apply the fix
        fixed_line = re.sub(pattern, check_and_fix, line)
        fixed_lines.append(fixed_line)
    
    if changes_made:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(fixed_lines)
        return True
    return False

def main():
    src_dir = Path('/home/admins/projects/pessoa/frontend/src')
    
    # Files identified as still having issues
    files_to_check = [
        'AuthContext.tsx',
        'components/editor/hooks/useEditorCore.ts',
        'components/editor/utils/contentConverters.ts',
        'components/editor/utils/formatters.ts',
        'services/yjsDocumentManager.ts',
        'components/editor/extensions/CueBlock.ts',
        'components/editor/components/AudioTranscription.tsx'
    ]
    
    print("🔧 Fixing remaining 4-argument logger calls...")
    fixed_count = 0
    
    for file_rel in files_to_check:
        file_path = src_dir / file_rel
        if file_path.exists():
            if fix_four_arg_logger_calls(file_path):
                print(f"  ✅ Fixed: {file_rel}")
                fixed_count += 1
        else:
            print(f"  ❌ Not found: {file_rel}")
    
    print(f"\n✨ Fixed {fixed_count} files with 4-argument logger calls")

if __name__ == '__main__':
    main()