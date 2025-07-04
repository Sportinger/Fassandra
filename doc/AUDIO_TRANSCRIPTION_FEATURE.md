# Audio Transcription Feature

## Overview

The audio transcription feature allows users to record audio (speech) and automatically highlight the corresponding text in the script. This is useful for rehearsals, performances, or when following along with a script reading.

## Features

- **Audio Device Selection**: Choose from available microphones
- **Real-time Transcription**: Uses Web Speech API for live speech-to-text
- **Smart Text Matching**: Matches transcribed text to script content with confidence scoring
- **Auto-highlighting**: Automatically highlights matching text in the editor
- **Speaker Recognition**: Shows which speaker's lines are being matched
- **Responsive UI**: Works on desktop and mobile devices

## How to Use

1. **Open the Audio Transcription Panel**:
   - Click the "🎤 Audio Transcription" button in the top-right corner of the editor

2. **Select Audio Device**:
   - Choose your preferred microphone from the dropdown menu
   - The default microphone will be selected automatically

3. **Start Listening**:
   - Click "🎤 Start Listening" to begin audio transcription
   - The button will turn red and show "🔴 Stop Listening" when active
   - Grant microphone permissions when prompted

4. **Speak or Play Audio**:
   - Speak the lines from the script or play audio/video
   - The transcribed text will appear in real-time
   - Matching text in the script will be highlighted automatically

5. **View Matches**:
   - When a match is found, you'll see:
     - Confidence percentage (how sure the system is about the match)
     - Speaker name (if applicable)
     - The matched text from the script
   - The corresponding text in the editor will be highlighted in yellow

6. **Stop Listening**:
   - Click "🔴 Stop Listening" to end the session
   - All highlights will be cleared

## Technical Requirements

- **Browser Support**: Chrome, Edge, or other Chromium-based browsers
- **Microphone Access**: Required for audio input
- **Language**: Currently supports English (US)
- **Internet Connection**: Required for speech recognition

## Tips for Best Results

1. **Clear Audio**: Speak clearly and at a moderate pace
2. **Reduce Background Noise**: Use a quiet environment for better transcription
3. **Follow the Script**: The system matches transcribed text to existing script content
4. **Confidence Threshold**: Only matches with 60% or higher confidence are highlighted
5. **Multiple Speakers**: Works with dialogue between different speakers

## Privacy & Security

- Audio processing is handled by the browser's built-in Web Speech API
- No audio data is stored or sent to external servers
- Speech recognition stops automatically when the panel is closed

## Troubleshooting

**Speech Recognition Not Working**:
- Ensure you're using Chrome or Edge browser
- Check microphone permissions in browser settings
- Try refreshing the page and re-enabling the feature

**No Matches Found**:
- Speak more clearly or slower
- Ensure the spoken text matches the script content
- Check that the script contains the text you're speaking

**Poor Match Quality**:
- Reduce background noise
- Speak directly into the microphone
- Try different microphone settings or devices

## Future Enhancements

- Multi-language support
- Custom confidence thresholds
- Audio playback controls
- Export transcription data
- Integration with video playback
- Advanced text fuzzy matching algorithms

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Recommended |
| Edge | ✅ Full | Recommended |
| Firefox | ❌ Limited | No Web Speech API support |
| Safari | ❌ Limited | Limited Web Speech API support |
| Mobile Chrome | ✅ Full | Touch-optimized interface |
| Mobile Safari | ❌ Limited | Limited Web Speech API support |

## API Reference

The feature uses the standard Web Speech API:
- `SpeechRecognition` / `webkitSpeechRecognition`
- `navigator.mediaDevices.getUserMedia()` for microphone access
- Real-time processing with `continuous: true` and `interimResults: true` 