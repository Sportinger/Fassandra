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
import { useContentMigration } from './useContentMigration';
import { getYjsState, getScriptWithYjs, getYjsUpdates } from '../../../api';
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

    logger.info('useEditorCore', `[EDITOR_INIT] Initializing for script: ${stableScriptId}, user: ${stableUser.username}`);

    // 🔧 FIX: Detect script changes to force new document only when switching scripts
    const isScriptChange = previousScriptIdRef.current !== null && previousScriptIdRef.current !== stableScriptId;
    previousScriptIdRef.current = stableScriptId;

    // 🔧 FIX: Reuse existing document on refresh to maintain WebSocket stability
    // Only force new document when switching to a different script
    const doc = yjsDocumentManager.getDocument(stableScriptId, isScriptChange); // Force new only on script change
    const docInfo = yjsDocumentManager.getDocumentInfo(stableScriptId);
    
    logger.info('useEditorCore', `[EDITOR_DOC] Using persistent Y.Doc from manager:`, {
      scriptId: stableScriptId,
      clientID: doc.clientID,
      refCount: docInfo.refCount,
      isNew: docInfo.refCount === 1
    });
    
    // Log initial document state
    const defaultField = doc.getXmlFragment('default');
    logger.info('useEditorCore', `[EDITOR_DOC_STATE] Initial document state:`, {
      defaultFieldExists: !!defaultField,
      defaultFieldLength: defaultField.length,
      defaultFieldType: defaultField.constructor.name
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
        const originalUnhandledRejection = window.onunhandledrejection;
        
        window.onerror = (message, source, lineno, colno, error) => {
          if (message && message.toString().includes('Unexpected end of array')) {
            logger.error('useEditorCore', '[YJS_DECODE_ERROR] YJS decode error caught:', {
              message,
              source,
              error: error?.toString()
            });
            // Prevent the error from crashing the app
            return true;
          }
          // Call original handler if exists
          if (originalError) {
            return originalError(message, source, lineno, colno, error);
          }
          return false;
        };
        
        // Also catch unhandled promise rejections
        window.onunhandledrejection = (event) => {
          if (event.reason && event.reason.message && event.reason.message.includes('Unexpected end of array')) {
            logger.error('useEditorCore', '[YJS_DECODE_ERROR] YJS decode error in promise:', {
              reason: event.reason.message,
              stack: event.reason.stack
            });
            event.preventDefault();
            return;
          }
          if (originalUnhandledRejection) {
            return originalUnhandledRejection(event);
          }
        };
        
        // Detect Firefox browser
        const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

        // Bootstrap Y.Doc from REST state before opening WebSocket
        let bootstrapped = false;
        try {
          // Ensure auth context is ready by pinging /api/me via ApiService base URL
          try {
            const baseUrl = (await import('../../../services/ApiService')).apiService.getBaseUrl();
            await fetch(`${baseUrl}/api/me`, { credentials: 'include' });
          } catch {}

          const stateBuffer = await getYjsState(stableScriptId);
          const state = new Uint8Array(stateBuffer);
          if (state.byteLength > 0) {
            Y.applyUpdate(doc, state);
            bootstrapped = true;
            logger.info('useEditorCore', '[BOOTSTRAP] Applied server Yjs state', { bytes: state.byteLength });
          } else {
            logger.info('useEditorCore', '[BOOTSTRAP] Server Yjs state empty');
          }
        } catch (e) {
          logger.warn('useEditorCore', '[BOOTSTRAP] Binary state fetch failed, will fallback:', e);
        }
        if (!bootstrapped) {
          try {
            const scriptData: any = await getScriptWithYjs(stableScriptId);
            const b64 = scriptData?.yjs_state as string | undefined;
            if (b64 && b64.length > 0) {
              const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
              if (bytes.byteLength > 0) {
                Y.applyUpdate(doc, bytes);
                bootstrapped = true;
                logger.info('useEditorCore', '[BOOTSTRAP] Applied base64 Yjs state from /api/scripts/:id');
              }
            }
          } catch (e) {
            logger.error('useEditorCore', '[BOOTSTRAP] Fallback base64 state fetch failed:', e);
          }
        }

        // Always fetch recent updates and apply on top (covers non-compacted updates)
        try {
          const updatesResp = await getYjsUpdates(stableScriptId);
          if (updatesResp && Array.isArray(updatesResp.updates)) {
            let applied = 0;
            for (const u of updatesResp.updates) {
              if (u?.data) {
                const bytes = Uint8Array.from(atob(u.data), c => c.charCodeAt(0));
                if (bytes.byteLength > 0) {
                  try { Y.applyUpdate(doc, bytes); applied++; } catch {}
                }
              }
            }
            if (applied > 0) {
              logger.info('useEditorCore', `[BOOTSTRAP] Applied ${applied} recent updates from /api/scripts/:id/updates`);
              bootstrapped = true;
            }
          }
        } catch (e) {
          logger.warn('useEditorCore', '[BOOTSTRAP] Failed to apply recent updates:', e);
        }

        logger.info('useEditorCore', `[WS_PROVIDER_CREATE] Creating WebSocket provider for script: ${stableScriptId}`);
        
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
            resyncInterval: 5000, // Standard resync interval
            // Add WebSocket options to prevent connection issues
            WebSocketPolyfill: WebSocket,
            connect: true,
            // Removed disableBc option - it may interfere with proper YJS binary encoding
          }
        );
        
        logger.info('useEditorCore', `[WS_PROVIDER_CREATED] WebSocket provider created`, {
          url: WS_BASE_URL,
          scriptId: stableScriptId,
          hasDoc: !!doc,
          docClientId: doc.clientID
        });
        
        // Add message interceptor for debugging once WebSocket connects
        const setupMessageInterceptor = () => {
          if (websocketProvider.ws && websocketProvider.ws.send) {
            const originalSend = websocketProvider.ws.send.bind(websocketProvider.ws);
            websocketProvider.ws.send = function(data: any) {
              if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
                const bytes = new Uint8Array(data);
                const hex = Array.from(bytes.slice(0, Math.min(50, bytes.length)))
                  .map(b => b.toString(16).padStart(2, '0'))
                  .join(' ');
                logger.info('useEditorCore', '[WS_SEND] Sending binary message:', {
                  size: bytes.length,
                  firstBytes: hex,
                  msgType: bytes[0],
                  isAwareness: bytes[0] === 0x04
                });
              }
              return originalSend(data);
            };
            logger.info('useEditorCore', '[WS_INTERCEPTOR] Message interceptor installed');
          }
        };
        
        // Try to set up interceptor immediately and on connection
        setupMessageInterceptor();
        websocketProvider.on('status', (event: { status: string }) => {
          if (event.status === 'connected') {
            setupMessageInterceptor();
          }
        });
        
        // Monitor WebSocket connection events
        websocketProvider.on('synced', (synced: boolean) => {
          logger.info('useEditorCore', '[WS_SYNCED] WebSocket sync state changed:', { synced });
          if (synced) {
            const defaultField = doc.getXmlFragment('default');
            logger.info('useEditorCore', '[WS_SYNCED_CONTENT] Content after sync:', {
              defaultFieldLength: defaultField.length,
              hasContent: defaultField.length > 0
            });
            
            // CRITICAL FIX: Force a sync step after connection is established
            // This ensures the YJS document state is properly communicated to the server
            setTimeout(() => {
              doc.transact(() => {
                // This transaction will trigger YJS to send its current state
                logger.info('useEditorCore', '[WS_SYNC_INIT] Forcing initial sync after connection');
              }, 'syncInit');
            }, 100);
          }
        });

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

  // Log editor configuration state
  useEffect(() => {
    if (ydoc && provider) {
      const defaultField = ydoc.getXmlFragment('default');
      logger.info('useEditorCore', '[EDITOR_CONFIG_STATE] Editor configuration ready:', {
        hasYdoc: !!ydoc,
        hasProvider: !!provider,
        defaultFieldLength: defaultField.length,
        providerConnected: (provider as any).wsconnected,
        providerSynced: (provider as any).synced
      });
    }
  }, [ydoc, provider]);

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
              field: 'default', // Use default field which TipTap expects
              // Remove onUpdate callback - it may interfere with YJS sync
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
          onCreate: ({ editor }) => {
            const defaultField = ydoc.getXmlFragment('default');
            logger.info('useEditorCore', '[EDITOR_CREATED] Collaborative editor created with YJS integration', {
              isEmpty: editor.isEmpty,
              htmlLength: editor.getHTML().length,
              yjsDefaultFieldLength: defaultField.length,
              yjsHasContent: defaultField.length > 0
            });
            
            // Log the binding state
            const collabExtension = editor.extensionManager.extensions.find(ext => ext.name === 'collaboration');
            if (collabExtension) {
              logger.info('useEditorCore', '[COLLAB_BINDING] Collaboration extension state:', {
                extensionFound: true,
                hasYdoc: !!(collabExtension as any).options?.document,
                field: (collabExtension as any).options?.field,
                fragment: (collabExtension as any).options?.fragment?.constructor?.name
              });
            } else {
              logger.error('useEditorCore', '[COLLAB_BINDING] Collaboration extension not found!');
            }
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
      logger.info('useEditorCore', '[EDITOR_INSTANCE] Collaborative editor instance created successfully');
      
      // Add transaction listener to track content changes
      const updateHandler = ({ editor, transaction }: any) => {
        if (transaction.docChanged && !transaction.getMeta('fromYjs')) {
          const defaultField = ydoc?.getXmlFragment('default');
          logger.info('useEditorCore', '[EDITOR_TRANSACTION] Document changed:', {
            steps: transaction.steps.length,
            hasSteps: transaction.steps.length > 0,
            isEmpty: editor.isEmpty,
            htmlLength: editor.getHTML().length,
            yjsFieldLength: defaultField?.length
          });
          
          // Check if WebSocket is connected and synced
          if (provider && (provider as any).wsconnected && (provider as any).synced) {
            // Get the collaboration extension's binding
            const collabExtension = editor.extensionManager.extensions.find((ext: any) => ext.name === 'collaboration');
            if (collabExtension && collabExtension.storage?.binding) {
              // Force a YJS update by accessing the binding's document
              const binding = collabExtension.storage.binding;
              logger.info('useEditorCore', '[YJS_BINDING_SYNC] Forcing sync through binding', {
                hasBinding: !!binding,
                bindingType: binding?.constructor?.name
              });
              
              // This will trigger YJS to check for changes and send updates
              if (ydoc) {
                ydoc.transact(() => {
                  // Access the default field to ensure it's marked as changed
                  const field = ydoc.getXmlFragment('default');
                  logger.info('useEditorCore', '[YJS_FORCE_UPDATE] Triggered update check, field length:', field.length);
                }, 'editorChange');
              }
            }
          }
        }
      };
      
      editorInstance.on('update', updateHandler);
      
      // 🔧 FIXED: Auto-position cursor only once after content loads
      const timer = setTimeout(() => {
        const content = editorInstance.getHTML();
        if (content && content.length > 50) {
          const firstWordMatch = content.match(/\S+/);
          if (firstWordMatch) {
            const endPos = firstWordMatch.index! + firstWordMatch[0].length;
            editorInstance.commands.focus();
            editorInstance.commands.setTextSelection(endPos);
            logger.info('useEditorCore', '[CURSOR_POSITION] Positioned at end of first word');
          }
        } else {
          editorInstance.commands.focus();
          logger.info('useEditorCore', '[CURSOR_POSITION] Empty script detected, positioning cursor at start');
        }
      }, 1000);

      return () => {
        clearTimeout(timer);
        editorInstance.off('update', updateHandler);
      };
    }
  }, [editorInstance, ydoc]);

  // Note: Editor is now created only when collaboration is ready, so no reinitialize needed

  // Use content migration hook to handle content from Rust backend
  useContentMigration(ydoc, editorInstance);

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

  // Debug function to manually trigger content sync
  useEffect(() => {
    if (typeof window !== 'undefined' && editorInstance && ydoc && provider) {
      (window as any).debugYjsSync = () => {
        const defaultField = ydoc.getXmlFragment('default');
        logger.info('useEditorCore', '[DEBUG_SYNC] Manual sync triggered:', {
          editorContent: editorInstance.getHTML().substring(0, 200),
          yjsFieldLength: defaultField.length,
          providerConnected: (provider as any).wsconnected,
          providerSynced: (provider as any).synced
        });
        
        // Force a YJS update
        ydoc.transact(() => {
          logger.info('useEditorCore', '[DEBUG_SYNC] Forcing YJS transaction');
        }, 'debugSync');
        
        // Also try to manually send a sync step
        if ((provider as any).ws && (provider as any).ws.readyState === WebSocket.OPEN) {
          const syncStep1 = new Uint8Array([0, 0]); // YJS sync step 1
          (provider as any).ws.send(syncStep1);
          logger.info('useEditorCore', '[DEBUG_SYNC] Sent manual sync step 1');
        }
      };
      
      logger.info('useEditorCore', '[DEBUG] Added window.debugYjsSync() function for debugging');
    }
  }, [editorInstance, ydoc, provider]);

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