#!/usr/bin/env python3

import json
import sys
import os
import subprocess
import re
import time
import requests
import hashlib

def clean_text(text):
    """Clean text for TTS"""
    # Remove markdown bold
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    # Remove code blocks
    text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
    # Remove inline code
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Limit length
    text = text[:1000]
    return text.strip()

def main():
    # Debug logging
    with open('/tmp/claude_tts_debug.log', 'a') as f:
        f.write(f"\n--- Hook triggered at {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
    
    try:
        # Read input
        input_data = json.load(sys.stdin)
        
        with open('/tmp/claude_tts_debug.log', 'a') as f:
            f.write(f"Input data: {json.dumps(input_data, indent=2)}\n")
        
        # For Stop event, read the transcript to get the last response
        transcript_path = input_data.get('transcript_path', '')
        
        if not transcript_path or not os.path.exists(transcript_path):
            sys.exit(0)
        
        # Read the transcript
        with open(transcript_path, 'r') as f:
            lines = f.readlines()
        
        # Find the last assistant message
        last_assistant_content = None
        for line in reversed(lines):
            try:
                entry = json.loads(line.strip())
                # Debug: log what we're checking
                with open('/tmp/claude_tts_debug.log', 'a') as f:
                    if 'message' in entry and entry['message'].get('role'):
                        f.write(f"Checking entry with role: {entry['message'].get('role')}\n")
                
                # Look for message.role == 'assistant' (updated structure)
                if 'message' in entry and entry['message'].get('role') == 'assistant':
                    content_items = entry['message'].get('content', [])
                    for item in reversed(content_items):
                        if item.get('type') == 'text' and item.get('text'):
                            last_assistant_content = item.get('text')
                            break
                    if last_assistant_content:
                        break
            except:
                continue
        
        if not last_assistant_content:
            with open('/tmp/claude_tts_debug.log', 'a') as f:
                f.write("No assistant content found!\n")
            sys.exit(0)
        
        with open('/tmp/claude_tts_debug.log', 'a') as f:
            f.write(f"Found assistant content: {last_assistant_content[:100]}...\n")
        
        # Create a hash of the content to check for duplicates
        content_hash = hashlib.md5(last_assistant_content.encode()).hexdigest()
        lock_file = f"/tmp/claude_tts_lock_{content_hash}"
        
        # Check if we've already processed this within 5 seconds
        if os.path.exists(lock_file):
            file_age = time.time() - os.path.getmtime(lock_file)
            if file_age < 5:
                with open('/tmp/claude_tts_debug.log', 'a') as f:
                    f.write(f"Skipping duplicate (processed {file_age:.1f}s ago)\n")
                sys.exit(0)
        
        # Create lock file
        with open(lock_file, 'w') as f:
            f.write(str(time.time()))
        
        # Clean up old lock files
        for f in os.listdir('/tmp'):
            if f.startswith('claude_tts_lock_'):
                full_path = os.path.join('/tmp', f)
                if os.path.getmtime(full_path) < time.time() - 60:
                    os.unlink(full_path)
        
        # Clean the text
        text = clean_text(last_assistant_content)
        
        if len(text) < 1:
            sys.exit(0)
        
        # Log API call
        with open('/tmp/claude_tts_debug.log', 'a') as f:
            f.write(f"Making API call for text: {text[:50]}...\n")
        
        # Use ElevenLabs API directly
        api_key = "sk_4972eb0e2ba025c29afc4c1eab48076e94930a99df9718c0"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": api_key
        }
        
        data = {
            "text": text,
            "model_id": "eleven_flash_v2_5",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        response = requests.post(
            "https://api.elevenlabs.io/v1/text-to-speech/YW25Vx3qQ2GQQNbsIrgZ",
            json=data,
            headers=headers,
            stream=True
        )
        
        if response.status_code == 200:
            # Save audio
            timestamp = int(time.time() * 1000)
            temp_file = f"/tmp/claude_tts_{timestamp}.mp3"
            
            with open(temp_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk:
                        f.write(chunk)
            
            # Try different audio players
            # First try mpg123 (works with mp3 directly)
            try:
                subprocess.run(["mpg123", "-q", temp_file], capture_output=True, check=True)
            except:
                # Try paplay with direct mp3 playback via gstreamer
                try:
                    subprocess.run(["paplay", temp_file], capture_output=True)
                except:
                    # Last resort - try using python's built-in playback
                    try:
                        import playsound
                        playsound.playsound(temp_file)
                    except:
                        pass
            
            # Clean up
            os.unlink(temp_file)
        
    except Exception as e:
        with open('/tmp/claude_tts_error.log', 'a') as f:
            f.write(f"Error: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()