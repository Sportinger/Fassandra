import { useEffect, useCallback, useMemo } from 'react';
import { useEditor, Editor as EditorInstance } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Heading from '@tiptap/extension-heading';
import TextAlign from '@tiptap/extension-text-align';
import type { TextAlignOptions } from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { saveContentToServer } from '../../../api';
import { extractSpeakerNames } from '../utils/contentConverters';
import { FontSize } from '../FontSizeExtension';
import {
  DialogueBlock,
  DialogueText,
  Speaker,
  CueConnectionMark,
} from '../extensions';

interface UseEditorInstanceProps {
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  user: any;
  token: string;
  scriptId: string;
  pendingContent: string | null;
  setPendingContent: (content: string | null) => void;
  setSpeakerNames: (names: Set<string>) => void;
  debouncedSaveRef: React.MutableRefObject<((editor: EditorInstance) => void) | null>;
  saveTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export const useEditorInstance = ({
  ydoc,
  provider,
  user,
  token,
  scriptId,
  pendingContent,
  setPendingContent,
  setSpeakerNames,
  debouncedSaveRef,
  saveTimeoutRef,
}: UseEditorInstanceProps) => {
  
  // Memoize user details for CollaborationCursor
  const userInfo = useMemo(() => ({
    name: user?.username ?? 'Anonymous',
    color: '#6eeb83', // Default color - could use getUserColor here
  }), [user]);

  // Debounced save mechanism
  const debouncedSave = useCallback((editor: EditorInstance) => {
    if (!token || !scriptId) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const htmlContent = editor.getHTML();
        console.log('[Editor Save] Auto-saving content...');
        
        // Save the content snapshot
        await saveContentToServer(scriptId, htmlContent);
        console.log('[Editor Save] Auto-save successful');
        
      } catch (error) {
        console.error('[Editor Save] Auto-save failed:', error);
      }
    }, 3000); // 3 seconds after typing stops
  }, [token, scriptId, saveTimeoutRef]);
  
  // Update ref whenever debouncedSave changes
  useEffect(() => {
    debouncedSaveRef.current = debouncedSave;
  }, [debouncedSave, debouncedSaveRef]);

  // Debug Chrome WebSocket issues
  useEffect(() => {
    const browserInfo = {
      userAgent: navigator.userAgent,
      isChrome: /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent),
    };
    
    console.log('[Editor Instance Debug] Browser:', browserInfo.isChrome ? 'Chrome' : 'Other');
    console.log('[Editor Instance Debug] ydoc available:', !!ydoc);
    console.log('[Editor Instance Debug] provider available:', !!provider);
    console.log('[Editor Instance Debug] Will use collaborative mode:', !!(ydoc && provider));
  }, [ydoc, provider]);

  // Initialize TipTap Editor
  const editor = useEditor({
    extensions: ydoc && provider ? [
      StarterKit.configure({ 
        history: false, // Disable history to avoid conflicts with Yjs
        heading: false, // Disable default heading to avoid conflicts
      }),
      // Configure Heading extension separately
      Heading.configure({
        levels: [1, 2, 3], // Allow H1, H2, H3
      }),
      // Configure TextAlign extension with default left alignment
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
        defaultAlignment: 'left',
      } as TextAlignOptions),
      // Add Color and TextStyle extensions
      TextStyle,
      Color.configure({
        types: ['textStyle'], // Allow color changes on textStyle marks
      }),
      // Add custom font size extension
      FontSize.configure({
        types: ['textStyle'], // Allow font size changes on textStyle marks
      }),
      // Custom extensions
      DialogueBlock,
      DialogueText,
      Speaker,
      CueConnectionMark,
      Collaboration.configure({
        document: ydoc,
        field: 'default', // Explicitly specify the fragment name
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: userInfo,
        // Custom rendering for collaboration cursor
        render: (user: { name: string; color: string }) => {
          // Create cursor element
          const cursor = document.createElement('div');
          cursor.classList.add('collaboration-cursor');
          cursor.style.borderLeftColor = user.color;
          
          // Create label element that floats and doesn't affect layout
          const label = document.createElement('div');
          label.classList.add('collaboration-cursor-label');
          label.style.backgroundColor = user.color;
          label.textContent = user.name;
          
          // Append label to cursor
          cursor.appendChild(label);
          
          return cursor;
        },
      }),
    ] :
      // More complete fallback setup
      [
      StarterKit.configure({ 
        history: false, 
        heading: false 
      }),
      // Include basic extensions even without collaboration
      Heading.configure({
        levels: [1, 2, 3],
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
        defaultAlignment: 'left',
      } as TextAlignOptions),
      TextStyle,
      Color.configure({
        types: ['textStyle'],
      }),
      // Add custom font size extension
      FontSize.configure({
        types: ['textStyle'],
      }),
        // Custom extensions
        DialogueBlock,
        DialogueText,
        Speaker,
        CueConnectionMark,
    ], // More complete fallback setup
    content: '', // Content will be managed by Yjs
    editable: true, // Ensure editor is always editable
    editorProps: {
      attributes: {
        class: 'editor-content',
        spellcheck: 'false',
        autocorrect: 'off',
        autocomplete: 'off',
        autocapitalize: 'off',
        'data-gramm': 'false', // Disable Grammarly
        'data-enable-grammarly': 'false', // Additional Grammarly disable
      },
    },
    onCreate: () => {
      // Editor created successfully
      console.log('[Editor] Editor created and ready for editing');
    },
    onUpdate: ({ editor }) => {
      // Reduce logging frequency to prevent spam
      if (ydoc && Math.random() < 0.1) { // Only log 10% of updates
        const contentXml = ydoc.getXmlFragment('default');
        console.log('[Editor] Content updated, fragment length:', contentXml.length);
      }
      
      // Auto-save content after typing stops (backup to snapshot service)
      if (debouncedSaveRef.current) {
        debouncedSaveRef.current(editor);
      }
    },
  }, [ydoc, provider]); // Removed debouncedSave to prevent re-creation on token changes

  // Set pending content into the editor when both editor and content are ready
  useEffect(() => {
    if (editor && pendingContent && ydoc) {
      console.log("[Editor Content] Setting pending content into editor and Yjs doc");
      console.log("[Editor Content] Pending content preview:", pendingContent.substring(0, 500) + '...');
      console.log("[Editor Content] Pending content length:", pendingContent.length);
      
      // Set content directly into the Yjs document (which will sync to TipTap)
      const xmlFragment = ydoc.getXmlFragment('default');
      
      // Clear existing content first
      ydoc.transact(() => {
        xmlFragment.delete(0, xmlFragment.length);
        
        // Parse the HTML content and insert into Yjs
        // For now, we'll use the editor's command to set content, which will sync to Yjs
        const success = editor.commands.setContent(pendingContent);
        console.log("[Editor Content] setContent command result:", success);
        
        // Check if content was set successfully
        setTimeout(() => {
          const currentHTML = editor.getHTML();
          console.log("[Editor Content] Current editor HTML after setting:", currentHTML.substring(0, 500) + '...');
          console.log("[Editor Content] Current editor HTML length:", currentHTML.length);
          
          // Check if dialogue blocks are present
          const dialogueBlocks = currentHTML.match(/data-type="dialogue-block"/g);
          console.log("[Editor Content] Found dialogue blocks:", dialogueBlocks ? dialogueBlocks.length : 0);
        }, 100);
        
        console.log("[Editor Content] Content set successfully, clearing pending content");
      }, 'setInitialContent');
      
      // Clear pending content
      setPendingContent(null);
    } else {
      console.log("[Editor Content] Waiting for editor, pendingContent, or ydoc:", {
        hasEditor: !!editor,
        hasPendingContent: !!pendingContent,
        hasYdoc: !!ydoc,
        pendingContentLength: pendingContent?.length || 0
      });
    }
  }, [editor, pendingContent, ydoc, setPendingContent]);

  // Extract speaker names from script data when blocks are loaded
  useEffect(() => {
    if (editor && editor.getHTML()) {
      const extractedNames = extractSpeakerNames(editor.getHTML());
      setSpeakerNames(extractedNames);
      console.log('[Editor] Extracted speaker names:', Array.from(extractedNames));
    }
  }, [editor, editor?.getHTML(), setSpeakerNames]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [saveTimeoutRef]);

  return editor;
}; 