import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor as EditorInstance } from '@tiptap/react';
import './AudioTranscription.css';

// Speech Recognition API type declarations
declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

interface SpeechRecognitionResult {
  readonly [index: number]: SpeechRecognitionAlternative;
  readonly length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResult;
  readonly length: number;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

interface AudioTranscriptionProps {
  editor: EditorInstance | null;
  isActive: boolean;
  onToggle: (active: boolean) => void;
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface TranscriptionMatch {
  position: number;
  confidence: number;
  text: string;
  speakerName?: string;
}

export const AudioTranscription: React.FC<AudioTranscriptionProps> = ({
  editor,
  isActive,
  onToggle,
}) => {
  const [availableDevices, setAvailableDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState<string>('');
  const [currentMatch, setCurrentMatch] = useState<TranscriptionMatch | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isAudioActive, setIsAudioActive] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-US');
  const [microphoneGain, setMicrophoneGain] = useState<number>(1.0);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const matchHighlightRef = useRef<HTMLElement | null>(null);
  const shouldRestartRef = useRef<boolean>(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    
    if (SpeechRecognition) {
      setIsSupported(true);
    } else if (isFirefox) {
      setIsSupported(false);
      setError('Firefox requires speech recognition to be enabled manually. Please:\n1. Type "about:config" in the address bar\n2. Search for "media.webspeech.recognition.enable"\n3. Set it to "true"\n4. Refresh this page\n\nAlternatively, use Chrome or Edge for immediate access.');
    } else {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or enable it in Firefox.');
    }
  }, []);

  // Load available audio devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const isSecure = window.isSecureContext || 
                        window.location.protocol === 'https:' || 
                        window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';

        if (!isSecure) {
          setError('Microphone access requires HTTPS or localhost. Please use:\n• http://localhost:8081/editor/\n• Or setup HTTPS');
          return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Microphone access is not supported in this browser. Please use Chrome, Edge, or Firefox.');
          return;
        }

        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (permissionError: any) {
          let errorMessage = 'Microphone permission denied. ';
          if (permissionError.name === 'NotAllowedError') {
            errorMessage += 'Please allow microphone access when prompted.';
          } else if (permissionError.name === 'NotFoundError') {
            errorMessage += 'No microphone found. Please connect a microphone and try again.';
          } else {
            errorMessage += `Error: ${permissionError.message || 'Unknown error'}`;
          }
          
          setError(errorMessage);
          return;
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          }));
        
        setAvailableDevices(audioInputs);
        
        if (audioInputs.length > 0 && !selectedDevice) {
          setSelectedDevice(audioInputs[0].deviceId);
        }
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
      } catch (error: any) {
        setError(`Failed to load audio devices: ${error.message}`);
      }
    };

    if (isActive && isSupported) {
      loadDevices();
    }
  }, [isActive, isSupported, selectedDevice]);

  // Initialize audio level monitoring with optimized microphone settings
  const initializeAudioMonitoring = useCallback(async (deviceId: string) => {
    try {
      // Use optimized audio constraints for better sensitivity
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: false,  // Disable to capture more audio
          autoGainControl: false,   // Disable to prevent auto-adjustment
          sampleRate: 48000,        // Higher sample rate
          channelCount: 1           // Mono for better processing
        }
      });
      
      console.log('🎤 🔧 Setting up optimized audio monitoring...');
      
      streamRef.current = stream;
      
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      // Create gain node for manual gain control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = microphoneGain;
      
      // Configure analyser for maximum sensitivity
      analyser.fftSize = 1024;              // Lower for better performance
      analyser.smoothingTimeConstant = 0.1; // Much lower for more responsive detection
      analyser.minDecibels = -100;          // Lower threshold for very quiet sounds
      analyser.maxDecibels = -10;           // Higher threshold for loud sounds
      
      // Connect: microphone -> gain -> analyser
      microphone.connect(gainNode);
      gainNode.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      gainNodeRef.current = gainNode;
      
      // Use time domain data for better level detection
      const dataArray = new Uint8Array(analyser.fftSize);
      let frameCount = 0;
      
      const updateAudioLevel = () => {
        if (analyserRef.current && streamRef.current?.active) {
          // Use time domain data instead of frequency data for better level detection
          analyserRef.current.getByteTimeDomainData(dataArray);
          
          // Calculate RMS (Root Mean Square) for more accurate level detection
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const sample = (dataArray[i] - 128) / 128.0; // Convert to -1 to 1 range
            sum += sample * sample;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          
          // Apply gain boost and convert to percentage
          const amplifiedRMS = rms * microphoneGain;
          const level = Math.min(Math.round(amplifiedRMS * 100 * 5), 100); // Boost by 5x for better sensitivity
          
          setAudioLevel(level);
          setIsAudioActive(level > 5); // Lower threshold for detection
          
          // Enhanced logging for debugging
          if (frameCount % 60 === 0) {
            console.log(`🎤 📊 Audio level: ${level}% (RMS: ${rms.toFixed(3)}, Gain: ${microphoneGain}x)`);
            if (level > 5) {
              console.log('🎤 ✅ Audio detected - good level!');
            } else {
              console.log('🎤 💡 Very low audio - try speaking louder or increasing gain');
            }
          }
          
          frameCount++;
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      
      updateAudioLevel();
      
      return stream;
    } catch (error: any) {
      setError(`Failed to initialize audio monitoring: ${error.message}`);
      return null;
    }
  }, [microphoneGain]); // Add microphoneGain as dependency

  // Restart speech recognition with debouncing
  const restartSpeechRecognition = useCallback(() => {
    if (!shouldRestartRef.current) {
      console.log('🎤 Restart cancelled - shouldRestart is false');
      return;
    }
    
    // Clear any existing restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    // Schedule restart with debouncing
    restartTimeoutRef.current = setTimeout(() => {
      if (recognitionRef.current && shouldRestartRef.current) {
        try {
          console.log('🎤 🔄 Restarting speech recognition...');
          recognitionRef.current.start();
        } catch (error) {
          console.log('🎤 ❌ Failed to restart recognition:', error);
        }
      }
      restartTimeoutRef.current = null;
    }, 1000); // Single 1-second delay
  }, []);

  // Initialize speech recognition
  const initializeSpeechRecognition = useCallback(() => {
    if (!isSupported) return null;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return null;
    }
    
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;
      recognition.maxAlternatives = 1;
      
      // Additional debugging and configuration
      console.log('🎤 Speech recognition configuration:', {
        continuous: recognition.continuous,
        interimResults: recognition.interimResults,
        lang: recognition.lang,
        maxAlternatives: recognition.maxAlternatives
      });
      
      recognition.onstart = () => {
        console.log('🎤 ✅ Speech recognition started successfully');
        console.log('🎤 📊 Audio levels are being detected, waiting for speech...');
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        console.log('🎤 Speech recognition result event triggered');
        console.log('🎤 Event details:', event);
        console.log('🎤 Results length:', event.results.length);
        
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          console.log(`🎤 Result ${i}: "${transcript}" (final: ${event.results[i].isFinal})`);
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        const currentTranscript = finalTranscript || interimTranscript;
        setTranscriptionText(currentTranscript);
        
        // Console logging for transcribed text
        if (finalTranscript) {
          console.log('🎤 ✅ Final transcription:', finalTranscript);
        }
        if (interimTranscript) {
          console.log('🎤 ⏳ Interim transcription:', interimTranscript);
        }
        
        if (finalTranscript && editor) {
          const match = findBestMatch(finalTranscript, editor);
          if (match) {
            setCurrentMatch(match);
            highlightMatch(match, editor);
          }
        }
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.log('🎤 ❌ Speech recognition error:', event.error);
        console.log('🎤 Error message:', event.message);
        
        if (event.error === 'no-speech') {
          console.log('🎤 No speech detected, will restart...');
          console.log('🎤 💡 TIP: Try speaking louder, clearer, and closer to the microphone');
          console.log('🎤 💡 TIP: Try saying something like "Hello, this is a test" clearly');
          restartSpeechRecognition();
        } else {
          console.log('🎤 Setting error:', event.error);
          setError(`Speech recognition error: ${event.error}`);
        }
      };
      
      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        if (shouldRestartRef.current) {
          console.log('🎤 Will restart recognition...');
          restartSpeechRecognition();
        }
      };
      
      return recognition;
    } catch (error: any) {
      setError(`Failed to initialize speech recognition: ${error.message}`);
      return null;
    }
  }, [isSupported, editor, restartSpeechRecognition, selectedLanguage]);

  // Find best match function
  const findBestMatch = (transcribedText: string, editor: EditorInstance): TranscriptionMatch | null => {
    const editorText = editor.getText();
    const words = transcribedText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (words.length === 0) return null;
    
    let bestMatch: TranscriptionMatch | null = null;
    let bestScore = 0;
    
    for (let i = 0; i <= editorText.length - words.join(' ').length; i++) {
      const windowText = editorText.slice(i, i + words.join(' ').length + 50).toLowerCase();
      let score = 0;
      
      for (const word of words) {
        if (windowText.includes(word)) {
          score += 1;
        }
      }
      
      const confidence = (score / words.length) * 100;
      
      if (confidence > 60 && confidence > bestScore) {
        bestScore = confidence;
        bestMatch = {
          position: i,
          confidence: confidence,
          text: transcribedText,
          speakerName: undefined
        };
      }
    }
    
    return bestMatch;
  };

  // Highlight match function
  const highlightMatch = (match: TranscriptionMatch, editor: EditorInstance) => {
    if (matchHighlightRef.current) {
      matchHighlightRef.current.classList.remove('audio-transcription-highlight');
    }
    
    const from = match.position;
    const to = Math.min(from + match.text.length, editor.getText().length);
    
    setTimeout(() => {
      editor.commands.focus();
      editor.commands.setTextSelection({ from, to });
      
      const selectedElement = document.querySelector('.ProseMirror .is-selected');
      if (selectedElement) {
        selectedElement.classList.add('audio-transcription-highlight');
        matchHighlightRef.current = selectedElement as HTMLElement;
        
        setTimeout(() => {
          if (matchHighlightRef.current) {
            matchHighlightRef.current.classList.remove('audio-transcription-highlight');
          }
        }, 3000);
      }
    }, 100);
  };

  // Toggle listening function
  const toggleListening = useCallback(async () => {
    if (isListening) {
      // Stop listening
      setIsListening(false);
      shouldRestartRef.current = false;
      
      // Clear restart timeout
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      analyserRef.current = null;
      gainNodeRef.current = null;
      setAudioLevel(0);
      setIsAudioActive(false);
      setTranscriptionText('');
      setCurrentMatch(null);
      setError(null);
      
    } else {
      // Start listening
      setError(null);
      
             try {
         const stream = await initializeAudioMonitoring(selectedDevice);
         if (!stream) return;
         
         const recognition = initializeSpeechRecognition();
         if (!recognition) return;
         
         recognitionRef.current = recognition;
         shouldRestartRef.current = true;
         
         console.log('🎤 Starting speech recognition with optimized audio settings...');
         recognition.start();
         console.log('🎤 Recognition.start() called, setting listening to true');
         setIsListening(true);
        
      } catch (error: any) {
        setError(`Failed to start audio transcription: ${error.message}`);
      }
    }
  }, [isListening, selectedDevice, initializeAudioMonitoring, initializeSpeechRecognition]);

  // Update gain in real-time when user changes slider
  useEffect(() => {
    if (gainNodeRef.current && isListening) {
      gainNodeRef.current.gain.value = microphoneGain;
      console.log(`🎤 🔧 Updated microphone gain to ${microphoneGain}x`);
    }
  }, [microphoneGain, isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      gainNodeRef.current = null;
    };
  }, []);

  if (!isActive) {
    return (
      <div className="audio-transcription-toggle">
        <button 
          className="audio-transcription-toggle-btn"
          onClick={() => onToggle(true)}
        >
          🎤 Audio Transcription
        </button>
      </div>
    );
  }

  return (
    <div className="audio-transcription-panel">
      <div className="audio-transcription-header">
        <h3>🎤 Audio Transcription</h3>
        <button 
          className="audio-transcription-close"
          onClick={() => onToggle(false)}
        >
          ×
        </button>
      </div>
      
      {!isSupported ? (
        <div className="audio-transcription-error">
          {error}
          {error?.includes('Firefox') && (
            <div style={{ marginTop: '10px' }}>
              <button 
                className="audio-transcription-permission-btn"
                onClick={() => window.open('about:config', '_blank')}
              >
                🔧 Open Firefox Settings
              </button>
              <button 
                className="audio-transcription-permission-btn"
                onClick={() => window.open('https://www.google.com/chrome/', '_blank')}
                style={{ marginLeft: '8px' }}
              >
                📥 Download Chrome
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="audio-transcription-device-selector">
            <label htmlFor="audio-device">Select Microphone:</label>
            <select
              id="audio-device"
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              disabled={isListening}
            >
              {availableDevices.length > 0 ? (
                availableDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))
              ) : (
                <option value="">No microphones found</option>
              )}
            </select>
            
            <label htmlFor="audio-language" style={{ marginTop: '15px' }}>Speech Language:</label>
            <select
              id="audio-language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={isListening}
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="en-AU">English (Australia)</option>
              <option value="en-CA">English (Canada)</option>
              <option value="de-DE">German</option>
              <option value="fr-FR">French</option>
              <option value="es-ES">Spanish</option>
              <option value="it-IT">Italian</option>
              <option value="pt-PT">Portuguese</option>
              <option value="ru-RU">Russian</option>
            </select>
            
            <label htmlFor="microphone-gain" style={{ marginTop: '15px' }}>
              Microphone Sensitivity: {microphoneGain.toFixed(1)}x
              <span style={{ fontSize: '11px', color: '#6c757d', marginLeft: '8px' }}>
                (Enhanced audio detection)
              </span>
            </label>
            <input
              type="range"
              id="microphone-gain"
              min="0.5"
              max="3.0"
              step="0.1"
              value={microphoneGain}
              onChange={(e) => setMicrophoneGain(parseFloat(e.target.value))}
              disabled={isListening}
              style={{ width: '100%', marginTop: '5px' }}
            />
            <div style={{ 
              fontSize: '11px', 
              color: '#6c757d', 
              marginTop: '5px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Quiet</span>
              <span>Normal</span>
              <span>Loud</span>
            </div>
          </div>
          
          <div className="audio-transcription-controls">
            <button
              onClick={toggleListening}
              className={`audio-transcription-btn ${isListening ? 'listening' : ''}`}
              disabled={!selectedDevice}
            >
              {isListening ? (
                <>🔴 Stop Listening</>
              ) : (
                <>🎤 Start Listening</>
              )}
            </button>
            
            {!isListening && audioLevel < 15 && audioLevel > 0 && (
              <div style={{ 
                marginTop: '15px', 
                padding: '10px', 
                backgroundColor: '#fff3cd', 
                borderRadius: '6px',
                fontSize: '12px',
                textAlign: 'left'
              }}>
                <div style={{ fontWeight: 'bold', color: '#856404' }}>⚠️ Low Microphone Level</div>
                <div style={{ marginTop: '5px', color: '#856404' }}>
                  Your microphone level is {audioLevel}%. The new sensitive detection should show 15%+ when speaking.
                  <br/>
                  <strong>Try:</strong>
                  <br/>• Speaking louder and clearer
                  <br/>• Moving closer to your microphone
                  <br/>• Increasing sensitivity slider above ⬆️
                  <br/>• Checking system microphone volume
                </div>
              </div>
            )}
            
            {!isListening && audioLevel >= 15 && (
              <div style={{ 
                marginTop: '15px', 
                padding: '10px', 
                backgroundColor: '#d4edda', 
                borderRadius: '6px',
                fontSize: '12px',
                textAlign: 'left'
              }}>
                <div style={{ fontWeight: 'bold', color: '#155724' }}>✅ Good Microphone Level</div>
                <div style={{ marginTop: '5px', color: '#155724' }}>
                  Level: {audioLevel}% - Perfect for speech recognition! You can now start listening.
                </div>
              </div>
            )}
          </div>
          
          {/* Audio Level Indicator */}
          {isListening && (
            <div className="audio-level-indicator">
              <div className="audio-level-label">
                <span>🎤 Microphone Activity:</span>
                <span className={`audio-status ${isAudioActive ? 'active' : 'inactive'}`}>
                  {isAudioActive ? '🔊 Audio Detected' : '🔇 No Audio'}
                </span>
              </div>
              <div className="audio-level-bar">
                <div 
                  className="audio-level-fill"
                  style={{ 
                    width: `${audioLevel}%`,
                    backgroundColor: audioLevel > 15 ? '#4CAF50' : audioLevel > 8 ? '#FF9800' : '#f44336'
                  }}
                />
              </div>
              <div className="audio-level-text">
                Level: {audioLevel.toFixed(1)}%
              </div>
            </div>
          )}
          
          {error && (
            <div className="audio-transcription-error">
              {error}
            </div>
          )}
          
          {transcriptionText && (
            <div className="audio-transcription-text">
              <strong>Transcribed:</strong> {transcriptionText}
            </div>
          )}
          
          {currentMatch && (
            <div className="audio-transcription-match">
              <strong>Match found:</strong> {currentMatch.confidence.toFixed(2)}% confidence
              {currentMatch.speakerName && (
                <div className="match-speaker">Speaker: {currentMatch.speakerName}</div>
              )}
              <div className="match-text">{currentMatch.text}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}; 