/**
 * useEditorCore Hook
 * Core editor functionality that integrates with Pessoa's existing infrastructure
 */

import { useState, useEffect, useCallback } from 'react';
import { useEditor } from '@tiptap/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
import { IndexeddbPersistence } from 'y-indexeddb';

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/api/collab';

export const useEditorCore = ({
  scriptId,
  user,
  token,
  initialTitle = 'Loading...',
}: UseEditorCoreProps): UseEditorCoreReturn => {
  console.log('🚀 useEditorCore called with:', { scriptId, user: user?.username, hasToken: !!token });
  
  // State management
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [scriptTitle, setScriptTitle] = useState(initialTitle);
  const [scriptCreationDate, setScriptCreationDate] = useState<string | null>(null);
  const [speakerNames, setSpeakerNames] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('uninitialized');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [activeUserCount, setActiveUserCount] = useState<number>(0);
  
  // 🔧 SYNC CONTROL: Prevent infinite loops between editor and YJS
  const [isSyncingFromYjs, setIsSyncingFromYjs] = useState<boolean>(false);
  const [isSyncingToYjs, setIsSyncingToYjs] = useState<boolean>(false);
  
  // UI state
  const [contextMenu, setContextMenu] = useState<ContextMenu>({
    x: 0,
    y: 0,
    visible: false,
    onSpeakerName: false,
    onPageBackground: false,
  });
  const [toolbarContext, setToolbarContext] = useState<ToolbarContext>('default');

  // Initialize Yjs document and WebSocket provider
  useEffect(() => {
    if (!scriptId || !user || !token) return;

    console.log(`[Editor Core] Initializing for script: ${scriptId}, user: ${user.username}`);

    const doc = new Y.Doc();
    
    // Ensure the 'default' XmlFragment exists immediately (Tiptap's default field name)
    doc.transact(() => {
      doc.getXmlFragment('default'); // This creates it if it doesn't exist
    }, 'initializeDefaultFragment');
    
    setYdoc(doc);

    // Set up IndexedDB persistence
    console.log(`[Editor Core] Setting up IndexedDB persistence for ${scriptId}...`);
    const persistence = new IndexeddbPersistence(`theater-script-${scriptId}`, doc);

    // Check content after persistence syncs
    persistence.on('synced', (isSynced: boolean) => {
      console.log(`[Editor Core] IndexedDB sync status: ${isSynced}`);
      if (isSynced && token) {
        // Check if content needs fetching AFTER sync
        if (isYDocEmpty(doc)) {
          console.log(`[Editor Core] Y.Doc empty, fetching initial content for script ${scriptId}`);
          getScriptWithBlocks(token, scriptId)
            .then(scriptData => {
              console.log("[Editor Core] Received scriptData:", scriptData);
              setScriptTitle(scriptData.script.title);
              setScriptCreationDate(scriptData.script.created_at);

              // Convert blocks to Tiptap content and set
              const tiptapContent = convertBlocksToTiptapContent(scriptData.blocks);
              console.log("[Editor Core] Converted to TipTap content:", tiptapContent);

              // Store content to be set when editor is ready
              setPendingContent(tiptapContent);
              console.log("[Editor Core] Content converted, stored as pending for editor");
            })
            .catch(error => {
              console.error("[Editor Core] Failed to fetch script content:", error);
              setErrorMessage(`Failed to load script: ${error.message}`);
              setConnectionStatus('error');
            });
        } else {
          console.log(`[Editor Core] Y.Doc not empty, skipping fetch. Document has content.`);
        }
      } else {
        console.log(`[Editor Core] Not fetching content - isSynced: ${isSynced}, hasToken: ${!!token}`);
      }
    });

    // If already synced, handle it immediately
    if (persistence.synced) {
      console.log(`[Editor Core] Persistence already synced, checking content immediately`);
      if (isYDocEmpty(doc) && token) {
        console.log(`[Editor Core] Y.Doc empty (immediate check), fetching initial content for script ${scriptId}`);
        getScriptWithBlocks(token, scriptId)
          .then(scriptData => {
            console.log("[Editor Core] Received scriptData (immediate):", scriptData);
            setScriptTitle(scriptData.script.title);
            setScriptCreationDate(scriptData.script.created_at);

            // Convert blocks to Tiptap content and set
            const tiptapContent = convertBlocksToTiptapContent(scriptData.blocks);
            console.log("[Editor Core] Converted to TipTap content (immediate):", tiptapContent);

            // Store content to be set when editor is ready
            setPendingContent(tiptapContent);
            console.log("[Editor Core] Content converted, stored as pending for editor (immediate)");
          })
          .catch(error => {
            console.error("[Editor Core] Failed to fetch script content (immediate):", error);
            setErrorMessage(`Failed to load script: ${error.message}`);
            setConnectionStatus('error');
          });
      } else {
        console.log(`[Editor Core] Not fetching content (immediate) - isEmpty: ${isYDocEmpty(doc)}, hasToken: ${!!token}`);
      }
    }

    // Create WebSocket provider with Pessoa's existing infrastructure
    const websocketProvider = new WebsocketProvider(
      WS_BASE_URL,
      scriptId,
      doc,
      {
        params: {
          token: token?.trim() || '',
        },
      }
    );

    // 🔧 CUSTOM XML SYNC: Listen for YJS changes and update editor
    const ytext = doc.getText('content');
    const updateEditorFromYjs = () => {
      const htmlContent = ytext.toString();
      if (htmlContent && htmlContent.trim() !== '') {
        console.log('[XML Sync] Received content from YJS:', htmlContent.substring(0, 200) + '...');
        console.log('[XML Sync] YJS content length:', htmlContent.length);
        // Note: We'll set this content when the editor is ready
        if (!pendingContent) {
          console.log('[XML Sync] Setting pending content from YJS');
          setPendingContent(htmlContent);
        }
      } else {
        console.log('[XML Sync] YJS content is empty, length:', htmlContent?.length || 0);
      }
    };

    // Listen for YJS text changes
    ytext.observe(updateEditorFromYjs);
    
    // Initial load of existing content
    updateEditorFromYjs();

    // Connection status handlers
    websocketProvider.on('status', (event: { status: string }) => {
      console.log('[Editor] WebSocket status:', event.status);
      
      switch (event.status) {
        case 'connecting':
          setConnectionStatus('connecting');
          setErrorMessage(null);
          break;
        case 'connected':
          setConnectionStatus('connected');
          setErrorMessage(null);
          console.log('[Collaboration Cursor] WebSocket connected - cursor sharing should be active');
          break;
        case 'disconnected':
          setConnectionStatus('disconnected');
          setErrorMessage('Connection lost. Attempting to reconnect...');
          break;
        default:
          setConnectionStatus('error');
          setErrorMessage(`Connection error: ${event.status}`);
      }
    });

    // Connection error handlers
    websocketProvider.on('connection-error', (error: any) => {
      console.error('[Editor] WebSocket connection error:', error);
      setConnectionStatus('error');
      setErrorMessage('Failed to connect to collaboration server');
    });

    // Sync handlers
    websocketProvider.on('sync', (isSynced: boolean) => {
      console.log('[Editor] Document sync status:', isSynced);
      

      
      if (isSynced) {
        setConnectionStatus('connected');
        setErrorMessage(null);
      } else {
        setConnectionStatus('syncing');
      }
    });

    setProvider(websocketProvider);

    // Add Chrome-specific debugging for Yjs document updates
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
    if (isChrome) {
      doc.on('update', (update: Uint8Array, origin: any) => {
        console.log('[Chrome Debug] Yjs document update received:', {
          updateSize: update.length,
          origin: origin?.constructor?.name || 'unknown',
          timestamp: new Date().toISOString()
        });
        
        // Check content after update
        setTimeout(() => {
          if (editor) {
            const currentHTML = editor.getHTML();
            const speakerElements = currentHTML.match(/data-type="speaker"/g);
            const speakerNames = extractSpeakerNames(currentHTML);
            
            console.log('[Chrome Debug] Post-update content check:');
            console.log('[Chrome Debug] - Speaker elements:', speakerElements ? speakerElements.length : 0);
            console.log('[Chrome Debug] - Speaker names:', Array.from(speakerNames));
            
            // Check if speaker names are being corrupted
            if (speakerNames.size === 0 && speakerElements && speakerElements.length > 0) {
              console.log('[Chrome Debug] WARNING: Speaker elements exist but names not extracted!');
              console.log('[Chrome Debug] - Raw speaker HTML:', currentHTML.match(/<[^>]*data-type="speaker"[^>]*>.*?<\/[^>]*>/g));
            }
          }
        }, 50);
      });
    }

    // Cleanup
    return () => {
      console.log('[Editor Core] Cleaning up WebSocket provider and Yjs doc...');
      persistence.destroy();
      websocketProvider.destroy();
      doc.destroy();
    };
  }, [scriptId, user, token]);



  // Initialize TipTap editor with Pessoa's existing extensions
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Disable history extension (handled by Yjs)
      }),
      Color,
      TextStyle,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      FontSize,
      DialogueBlock,
      Speaker,
      DialogueText,
      // Collaboration extensions - CUSTOM XML SYNC for backend compatibility
      // Instead of storing ProseMirror JSON, we store HTML with data-type attributes
      // NOTE: CollaborationCursor removed to prevent ystate errors during custom sync
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none',
        spellcheck: 'false',
      },
    },
    onUpdate: ({ editor }) => {
      // Update speaker names when content changes
      const speakers = extractSpeakerNames(editor.getHTML());
      setSpeakerNames(speakers);
      
      // 🔄 YJS FALLBACK SYNC: Keep for future compatibility (currently broken due to YJS/YRS version mismatch)
      // NOTE: Primary collaboration now handled by real-time content snapshots above
      if (ydoc && editor && Math.random() < 0.1) { // Only attempt 10% of the time to reduce spam
        console.log('[YJS Fallback] Attempting fallback sync (currently broken)');
        
        try {
          const htmlContent = editor.getHTML();
          // Store HTML content in YText field for when YJS/YRS compatibility is fixed
          ydoc.transact(() => {
            const ytext = ydoc.getText('content');
            const currentContent = ytext.toString();
            
            if (currentContent !== htmlContent) {
              ytext.delete(0, ytext.length);
              ytext.insert(0, htmlContent);
              console.log('[YJS Fallback] ✅ Stored in YText (may not be readable by backend yet)');
            }
          }, 'fallbackSync');
        } catch (error) {
          console.log('[YJS Fallback] ❌ Failed (expected due to version incompatibility):', error.message);
        }
      }
      
      // Add Chrome-specific debugging
      const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
      if (isChrome) {
        console.log('[Chrome Debug] Speaker names updated:', Array.from(speakers));
        console.log('[Chrome Debug] Current HTML snippet:', editor.getHTML().substring(0, 300) + '...');
        
        // Check for dialogue blocks specifically
        const dialogueBlocks = editor.getHTML().match(/data-type="dialogue-block"/g);
        const speakerElements = editor.getHTML().match(/data-type="speaker"/g);
        console.log('[Chrome Debug] Found dialogue blocks:', dialogueBlocks ? dialogueBlocks.length : 0);
        console.log('[Chrome Debug] Found speaker elements:', speakerElements ? speakerElements.length : 0);
      }
    },
    onSelectionUpdate: ({ editor }) => {
      // Update toolbar context based on selection
      updateToolbarContext(editor);
      
      // Debug cursor position sharing
      const { from, to } = editor.state.selection;
      console.log('[Collaboration Cursor] Local cursor position changed:', { from, to });
      
      // Check if there are other users' cursors
      const collaborationState = editor.storage.collaborationCursor;
      if (collaborationState) {
        console.log('[Collaboration Cursor] Other users present:', Object.keys(collaborationState.users || {}));
      }
    },
  }, [ydoc, isSyncingFromYjs, isSyncingToYjs]);

  // Add debugging for collaboration cursor behavior
  useEffect(() => {
    if (editor && provider && connectionStatus === 'connected') {
      // Check collaboration cursor state periodically
      const checkCursorState = () => {
        const collaborationCursor = editor.storage.collaborationCursor;
        if (collaborationCursor && collaborationCursor.users) {
          const allUsers = Object.keys(collaborationCursor.users);
          const currentUserName = user?.name || user?.email || 'Anonymous';
          
          // Filter out the current user from the count
          const otherUsers = allUsers.filter(userId => {
            const userData = collaborationCursor.users[userId];
            return userData && userData.name !== currentUserName;
          });
          
          const otherUsersCount = otherUsers.length;
          
          // Count only OTHER users (not including current user)
          setActiveUserCount(otherUsersCount);
          
          if (otherUsersCount > 0) {
            console.log('[Collaboration Cursor] Other active users:', otherUsersCount);
          }
        } else {
          // No other users are active
          setActiveUserCount(0);
        }
      };
      
      // Check every 5 seconds when connected
      const interval = setInterval(checkCursorState, 5000);
      
      return () => clearInterval(interval);
    } else {
      // Not connected, so no other users
      setActiveUserCount(0);
    }
  }, [editor, provider, connectionStatus]);

  // Apply pending content to editor when both editor and content are ready
  useEffect(() => {
    if (editor && pendingContent && ydoc) {
      console.log("[Editor Core] Setting pending content into editor and Yjs doc");
      console.log("[Editor Core] Pending content preview:", pendingContent.substring(0, 500) + '...');
      console.log("[Editor Core] Pending content length:", pendingContent.length);
      
      // Chrome-specific debugging
      const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
      if (isChrome) {
        console.log("[Chrome Debug] About to set content in Chrome");
        console.log("[Chrome Debug] Content contains dialogue blocks:", pendingContent.includes('data-type="dialogue-block"'));
        console.log("[Chrome Debug] Content contains speaker elements:", pendingContent.includes('data-type="speaker"'));
      }
      
      // Use the editor's command to set content (no need for ydoc.transact wrapper)
      const success = editor.commands.setContent(pendingContent);
      console.log("[Editor Core] setContent command result:", success);
      
      if (isChrome) {
        console.log("[Chrome Debug] setContent command success in Chrome:", success);
      }
      
      // Check if content was set successfully
      setTimeout(() => {
        const currentHTML = editor.getHTML();
        console.log("[Editor Core] Current editor HTML after setting:", currentHTML.substring(0, 500) + '...');
        console.log("[Editor Core] Current editor HTML length:", currentHTML.length);
        
        // Check if dialogue blocks are present
        const dialogueBlocks = currentHTML.match(/data-type="dialogue-block"/g);
        console.log("[Editor Core] Found dialogue blocks:", dialogueBlocks ? dialogueBlocks.length : 0);
        
        if (isChrome) {
          console.log("[Chrome Debug] Post-content check in Chrome:");
          console.log("[Chrome Debug] - Dialogue blocks found:", dialogueBlocks ? dialogueBlocks.length : 0);
          console.log("[Chrome Debug] - Speaker elements found:", currentHTML.match(/data-type="speaker"/g)?.length || 0);
          console.log("[Chrome Debug] - Sample content:", currentHTML.substring(0, 200) + '...');
          
          // Check if speaker names were extracted
          const speakersFound = extractSpeakerNames(currentHTML);
          console.log("[Chrome Debug] - Speaker names extracted:", Array.from(speakersFound));
        }
        
        // Content successfully applied to editor
        console.log("[Editor Core] Content successfully applied to editor");
      }, 100);
      
      console.log("[Editor Core] Content set successfully, clearing pending content");
      
      // Clear pending content
      setPendingContent(null);
    } else {
      console.log("[Editor Core] Waiting for editor, pendingContent, or ydoc:", {
        hasEditor: !!editor,
        hasPendingContent: !!pendingContent,
        hasYdoc: !!ydoc,
        pendingContentLength: pendingContent?.length || 0
      });
    }
  }, [editor, pendingContent, ydoc]);

  // Update toolbar context based on editor state
  const updateToolbarContext = useCallback((editor: any) => {
    if (!editor) return;

    const { selection } = editor.state;
    const { empty, $from } = selection;

    console.log('[Context] Updating toolbar context, selection empty:', empty);

    // First check if we're in a dialogue block
    let isInDialogueBlock = false;
    let isInSpeaker = false;
    
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      console.log(`[Context] Checking node at depth ${depth}:`, node.type.name);
      
      if (node.type.name === 'dialogueBlock') {
        isInDialogueBlock = true;
        console.log('[Context] Found dialogue block at depth', depth);
        break;
      }
      
      if (node.type.name === 'speaker') {
        isInSpeaker = true;
        console.log('[Context] Found speaker at depth', depth);
        break;
      }
    }

    // Determine context based on location and selection
    if (isInSpeaker) {
      console.log('[Context] Setting context to speaker-selection');
      setToolbarContext('speaker-selection');
    } else if (isInDialogueBlock) {
      console.log('[Context] Setting context to dialogue-block');
      setToolbarContext('dialogue-block');
    } else if (!empty) {
      console.log('[Context] Setting context to text-selection');
      setToolbarContext('text-selection');
    } else {
      // Check if we clicked on empty space
      const docSize = editor.state.doc.content.size;
      const currentPos = $from.pos;
      
      if (docSize <= 2 || currentPos <= 2) {
        console.log('[Context] Setting context to empty-page');
        setToolbarContext('empty-page');
      } else {
        console.log('[Context] Setting context to default');
        setToolbarContext('default');
      }
    }
  }, []);

  // Script metadata is already loaded via getScriptWithBlocks calls above
  // Removing duplicate metadata loading that was causing race condition

  // Update script title
  const updateScriptTitle = useCallback(async (newTitle: string) => {
    if (!scriptId || !token || !newTitle.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/scripts/${scriptId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (response.ok) {
        setScriptTitle(newTitle.trim());
      }
    } catch (error) {
      console.error('[Editor] Failed to update script title:', error);
    }
  }, [scriptId, token]);

  // Retry connection
  const retryConnection = useCallback(() => {
    if (provider) {
      provider.connect();
    }
  }, [provider]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (provider) {
        provider.destroy();
      }
      if (ydoc) {
        ydoc.destroy();
      }
    };
  }, [provider, ydoc]);

  // 🚀 PRIMARY REAL-TIME SYNC: Optimized content snapshots (now the main collaboration system)
  useEffect(() => {
    if (!editor || !scriptId || !token) {
      return;
    }

    let lastSentContent = '';
    let isPending = false;

    // Optimized real-time content sync function
    const sendRealtimeContentSync = async () => {
      if (isPending) return; // Prevent concurrent requests
      
      try {
        isPending = true;
        const html = editor.getHTML();
        
        // ✅ CHANGE DETECTION: Only send when content actually changed (including empty content)
        if (html !== lastSentContent) {
          console.log('[Real-time Sync] Sending content update:', html.length, 'chars');
          await storeContentSnapshot(token, scriptId, html, 'html');
          lastSentContent = html; // Update last sent content
          console.log('[Real-time Sync] ✅ Content sync successful');
        }
      } catch (error) {
        console.error('[Real-time Sync] ❌ Content sync failed:', error);
      } finally {
        isPending = false;
      }
    };

    // 🚀 REAL-TIME INTERVAL: 500ms (feels instant, but efficient)
    const realtimeInterval = setInterval(sendRealtimeContentSync, 500);

    // Send initial sync after 1 second
    const initialTimeout = setTimeout(sendRealtimeContentSync, 1000);

    console.log('[Real-time Sync] 🚀 PRIMARY collaboration system initialized (500ms interval)');

    return () => {
      clearInterval(realtimeInterval);
      clearTimeout(initialTimeout);
      console.log('[Real-time Sync] 🛑 Primary collaboration system cleaned up');
    };
  }, [editor, scriptId, token]);

  return {
    // Core editor instance
    editor,
    
    // Document state
    ydoc,
    provider,
    
    // Content state
    scriptTitle,
    scriptCreationDate,
    speakerNames,
    activeUserCount,
    
    // Connection state
    connectionStatus,
    errorMessage,
    
    // UI state
    contextMenu,
    toolbarContext,
    
    // Actions
    setScriptTitle: updateScriptTitle,
    setContextMenu,
    setToolbarContext,
    retryConnection,
  };
}; 