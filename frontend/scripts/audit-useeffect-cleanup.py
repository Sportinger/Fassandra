#!/usr/bin/env python3

import os
import re
from pathlib import Path

def analyze_useeffect(file_path):
    """Analyze useEffect hooks in a file for missing cleanup functions"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to find useEffect hooks
    pattern = r'useEffect\s*\(\s*\(\)\s*=>\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}'
    
    issues = []
    for match in re.finditer(pattern, content):
        effect_body = match.group(1)
        
        # Check for common patterns that need cleanup
        needs_cleanup = []
        
        # Check for event listeners
        if 'addEventListener' in effect_body and 'removeEventListener' not in effect_body:
            needs_cleanup.append('Event listener without cleanup')
        
        # Check for timers
        if ('setTimeout' in effect_body or 'setInterval' in effect_body) and 'clear' not in effect_body:
            needs_cleanup.append('Timer without cleanup')
        
        # Check for WebSocket connections
        if 'WebSocket' in effect_body and '.close()' not in effect_body:
            needs_cleanup.append('WebSocket without cleanup')
        
        # Check for subscriptions (common patterns)
        if ('.on(' in effect_body or '.subscribe(' in effect_body) and not ('return' in effect_body and ('.off(' in effect_body or '.unsubscribe(' in effect_body)):
            needs_cleanup.append('Subscription without cleanup')
        
        # Check if there's no return statement at all for complex effects
        if len(effect_body) > 100 and 'return' not in effect_body:
            if any(keyword in effect_body for keyword in ['addEventListener', 'setTimeout', 'setInterval', '.on(', '.subscribe(']):
                needs_cleanup.append('Complex effect without cleanup function')
        
        if needs_cleanup:
            # Find line number
            lines_before = content[:match.start()].count('\n')
            issues.append({
                'line': lines_before + 1,
                'issues': needs_cleanup,
                'snippet': effect_body[:200] + '...' if len(effect_body) > 200 else effect_body
            })
    
    return issues

def main():
    """Main function to audit all files"""
    src_dir = Path(__file__).parent.parent / 'src'
    
    # Find all TypeScript files
    ts_files = list(src_dir.glob('**/*.ts')) + list(src_dir.glob('**/*.tsx'))
    
    total_issues = 0
    files_with_issues = []
    
    for file_path in ts_files:
        # Skip test files
        if '.test.' in str(file_path) or '.spec.' in str(file_path):
            continue
        
        issues = analyze_useeffect(str(file_path))
        if issues:
            total_issues += len(issues)
            files_with_issues.append({
                'file': str(file_path.relative_to(src_dir.parent)),
                'issues': issues
            })
    
    # Report findings
    if files_with_issues:
        print(f"\n⚠️  Found {total_issues} useEffect hooks that may need cleanup in {len(files_with_issues)} files:\n")
        
        for file_info in files_with_issues:
            print(f"\n📁 {file_info['file']}:")
            for issue in file_info['issues']:
                print(f"   Line {issue['line']}: {', '.join(issue['issues'])}")
                # print(f"      Snippet: {issue['snippet'][:80]}...")
        
        print("\n💡 Recommendations:")
        print("   - Add cleanup functions for event listeners: return () => element.removeEventListener(...)")
        print("   - Clear timers: const timer = setTimeout(...); return () => clearTimeout(timer)")
        print("   - Close connections: return () => websocket.close()")
        print("   - Unsubscribe: const sub = observable.subscribe(...); return () => sub.unsubscribe()")
    else:
        print("✅ All useEffect hooks appear to have proper cleanup!")
    
    return len(files_with_issues)

if __name__ == '__main__':
    import sys
    sys.exit(main())