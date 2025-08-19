import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useEditor } from '@tiptap/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import Collaboration from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
// Import individual extensions instead of StarterKit for better tree shaking
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { Strike } from '@tiptap/extension-strike';
import { Code } from '@tiptap/extension-code';
import { History } from '@tiptap/extension-history';
import { Dropcursor } from '@tiptap/extension-dropcursor';
import { Gapcursor } from '@tiptap/extension-gapcursor';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
// FontFamily will be handled through TextStyle
import { TextAlign } from '@tiptap/extension-text-align';
import logger from '../../../services/LoggingService';
import { useAuth } from '../../../AuthContext';
import { DialogueBlock } from '../extensions/DialogueBlock';
import { Speaker } from '../extensions/Speaker';
import { DialogueText } from '../extensions/DialogueText';
import { CueBlock } from '../extensions/CueBlock';
import { SceneBlock } from '../extensions/SceneBlock';
import { PageIndicator } from '../extensions/PageIndicator';
import { TrailingNode } from '../extensions/TrailingNode';
import { CueConnectionMark } from '../extensions/CueConnectionMark';
import { FontSize } from '../FontSizeExtension';
import { FontFamilyExtension } from '../extensions/FontFamilyExtension';
import { extractSpeakerNames } from '../utils/contentConverters';
import { scriptEventBus } from '../../../services/ScriptEventBus';
import { isYDocEmpty } from '../utils/formatters';
import { yjsDocumentManager } from '../../../services/yjsDocumentManager';
import type { 
  UseEditorCoreProps, 
  UseEditorCoreReturn, 
  ConnectionStatus, 
  ContextMenu, 
  ToolbarContext 
} from '../types/index';

/**
 * useEditorCore Hook  
 * Core editor functionality that integrates with Pessoa's existing infrastructure
 */

// 🔧 DISABLED: Offline storage - removed IndexeddbPersistence import
// import { IndexeddbPersistence } from 'y-indexeddb';
// 🔧 SECURE ARCHITECTURE: WebSocket through HTTPS Frontend Proxy 
// All traffic (HTTP + WebSocket) goes through frontend SSL termination
// Frontend proxy (vite.config.ts) forwards to backend with ws: true enabled
// Use environment variable if available (for production), otherwise construct from window location (for dev)
const WS_BASE_URL = typeof window !== 'undefined' 
  ? (import.meta.env.VITE_WS_BASE_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/collab`)
  : '/api/collab';

// 🔧 FIXED: Reduce console spam - only log important events
const debugLog = (message: string, ...args: any[]) => {
  // Only log critical events to reduce noise
  const criticalEvents = [
    'Initializing for script',
    'WebSocket connection error',
    'Connection lost',
    'Failed to fetch'
  ];
  
  if (import.meta.env.DEV && criticalEvents.some(event => message.includes(event))) {
    logger.debug('useEditorCore', message, ...args);
  }
};

// Helper function to clean cue block UI elements from HTML
const cleanCueBlockHTML = (html: string): string => {
  let cleaned = html;
  cleaned = cleaned.replace(/<div[^>]*class="cue-connection-drag-area"[^>]*>[\s\S]*?<\/div>/g, '');
  cleaned = cleaned.replace(/<div[^>]*class="cue-move-drag-area"[^>]*>[\s\S]*?<\/div>/g, '');
  cleaned = cleaned.replace(/<span[^>]*class="drag-handle"[^>]*>⋮⋮<\/span>/g, '');
  cleaned = cleaned.replace(/<span[^>]*class="cue-label"[^>]*>[^<]*:<\/span>/g, '');
  cleaned = cleaned.replace(/<span[^>]*class="cue-number"[^>]*>Q\d*<\/span>/g, '');
  return cleaned;
};

export const useEditorCore = ({
  scriptId,
  user,
  hasToken,
}: UseEditorCoreProps): UseEditorCoreReturn => {
  // 🔧 FIXED: Memoize values to prevent infinite re-renders
  const stableScriptId = useMemo(() => scriptId, [scriptId]);
  const stableUser = useMemo(() => user, [user]);
  const stableHasToken = useMemo(() => hasToken, [hasToken]);

  const { token } = useAuth();
  const stableToken = useMemo(() => token, [token]);

  // State management
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [editor, setEditor] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [availableSpeakers, setAvailableSpeakers] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [toolbarContext, setToolbarContext] = useState<ToolbarContext>('default');
  const [isYjsSynced, setIsYjsSynced] = useState<boolean>(false);
  const [activeUserCount, setActiveUserCount] = useState<number>(0);
  
  // Track provider ref for cleanup
  const providerRef = useRef<WebsocketProvider | null>(null);
  const previousScriptIdRef = useRef<string | null>(null);

  // 🔧 FIXED: Initialize Yjs document and WebSocket provider with proper dependencies
  useEffect(() => {
    // Skip initialization if already initialized for this script
    if (providerRef.current && previousScriptIdRef.current === stableScriptId) {
      debugLog(`[Editor Core] Skipping re-initialization for script: ${stableScriptId}`);
      return;
    }

    if (!stableScriptId || !stableUser || !stableHasToken || !stableToken) {
      setConnectionStatus('authenticating');
      return;
    }

    debugLog(`[Editor Core] Initializing for script: ${stableScriptId}, user: ${stableUser.username}`);

    // 🔧 FIX: Detect script changes to force new document only when switching scripts
    const isScriptChange = previousScriptIdRef.current !== null && previousScriptIdRef.current !== stableScriptId;
    previousScriptIdRef.current = stableScriptId;

    // 🔧 FIX: Reuse existing document on refresh to maintain WebSocket stability
    // Only force new document when switching to a different script
    const doc = yjsDocumentManager.getDocument(stableScriptId, isScriptChange); // Force new only on script change
    const docInfo = yjsDocumentManager.getDocumentInfo(stableScriptId);
    
    debugLog(`[Editor Core] Using persistent Y.Doc from manager:`, {
      scriptId: stableScriptId,
      clientID: doc.clientID,
      refCount: docInfo.refCount,
      isNew: docInfo.refCount === 1
    });
    
    setYdoc(doc);

    // 🔧 DISABLED: Offline storage - removed IndexedDB persistence
    debugLog(`[Editor Core] Skipping IndexedDB persistence - always fetching from backend`);

    // Function to fetch WebSocket token and create provider
    const initializeWebSocket = async () => {
      // Fetch the actual JWT token for WebSocket authentication
      let wsToken = stableToken;
      if (stableToken === 'authenticated') {
        try {
          const response = await fetch('/api/ws-token', {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            wsToken = data.token;
          } else {
            logger.error('useEditorCore', '[Editor Core] Failed to get WebSocket token:', response.status);
          }
        } catch (error) {
          logger.error('useEditorCore', '[Editor Core] Error fetching WebSocket token:', error);
        }
      }

      // 🔧 FIXED: Create WebSocket provider with error handling
      let websocketProvider: WebsocketProvider;
      try {
        // Don't clear the document when connecting - YJS will handle sync properly
        // The server sends the full state and YJS merges it correctly with local state
        if (providerRef.current) {
          logger.debug('useEditorCore', '[Editor Core] Reconnecting to existing document');
        }
        
        // Add global error handler for YJS decode errors
        const originalError = window.onerror;
        window.onerror = (message, source, lineno, colno, error) => {
          if (message && message.toString().includes('Unexpected end of array')) {
            logger.error('useEditorCore', '[Editor] YJS decode error caught:', error);
            // Prevent the error from crashing the app
            return true;
          }
          // Call original handler if exists
          if (originalError) {
            return originalError(message, source, lineno, colno, error);
          }
          return false;
        };
        
        // Detect Firefox browser
        const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
        
        websocketProvider = new WebsocketProvider(
          WS_BASE_URL,
          stableScriptId,
          doc,
          {
            params: {
              token: wsToken?.trim() || '',
            },
            // Prevent aggressive reconnection that might cause browser refresh
            maxBackoffTime: 30000, // Max 30 seconds between reconnection attempts
            resyncInterval: isFirefox ? 10000 : 5000, // Slower resync for Firefox
            // Add WebSocket options to prevent connection issues
            WebSocketPolyfill: WebSocket,
            connect: true,
            // Firefox-specific: disable binary type check
            disableBc: isFirefox,
          }
        );

        setProvider(websocketProvider);
        providerRef.current = websocketProvider;
      } catch (error) {
        logger.error('useEditorCore', '[Editor Core] Failed to create WebSocket provider:', error);
        setConnectionStatus('error');
        setErrorMessage('Failed to initialize collaboration');
        return;
      }

      // Connection status handlers
      websocketProvider.on('status', (event: { status: string }) => {
        switch (event.status) {
          case 'connecting':
            setConnectionStatus('connecting');
            setErrorMessage(null);
            break;
          case 'connected':
            setConnectionStatus('connected');
            setErrorMessage(null);
            debugLog('[Editor] WebSocket connected successfully');
            break;
          case 'disconnected':
            setConnectionStatus('disconnected');
            // Don't set error for normal disconnection - provider will reconnect
            break;
          default:
            setConnectionStatus('error');
            setErrorMessage(`Connection error: ${event.status}`);
        }
      });

      websocketProvider.on('connection-error', (error: any) => {
        logger.error('useEditorCore', '[Editor] WebSocket connection error:', error);
        setConnectionStatus('error');
        setErrorMessage('Connection lost. Retrying...');
        
        // Auto-reconnect after a delay
        setTimeout(() => {
          if (websocketProvider && !websocketProvider.wsconnected) {
            debugLog('[Editor] Attempting to reconnect WebSocket...');
            websocketProvider.connect();
          }
        }, 2000);
      });
      
      // Handle sync errors (like "Unexpected end of array")
      websocketProvider.on('sync-error', (error: any) => {
        logger.error('useEditorCore', '[Editor] YJS sync error:', error);
        // Don't crash, just log and try to recover
        setConnectionStatus('error');
        setErrorMessage('Sync error. Reconnecting...');
        
        // Force reconnection to get clean state
        setTimeout(() => {
          if (websocketProvider) {
            websocketProvider.disconnect();
            setTimeout(() => websocketProvider.connect(), 500);
          }
        }, 1000);
      });

      // 🔧 NEW: Track active users from awareness
      const trackAwareness = () => {
        if (websocketProvider.awareness) {
          const awarenessStates = websocketProvider.awareness.getStates();
          // Count all awareness states except our own
          const userCount = Math.max(0, awarenessStates.size - 1);
          setActiveUserCount(userCount);
          debugLog(`[Collaboration] Active users: ${userCount} (excluding self)`);
          
          // 🎭 THEATER PRIORITY: Enhanced collaboration awareness for theater teams
          const activeUsers = Array.from(awarenessStates.values())
            .filter((state: any) => state.user && state.user.name !== stableUser?.username)
            .map((state: any) => ({
              name: state.user.name,
              color: state.user.color,
              lastSeen: Date.now(),
              isTyping: state.cursor ? true : false
            }));
          
          if (activeUsers.length > 0) {
            logger.debug('useEditorCore', '🎭 [Theater Collaboration] Active team members:', activeUsers.map(u => `${u.name}${u.isTyping ? ' (typing)' : ''}`).join(', '));
          }
        }
      };

      // Set up awareness tracking
      if (websocketProvider.awareness) {
        websocketProvider.awareness.on('change', trackAwareness);
        trackAwareness(); // Initial count
      }
    };

    // Call the async function to initialize WebSocket
    initializeWebSocket();

    // 🔧 FIXED: Clean up properly to prevent memory leaks
    return () => {
      debugLog('[Editor Core] Cleaning up WebSocket provider (keeping Yjs doc persistent)...');
      
      // 🔧 FIX: Disconnect provider gracefully before destroying
      if (providerRef.current) {
        debugLog('[Editor Core] Disconnecting and destroying WebSocket provider, but keeping document');
        providerRef.current.disconnect();
        // Small delay to allow proper disconnect before destroy
        setTimeout(() => {
          if (providerRef.current) {
            providerRef.current.destroy();
            providerRef.current = null;
          }
        }, 100);
      }
      
      // 🔧 FIX: Release document reference but don't destroy it on unmount
      // Document persists for quick reconnection on refresh
      if (stableScriptId) {
        yjsDocumentManager.releaseDocument(stableScriptId);
        const docInfo = yjsDocumentManager.getDocumentInfo(stableScriptId);
        debugLog('[Editor Core] Released document reference (keeping for refresh):', {
          scriptId: stableScriptId,
          remainingRefCount: docInfo.refCount,
          stillExists: docInfo.exists
        });
      }
      
      setProvider(null);
      setYdoc(null);
      setActiveUserCount(0);
    };
  }, [stableScriptId, stableUser, stableHasToken, stableToken]);

  // 🔧 FIXED: Editor initialization with proper collaboration recreation
  const editorInstance = useEditor(
    ydoc && provider
      ? {
          // Collaborative editor with YJS
          extensions: [
            // Core extensions (StarterKit replacements)
            Document,
            Paragraph,
            Text,
            Bold,
            Italic,
            Strike,
            Code,
            // No History - disabled for YJS
            Dropcursor,
            Gapcursor,
            Collaboration.configure({
              document: ydoc,
              field: 'xmlFragment', // Use xmlFragment to prevent duplication issues
            }),
            CollaborationCursor.configure({
              provider: provider,
              user: {
                name: stableUser?.username || 'Anonymous',
                color: '#f59e0b',
              },
            }),
            DialogueBlock,
            Speaker,
            DialogueText,
            CueBlock,
            CueConnectionMark,
            SceneBlock,
            PageIndicator,
            TrailingNode.configure({
              node: 'paragraph',
              notAfter: ['paragraph'],
            }),
            FontSize,
            FontFamilyExtension,
            Color,
            TextStyle.configure({
              types: ['textStyle'],
            }),
            TextAlign.configure({
              types: ['heading', 'paragraph'],
            }),
          ],
          content: '',
          editable: true,
          autofocus: false,
          editorProps: {
            attributes: {
              spellcheck: 'false',
            },
          },
          onCreate: () => {
            debugLog('[Editor Core] ✅ Collaborative editor created with YJS integration');
          },
        }
      : {
          // Local editor without collaboration
          extensions: [
            // Core extensions (StarterKit replacements)
            Document,
            Paragraph,
            Text,
            Bold,
            Italic,
            Strike,
            Code,
            History, // Enabled for local editing
            Dropcursor,
            Gapcursor,
            DialogueBlock,
            Speaker,
            DialogueText,
            CueBlock,
            CueConnectionMark,
            SceneBlock,
            PageIndicator,
            TrailingNode.configure({
              node: 'paragraph',
              notAfter: ['paragraph'],
            }),
            FontSize,
            FontFamilyExtension,
            Color,
            TextStyle.configure({
              types: ['textStyle'],
            }),
            TextAlign.configure({
              types: ['heading', 'paragraph'],
            }),
          ],
          content: '',
          editable: true,
          autofocus: false,
          editorProps: {
            attributes: {
              spellcheck: 'false',
            },
          },
          onCreate: () => {
            debugLog('[Editor Core] 📝 Local editor created (collaboration pending)');
          },
        },
    [ydoc, provider, stableUser?.username] // Dependencies that trigger recreation
  );

  // Update editor state when instance changes
  useEffect(() => {
    if (editorInstance) {
      setEditor(editorInstance);
      debugLog('[Editor Core] ✅ Collaborative editor instance created successfully');
      
      // 🔧 FIXED: Auto-position cursor only once after content loads
      const timer = setTimeout(() => {
        const content = editorInstance.getHTML();
        if (content && content.length > 50) {
          const firstWordMatch = content.match(/\S+/);
          if (firstWordMatch) {
            const endPos = firstWordMatch.index! + firstWordMatch[0].length;
            editorInstance.commands.focus();
            editorInstance.commands.setTextSelection(endPos);
            debugLog('[Cursor Position] Positioned at end of first word');
          }
        } else {
          editorInstance.commands.focus();
          debugLog('[Cursor Position] Empty script detected, positioning cursor at start');
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [editorInstance]);

  // Note: Editor is now created only when collaboration is ready, so no reinitialize needed

  // YJS handles all synchronization - no need for manual content sync
  // The WebSocket provider automatically syncs all changes

  // Monitor YJS synchronization status
  useEffect(() => {
    if (!provider) return;
    
    const handleSync = (isSynced: boolean) => {
      setIsYjsSynced(isSynced);
      if (isSynced) {
        debugLog('[Editor] ✅ YJS synchronized with server');
        // Extract speakers from current editor content
        const content = editorInstance?.getHTML() || '';
        if (content) {
          const speakers = extractSpeakerNames(content);
          setAvailableSpeakers(Array.from(speakers));
        }
      }
    };
    
    provider.on('sync', handleSync);
    
    return () => {
      provider.off('sync', handleSync);
    };
  }, [provider, editorInstance]);

  // Context menu handlers
  const showContextMenu = useCallback((x: number, y: number, context: ToolbarContext) => {
    setContextMenu({ 
      x, 
      y, 
      visible: true,
      onSpeakerName: context === 'speaker-select',
      onPageBackground: context === 'empty-page'
    });
    setToolbarContext(context);
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu(null);
    setToolbarContext('default');
    
    // Remove selection highlighting
    if (typeof document !== 'undefined') {
      document.querySelectorAll('[data-type="speaker"].speaker-selected').forEach(el => {
        el.classList.remove('speaker-selected');
      });
      document.querySelectorAll('[data-type="cue-block"].cue-selected').forEach(el => {
        el.classList.remove('cue-selected');
      });
    }
  }, []);

  return {
    editor: editorInstance,
    ydoc,
    provider,
    connectionStatus,
    availableSpeakers,
    errorMessage,
    contextMenu,
    toolbarContext,
    showContextMenu,
    hideContextMenu,
    activeUserCount,
    isYjsSynced,
  };
}; 