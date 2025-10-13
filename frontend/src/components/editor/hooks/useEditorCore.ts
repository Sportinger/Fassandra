import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEditor } from '@tiptap/react';

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
import { CueBlockCompat } from '../extensions/CueBlockCompat';
import { SceneBlock } from '../extensions/SceneBlock';
import { TrailingNode } from '../extensions/TrailingNode';
import { CueConnectionMark } from '../extensions/CueConnectionMark';
import { CueSelectTool } from '../extensions/CueSelectTool';
import { BlockPlacementTool } from '../extensions/BlockPlacementTool';
import { CueMigration } from '../extensions/CueMigration';
import { CommentMark } from '../extensions/CommentMark';
import { PageIndicator } from '../extensions/PageIndicator';
import { FontSize } from '../FontSizeExtension';
import { FontFamilyExtension } from '../extensions/FontFamilyExtension';
import { extractSpeakerNames } from '../utils/contentConverters';
import { useContentMigration } from './useContentMigration';
import type {
  UseEditorCoreProps,
  UseEditorCoreReturn,
  ConnectionStatus,
  ContextMenu,
  ToolbarContext,
} from '../types';
import { useCollaborativeConnection } from './useCollaborativeConnection';

/**
 * useEditorCore Hook  
 * Core editor functionality that integrates with Fassandra's existing infrastructure
 */

// 🔧 DISABLED: Offline storage - removed IndexeddbPersistence import
// import { IndexeddbPersistence } from 'y-indexeddb';
// 🔧 SECURE ARCHITECTURE: WebSocket through HTTPS Frontend Proxy 
// All traffic (HTTP + WebSocket) goes through frontend SSL termination
// Frontend proxy (vite.config.ts) forwards to backend with ws: true enabled
// Use environment variable if available (for production), otherwise construct from window location (for dev)
const WS_BASE_URL = typeof window !== 'undefined'
  ? (() => {
      const sameOrigin = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/collab`;
      const envVal = (import.meta as any).env?.VITE_WS_BASE_URL as string | undefined;
      if (!envVal) return sameOrigin;
      try {
        const envUrl = new URL(envVal);
        // If env host differs from current, prefer same-origin to satisfy CSP/connect-src 'self'
        if (envUrl.host !== window.location.host) {
          return sameOrigin;
        }
        return `${envUrl.protocol}//${envUrl.host}${envUrl.pathname.replace(/\/$/, '')}`;
      } catch {
        return sameOrigin;
      }
    })()
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

  const [editor, setEditor] = useState<any>(null);
  const [availableSpeakers, setAvailableSpeakers] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [toolbarContext, setToolbarContext] = useState<ToolbarContext>('default');
  const [isYjsSynced, setIsYjsSynced] = useState<boolean>(false);

  const {
    ydoc,
    provider,
    connectionStatus,
    errorMessage,
    activeUserCount,
  } = useCollaborativeConnection({
    scriptId: stableScriptId,
    user: stableUser,
    hasToken: stableHasToken,
    token: stableToken,
    wsBaseUrl: WS_BASE_URL,
    debugLog,
  });

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
            CueBlock, // ✅ Active CueBlock extension with full functionality
            CueBlockCompat, // compat: parse legacy cue blocks without plugins
            CueConnectionMark,
            SceneBlock,
            CueSelectTool,
            BlockPlacementTool,
            CommentMark,
            CueMigration, // one-time migration of legacy cue blocks
            PageIndicator,
            TrailingNode.configure({
              node: 'paragraph',
              notAfter: ['paragraph'],
            }),
            FontSize,
            FontFamilyExtension,
            Color,
            TextStyle,
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
            CueBlock, // ✅ Active CueBlock extension with full functionality
            CueBlockCompat,
            CueConnectionMark,
            SceneBlock,
            CueSelectTool,
            BlockPlacementTool,
            CommentMark,
            CueMigration,
            PageIndicator,
            TrailingNode.configure({
              node: 'paragraph',
              notAfter: ['paragraph'],
            }),
            FontSize,
            FontFamilyExtension,
            Color,
            TextStyle,
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

          // Update available speakers whenever content changes
          try {
            const html = editor.getHTML();
            if (html && html.length > 0) {
              const speakers = extractSpeakerNames(html);
              setAvailableSpeakers(Array.from(speakers));
            } else {
              setAvailableSpeakers([]);
            }
          } catch {}
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

        // Page indicators deprecated - no-op
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
