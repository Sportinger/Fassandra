#!/usr/bin/env python3
"""
Fix all mangled logger calls that have { message: ..., data: ... } pattern
"""

import re
from pathlib import Path

def fix_mangled_logger_calls(content):
    """Fix logger calls that were incorrectly transformed"""
    
    # Pattern for mangled logger calls with { message: ..., data: ... }
    pattern = r"logger\.(debug|info|warn|error)\(([^,]+),\s*([^,]+),\s*\{\s*message:\s*([^}]+?),\s*data:\s*([^}]+?)\s*\}\s*\)"
    
    def replacer(match):
        method = match.group(1)
        category = match.group(2)
        message = match.group(3)
        arg1 = match.group(4).strip()
        arg2 = match.group(5).strip()
        
        # Reconstruct the proper logger call
        # Most of these were originally 4-argument calls that need to be reduced to 3
        # Combine the data into a single object
        return f"logger.{method}({category}, {message}, {{ value1: {arg1}, value2: {arg2} }})"
    
    content = re.sub(pattern, replacer, content, flags=re.DOTALL)
    
    # Special case: Fix the "Try speaking louder, clearer, and closer" message
    content = re.sub(
        r"'🎤 💡 TIP: Try speaking louder,\s*\{\s*message:\s*clearer,\s*data:\s*and closer to the microphone'\s*\}",
        "'🎤 💡 TIP: Try speaking louder, clearer, and closer to the microphone'",
        content
    )
    
    # Another pattern: Fix incomplete template literals
    content = re.sub(
        r"`([^`]+),\s*\{\s*message:\s*([^,}]+),\s*data:\s*([^}]+)\s*\}",
        lambda m: f"`{m.group(1)}, {m.group(2)}, {m.group(3)}`" if "falling back" in m.group(1) else m.group(0),
        content
    )
    
    return content

def fix_specific_issues(file_path):
    """Fix specific known issues in files"""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    fixed_lines = []
    for i, line in enumerate(lines):
        # Fix AuthContext.tsx line 85
        if "AuthProvider setToken called" in line and "{ message:" in line:
            line = '    logger.debug(\'AuthContext\', "AuthProvider setToken called:", { newToken, newUser });\n'
        
        # Fix useEditorCore.ts line 222
        elif "Theater Collaboration" in line and "{ message:" in line:
            line = "            logger.debug('useEditorCore', '🎭 [Theater Collaboration] Active team members:', activeUsers.map(u => `${u.name}${u.isTyping ? ' (typing)' : ''}`).join(', '));\n"
        
        # Fix contentConverters scene-block error
        elif "Failed to create scene-block" in line and "{ message:" in line:
            line = "            logger.error('contentConverters', `[Content Converter] Failed to create scene-block, falling back to text`, parseError);\n"
        
        # Fix contentConverters cue block debug
        elif "Creating cue block - Type" in line and "{ message:" in line:
            line = '            logger.debug(\'contentConverters\', `[Content Converter] Creating cue block - Type: "${cueType}", Number: "${cueNumber}", Content: "${cueContent}"`);\n'
        
        # Fix contentConverters general error
        elif "Failed to convert block of type" in line and "{ message:" in line:
            line = "      logger.error('contentConverters', `[Content Converter] Failed to convert block of type '${blockType}': ${contentJsonString}`, e);\n"
        
        # Fix formatters warnings
        elif "Expected string content for paragraph" in line and "{ message:" in line:
            line = "        logger.warn('formatters', `[Editor Format] Expected string content for paragraph after parsing, but got ${typeof actualText}: ${actualText}`);\n"
        
        elif "Failed to parse or format block content" in line and "{ message:" in line:
            line = "    logger.error('formatters', `[Editor Format] Failed to parse or format block content for type '${blockType}': ${contentJsonString}`, e);\n"
        
        elif "Failed to parse paragraph content as JSON" in line and "{ message:" in line:
            line = "        logger.warn('formatters', `[Editor Format] Failed to parse paragraph content as JSON, attempting to use as raw text: ${contentJsonString}`);\n"
        
        # Fix AudioTranscription tip
        elif "Try speaking louder" in line and "{ message:" in line:
            line = "          logger.debug('AudioTranscription', '🎤 💡 TIP: Try speaking louder, clearer, and closer to the microphone');\n"
        
        # Fix CueBlock debug messages
        elif "CueBlock" in line and "{ message:" in line:
            if "'Offset:'" in line:
                line = "    logger.debug('CueBlock', `${text} Offset: ${parentOffset}`);\n"
            elif "'to word:'" in line:
                line = "                  logger.debug('CueBlock', `${cueData} to word: ${word.text}`);\n"
        
        fixed_lines.append(line)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(fixed_lines)

def main():
    src_dir = Path('/home/admins/projects/pessoa/frontend/src')
    
    files_to_fix = [
        'AuthContext.tsx',
        'components/editor/hooks/useEditorCore.ts',
        'components/editor/utils/contentConverters.ts',
        'components/editor/utils/formatters.ts',
        'components/editor/components/AudioTranscription.tsx',
        'components/editor/extensions/CueBlock.ts'
    ]
    
    print("🔧 Fixing all mangled logger calls...")
    
    for file_rel in files_to_fix:
        file_path = src_dir / file_rel
        if file_path.exists():
            fix_specific_issues(file_path)
            print(f"  ✅ Fixed: {file_rel}")
        else:
            print(f"  ❌ Not found: {file_rel}")
    
    print("\n✨ All mangled logger calls have been fixed!")

if __name__ == '__main__':
    main()