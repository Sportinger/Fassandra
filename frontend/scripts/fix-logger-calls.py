#!/usr/bin/env python3

import re
from pathlib import Path

def fix_logger_calls(file_path):
    """Fix logger calls that have too many arguments"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Pattern to match logger calls with 4 arguments: logger.method('Category', 'Message: ', 'actual message', data)
    # We need to combine the 2nd and 3rd arguments
    pattern = r"logger\.(debug|info|warn|error)\s*\(\s*'([^']+)'\s*,\s*'([^:]+):\s*'\s*,\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)"
    
    def replacer(match):
        method = match.group(1)
        category = match.group(2)
        prefix = match.group(3)
        message = match.group(4)
        data = match.group(5)
        
        # Combine prefix and message
        if message.startswith("'") or message.startswith('"'):
            # It's a string literal
            combined = f"'{prefix}: ' + {message}"
        else:
            # It's a variable or expression
            combined = f"`{prefix}: ${{message}}`"
        
        if data:
            return f"logger.{method}('{category}', {combined}, {data})"
        else:
            return f"logger.{method}('{category}', {combined})"
    
    content = re.sub(pattern, replacer, content)
    
    # Also fix simple cases where we have logger.method('Category', 'Error: ', error)
    pattern2 = r"logger\.(debug|info|warn|error)\s*\(\s*'([^']+)'\s*,\s*'(Error|Warning|Info|Debug):\s*'\s*,\s*([^,)]+)\s*\)"
    
    def replacer2(match):
        method = match.group(1)
        category = match.group(2)
        label = match.group(3)
        var = match.group(4)
        return f"logger.{method}('{category}', '{label}', {var})"
    
    content = re.sub(pattern2, replacer2, content)
    
    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    src_dir = Path('/home/admins/projects/pessoa/frontend/src')
    
    files_to_fix = [
        'App.tsx',
        'AuthContext.tsx', 
        'components/Header.tsx',
        'components/ScriptList.tsx',
        'components/editor/hooks/useEditorCore.ts',
        'components/editor/components/toolbar/Toolbar.tsx',
        'components/editor/ViewModes/MultiPageView.tsx',
        'services/ApiService.ts',
        'services/ClaudeSessionService.ts',
        'services/yjsDocumentManager.ts',
        'utils/csrf.ts'
    ]
    
    fixed = 0
    for file_rel in files_to_fix:
        file_path = src_dir / file_rel
        if file_path.exists():
            if fix_logger_calls(file_path):
                print(f"✅ Fixed: {file_rel}")
                fixed += 1
            else:
                print(f"⏭️  No changes needed: {file_rel}")
        else:
            print(f"❌ Not found: {file_rel}")
    
    print(f"\nFixed {fixed} files")

if __name__ == '__main__':
    main()