/**
 * useEditorCore Hook  
 * Core editor functionality that integrates with Pessoa's existing infrastructure
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEditor } from '@tiptap/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import Collaboration from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
// 🔧 DISABLED: Offline storage - removed IndexeddbPersistence import
// import { IndexeddbPersistence } from 'y-indexeddb';

import { useAuth } from '../../../AuthContext';
import { DialogueBlock } from '../extensions/DialogueBlock';
import { Speaker } from '../extensions/Speaker';
import { DialogueText } from '../extensions/DialogueText';
import { FontSize } from '../FontSizeExtension';
import { getScriptWithBlocks } from '../../../api';
import { convertBlocksToTiptapContent, extractSpeakerNames } from '../utils/contentConverters';
import { isYDocEmpty } from '../utils/formatters';
import type { 
  UseEditorCoreProps, 
  UseEditorCoreReturn, 
  ConnectionStatus, 
  ContextMenu, 
  ToolbarContext 
} from '../types/index';
import { storeContentSnapshot } from '../../../api';

// 🔧 FIXED: Always use proxy route for WebSocket to avoid direct backend connection issues
// The frontend proxy (vite.config.ts) handles forwarding /api requests to backend
const WS_BASE_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/collab`
  : '/api/collab';

// 🔧 FIXED: Reduce console spam - only log important events
const debugLog = (message: string, ...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(message, ...args);
  }
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
  const [contentSnapshot, setContentSnapshot] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [activeUserCount, setActiveUserCount] = useState<number>(0);

  // 🔧 FIXED: Initialize Yjs document and WebSocket provider with proper dependencies
  useEffect(() => {
    if (!stableScriptId || !stableUser || !stableHasToken || !stableToken) {
      setConnectionStatus('authenticating');
      return;
    }

    debugLog(`[Editor Core] Initializing for script: ${stableScriptId}, user: ${stableUser.username}`);

    const doc = new Y.Doc();
    
    // Ensure the 'default' XmlFragment exists immediately (Tiptap's default field name)
    doc.transact(() => {
      doc.getXmlFragment('default');
    }, 'initializeDefaultFragment');
    
    setYdoc(doc);

    // 🔧 DISABLED: Offline storage - removed IndexedDB persistence
    debugLog(`[Editor Core] Skipping IndexedDB persistence - always fetching from backend`);

    // 🔧 FIXED: Create WebSocket provider with relative URL for proxy support
    const websocketProvider = new WebsocketProvider(
      WS_BASE_URL,
      stableScriptId,
      doc,
      {
        params: {
          token: stableToken?.trim() || '',
        },
      }
    );

    setProvider(websocketProvider);

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
          break;
        default:
          setConnectionStatus('error');
          setErrorMessage(`Connection error: ${event.status}`);
      }
    });

    websocketProvider.on('connection-error', (error: any) => {
      console.error('[Editor] WebSocket connection error:', error);
      setConnectionStatus('error');
      setErrorMessage('Failed to connect to collaboration server');
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
          console.log('🎭 [Theater Collaboration] Active team members:', activeUsers.map(u => `${u.name}${u.isTyping ? ' (typing)' : ''}`).join(', '));
        }
      }
    };

    // Set up awareness tracking
    if (websocketProvider.awareness) {
      websocketProvider.awareness.on('change', trackAwareness);
      trackAwareness(); // Initial count
    }

    // 🔧 FIXED: Clean up properly to prevent memory leaks
    return () => {
      debugLog('[Editor Core] Cleaning up WebSocket provider and Yjs doc...');
      if (websocketProvider.awareness) {
        websocketProvider.awareness.off('change', trackAwareness);
      }
      websocketProvider.destroy();
      // 🔧 DISABLED: Offline storage - removed persistence cleanup
      // persistence.destroy();
      doc.destroy();
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
            StarterKit.configure({
              history: false, // Important: disable history for YJS
            }),
            Collaboration.configure({
              document: ydoc,
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
            FontSize,
            Color,
            TextStyle,
            TextAlign.configure({
              types: ['heading', 'paragraph'],
            }),
          ],
          content: '',
          editable: true,
          autofocus: false,
          onCreate: () => {
            debugLog('[Editor Core] ✅ Collaborative editor created with YJS integration');
          },
        }
      : {
          // Local editor without collaboration
          extensions: [
            StarterKit.configure({
              history: true, // Enable history for local mode
            }),
            DialogueBlock,
            Speaker,
            DialogueText,
            FontSize,
            Color,
            TextStyle,
            TextAlign.configure({
              types: ['heading', 'paragraph'],
            }),
          ],
          content: '',
          editable: true,
          autofocus: false,
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

  // 🔧 FIXED: Content sync with reduced frequency and change detection
  useEffect(() => {
    if (!editorInstance || !stableScriptId || !stableToken) return;

    const syncContent = async () => {
      const currentContent = editorInstance.getHTML();
      const now = Date.now();
      
      // Only sync if content changed and enough time has passed
      if (currentContent !== contentSnapshot && now - lastSyncTime > 500) {
        try {
          await storeContentSnapshot(stableScriptId, currentContent);
          setContentSnapshot(currentContent);
          setLastSyncTime(now);
          debugLog('[Real-time Sync] ✅ Content sync successful');
        } catch (error) {
          console.error('[Real-time Sync] ❌ Content sync failed:', error);
        }
      }
    };

    // Set up periodic sync
    const interval = setInterval(syncContent, 500);
    
    return () => clearInterval(interval);
  }, [editorInstance, stableScriptId, stableToken, contentSnapshot, lastSyncTime]);

  // Load initial content
  useEffect(() => {
    if (!editorInstance || !stableScriptId || !stableToken) return;

    const loadInitialContent = async () => {
      try {
        const scriptData = await getScriptWithBlocks(stableScriptId);
        
        if (scriptData.blocks.length > 0) {
          const content = convertBlocksToTiptapContent(scriptData.blocks);
          editorInstance.commands.setContent(content);
          setContentSnapshot(editorInstance.getHTML());
          
          // 🔧 FIXED: Extract speakers from converted HTML content, not raw blocks
          const speakers = extractSpeakerNames(content);
          setAvailableSpeakers(Array.from(speakers));
          
          debugLog('[YJS Sync] ✅ Using TipTap Collaboration extension for all YJS sync (prevents cursor issues)');
        }
      } catch (error) {
        console.error('[Editor] Failed to load initial content:', error);
        setErrorMessage('Failed to load script content');
      }
    };

    loadInitialContent();
  }, [editorInstance, stableScriptId, stableToken]);

  // Context menu handlers
  const showContextMenu = useCallback((x: number, y: number, context: ToolbarContext) => {
    setContextMenu({ x, y, context });
    setToolbarContext(context);
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu(null);
    setToolbarContext('default');
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
  };
}; 