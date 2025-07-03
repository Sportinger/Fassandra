/**
 * useEditorCore Hook
 * Core editor functionality that integrates with Pessoa's existing infrastructure
 */

import { useState, useEffect, useCallback } from 'react';
import { useEditor } from '@tiptap/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';

import { useAuth } from '../../../AuthContext';
import { DialogueBlock } from '../extensions/DialogueBlock';
import { Speaker } from '../extensions/Speaker';
import { DialogueText } from '../extensions/DialogueText';
import { FontSize } from '../FontSizeExtension';
import type { 
  UseEditorCoreProps, 
  UseEditorCoreReturn, 
  ConnectionStatus, 
  ContextMenu, 
  ToolbarContext 
} from '../types/index';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/api/collab';

export const useEditorCore = ({
  scriptId,
  user,
  token,
  initialTitle = 'Untitled Script',
}: UseEditorCoreProps): UseEditorCoreReturn => {
  // State management
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [scriptTitle, setScriptTitle] = useState(initialTitle);
  const [scriptCreationDate, setScriptCreationDate] = useState<string | null>(null);
  const [speakerNames, setSpeakerNames] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('uninitialized');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
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

    const doc = new Y.Doc();
    setYdoc(doc);

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

    // Cleanup
    return () => {
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
      // Collaboration extensions
      ...(ydoc ? [
        Collaboration.configure({
          document: ydoc,
        }),
        CollaborationCursor.configure({
          provider: provider,
          user: {
            name: user.name || user.email || 'Anonymous',
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          },
        }),
      ] : []),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none',
        spellcheck: 'false',
      },
    },
    onUpdate: ({ editor }) => {
      // Update speaker names when content changes
      const speakers = extractSpeakerNames(editor.getJSON());
      setSpeakerNames(speakers);
    },
    onSelectionUpdate: ({ editor }) => {
      // Update toolbar context based on selection
      updateToolbarContext(editor);
    },
  }, [ydoc, provider]);

  // Extract speaker names from editor content
  const extractSpeakerNames = useCallback((content: any): Set<string> => {
    const speakers = new Set<string>();
    
    const traverse = (node: any) => {
      if (node.type === 'speaker' && node.attrs?.name) {
        speakers.add(node.attrs.name);
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };
    
    if (content.content) {
      content.content.forEach(traverse);
    }
    
    return speakers;
  }, []);

  // Update toolbar context based on editor state
  const updateToolbarContext = useCallback((editor: any) => {
    if (!editor) return;

    const { selection } = editor.state;
    const { empty } = selection;

    if (empty) {
      setToolbarContext('default');
    } else {
      setToolbarContext('text-selection');
    }
  }, []);

  // Load script metadata
  useEffect(() => {
    if (!scriptId || !token) return;

    const loadScriptMetadata = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/scripts/${scriptId}`, {
          headers: {
            'Authorization': `Bearer ${token || ''}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const script = await response.json();
          setScriptTitle(script.title || 'Untitled Script');
          setScriptCreationDate(script.created_at || null);
        }
      } catch (error) {
        console.error('[Editor] Failed to load script metadata:', error);
      }
    };

    loadScriptMetadata();
  }, [scriptId, token]);

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