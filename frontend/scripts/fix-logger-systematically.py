#!/usr/bin/env python3
"""
Systematic fix for logger calls after console.log replacement.
This script properly fixes all logger calls to use the correct signature:
- logger.method(category: string, message: string, data?: any)
"""

import re
from pathlib import Path
from typing import List, Tuple

def analyze_logger_call(line: str) -> Tuple[bool, str]:
    """
    Analyze a line containing a logger call and fix if needed.
    Returns (was_fixed, fixed_line)
    """
    # Pattern for logger calls with 4 arguments (incorrect)
    # Example: logger.error('App', 'Error: ', 'message', data)
    pattern_4_args = r"logger\.(debug|info|warn|error)\s*\(\s*'([^']+)'\s*,\s*'([^']+):\s*'\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)"
    
    match = re.search(pattern_4_args, line)
    if match:
        method = match.group(1)
        category = match.group(2)
        prefix = match.group(3)  # Usually 'Error', 'Warning', etc.
        message = match.group(4)
        data = match.group(5)
        
        # Combine prefix and message properly
        if message.startswith("'") or message.startswith('"'):
            # String literal - concatenate
            fixed = f"logger.{method}('{category}', {message}, {data})"
        else:
            # Variable or expression
            fixed = f"logger.{method}('{category}', {message}, {data})"
        
        return True, line[:match.start()] + fixed + line[match.end():]
    
    # Pattern for logger calls with 3 arguments where middle one is just a label
    # Example: logger.error('App', 'Error: ', error)
    pattern_3_args_label = r"logger\.(debug|info|warn|error)\s*\(\s*'([^']+)'\s*,\s*'(Error|Warning|Info|Debug):\s*'\s*,\s*([^)]+)\s*\)"
    
    match = re.search(pattern_3_args_label, line)
    if match:
        method = match.group(1)
        category = match.group(2)
        label = match.group(3)
        data = match.group(4)
        
        # Fix to proper format
        fixed = f"logger.{method}('{category}', '{label}:', {data})"
        
        return True, line[:match.start()] + fixed + line[match.end():]
    
    return False, line

def fix_file(file_path: Path) -> int:
    """
    Fix all logger calls in a file.
    Returns the number of fixes made.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    fixes_made = 0
    fixed_lines = []
    
    for line in lines:
        was_fixed, fixed_line = analyze_logger_call(line)
        if was_fixed:
            fixes_made += 1
            fixed_lines.append(fixed_line)
        else:
            fixed_lines.append(line)
    
    if fixes_made > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(fixed_lines)
    
    return fixes_made

def find_all_logger_issues() -> List[Tuple[Path, int]]:
    """
    Find all files with logger issues and return a list of (file, line_number) tuples.
    """
    src_dir = Path('/home/admins/projects/pessoa/frontend/src')
    issues = []
    
    for file_path in src_dir.rglob('*.ts'):
        if file_path.name == 'LoggingService.ts':
            continue
        issues.extend(check_file_for_issues(file_path))
    
    for file_path in src_dir.rglob('*.tsx'):
        issues.extend(check_file_for_issues(file_path))
    
    return issues

def check_file_for_issues(file_path: Path) -> List[Tuple[Path, int]]:
    """Check a single file for logger issues."""
    issues = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        for i, line in enumerate(lines, 1):
            if 'logger.' in line:
                # Check for patterns that indicate issues
                if re.search(r"logger\.\w+\([^,]+,[^,]+,[^,]+,[^)]+\)", line):
                    issues.append((file_path, i))
                elif re.search(r"'(Error|Warning|Info|Debug):\s*'\s*,", line):
                    issues.append((file_path, i))
    except Exception as e:
        print(f"Error checking {file_path}: {e}")
    
    return issues

def main():
    print("🔍 Analyzing codebase for logger issues...")
    
    # Find all issues first
    issues = find_all_logger_issues()
    
    if not issues:
        print("✅ No logger issues found!")
        return
    
    print(f"\n📋 Found {len(issues)} logger issues in {len(set(f for f, _ in issues))} files:")
    
    # Group by file
    files_with_issues = {}
    for file_path, line_num in issues:
        if file_path not in files_with_issues:
            files_with_issues[file_path] = []
        files_with_issues[file_path].append(line_num)
    
    # Display issues
    for file_path, line_nums in files_with_issues.items():
        rel_path = file_path.relative_to(Path('/home/admins/projects/pessoa/frontend/src'))
        print(f"  {rel_path}: lines {', '.join(map(str, line_nums))}")
    
    print("\n🔧 Fixing logger issues...")
    
    # Fix each file
    total_fixes = 0
    for file_path in files_with_issues.keys():
        fixes = fix_file(file_path)
        if fixes > 0:
            rel_path = file_path.relative_to(Path('/home/admins/projects/pessoa/frontend/src'))
            print(f"  ✅ Fixed {fixes} issues in {rel_path}")
            total_fixes += fixes
    
    print(f"\n✨ Fixed {total_fixes} logger issues!")
    
    # Verify no issues remain
    remaining_issues = find_all_logger_issues()
    if remaining_issues:
        print(f"\n⚠️  Warning: {len(remaining_issues)} issues remain unfixed")
        for file_path, line_num in remaining_issues[:5]:
            rel_path = file_path.relative_to(Path('/home/admins/projects/pessoa/frontend/src'))
            print(f"  {rel_path}:{line_num}")
    else:
        print("\n✅ All logger issues have been fixed!")

if __name__ == '__main__':
    main()