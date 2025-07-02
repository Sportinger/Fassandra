import React, { useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../AuthContext';
import { Header } from '../Header';
import { 
  FloatingToolbar, 
  ContextMenu as ContextMenuComponent, 
  SinglePageView, 
  MultiPageView,
  Ruler
} from './';
import { 
  useEditorState, 
  useYjsConnection, 
  useLayoutManagement, 
  useEditorInstance 
} from './hooks';
import { EditorProps, ContextMenuAction } from './types';
import { extractSpeakerNames } from './utils/contentConverters';
import styles from './Editor.module.css';

/**
 * Collaborative rich text editor component for scripts.
 * Integrates Yjs, TipTap, and WebSocket for real-time collaboration.
 */
export const Editor: React.FC<EditorProps> = ({ scriptId, initialTitle, onNavigateBack }) => {
  const { token, user } = useAuth();
  
  // Early return if no auth
  if (!token || !user) {
    return <div className="loading">Authenticating...</div>;
  }
  
  // Use custom hooks for state management
  const editorState = useEditorState(initialTitle);
  
  // Initialize Yjs connection
  useYjsConnection({
    scriptId,
    user,
    token,
    ...editorState,
  });

  // Initialize TipTap editor instance
  const editor = useEditorInstance({
    ydoc: editorState.ydoc,
    provider: editorState.provider,
    user,
    token,
    scriptId,
    pendingContent: editorState.pendingContent,
    setPendingContent: editorState.setPendingContent,
    setSpeakerNames: editorState.setSpeakerNames,
    debouncedSaveRef: editorState.debouncedSaveRef,
    saveTimeoutRef: editorState.saveTimeoutRef,
  });

  // Layout management
  const layoutManagement = useLayoutManagement({
    token,
    scriptId,
    editor,
    layouts: editorState.layouts,
    setLayouts: editorState.setLayouts,
    currentLayout: editorState.currentLayout,
    setCurrentLayout: editorState.setCurrentLayout,
  });

  // Handle animated navigation back
  const handleAnimatedNavigation = useCallback(() => {
    editorState.setIsExiting(true);
    setTimeout(() => {
      onNavigateBack();
    }, 100);
  }, [onNavigateBack, editorState.setIsExiting]);

  // Handle browser back button navigation
  useEffect(() => {
    const handlePopState = (_event: PopStateEvent) => {
      handleAnimatedNavigation();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleAnimatedNavigation]);

  // Context menu and click handlers
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    // Check if clicked on speaker name
    const target = e.target as HTMLElement;
    const speakerName = target.closest('.speaker-name');
    
    editorState.setContextMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true,
      onSpeakerName: !!speakerName,
        onPageBackground: false,
      });
  }, [editorState.setContextMenu]);

  const handlePageContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
    editorState.setContextMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true,
        onSpeakerName: false,
        onPageBackground: true,
      });
  }, [editorState.setContextMenu]);

  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const clickedText = target.textContent || '';
    
    // Check if clicked on speaker name
    if (editorState.speakerNames.has(clickedText.replace(':', '').trim())) {
      editorState.setToolbarContext('speaker-name');
    } else if (!clickedText.trim()) {
      editorState.setToolbarContext('empty-page');
    } else {
      editorState.setToolbarContext('default');
    }
  }, [editorState.speakerNames, editorState.setToolbarContext]);

  // Click outside handler for context menu
  useEffect(() => {
    const handleClick = () => {
      if (editorState.contextMenu.visible) {
        editorState.setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [editorState.contextMenu.visible, editorState.setContextMenu]);

  // Toggle view mode function
  const toggleViewMode = useCallback(() => {
    editorState.setViewMode(prev => prev === 'single-page' ? 'multiple-pages' : 'single-page');
    editorState.setContextMenu(prev => ({ ...prev, visible: false }));
  }, [editorState.setViewMode, editorState.setContextMenu]);

  // Toggle ruler function
  const toggleRuler = useCallback(() => {
    editorState.setShowRuler(prev => !prev);
  }, [editorState.setShowRuler]);

  // Speaker name formatting functions
  const formatAllSpeakerNames = useCallback((format: 'bold' | 'italic' | 'normal') => {
    if (!editor) return;
    
    console.log(`Format all speaker names: ${format}`);
    // Implementation would go here
  }, [editor]);

  const changeSpeakerNameColor = useCallback((color: string) => {
    if (!editor) return;
    
    console.log(`Change speaker name color: ${color}`);
    // Implementation would go here
  }, [editor]);

  // Context menu actions based on context
  const contextMenuActions: (ContextMenuAction | { label: 'separator' })[] = useMemo(() => {
    if (editorState.contextMenu.onPageBackground) {
      return [{
        label: editorState.viewMode === 'single-page' ? '📄 Multiple Pages View' : '📃 Single Page View',
      action: toggleViewMode,
      disabled: false,
      active: false,
      }];
    }
    
    if (editorState.contextMenu.onSpeakerName) {
      return [
    {
      label: '🗣️ Format All Speaker Names',
      action: () => {},
          disabled: true,
      active: false,
    },
    { label: 'separator' },
    {
      label: '💪 Bold All Names',
      action: () => formatAllSpeakerNames('bold'),
      disabled: false,
      active: false,
    },
    {
      label: '🎨 Italic All Names',
      action: () => formatAllSpeakerNames('italic'),
      disabled: false,
      active: false,
    },
    {
      label: '📝 Normal All Names',
      action: () => formatAllSpeakerNames('normal'),
      disabled: false,
      active: false,
    },
    { label: 'separator' },
    {
      label: '🔴 Red Names',
      action: () => changeSpeakerNameColor('#dc2626'),
      disabled: false,
      active: false,
    },
    {
      label: '🔵 Blue Names',
      action: () => changeSpeakerNameColor('#2563eb'),
      disabled: false,
      active: false,
    },
    {
      label: '🟢 Green Names',
      action: () => changeSpeakerNameColor('#16a34a'),
      disabled: false,
      active: false,
    },
    {
      label: '⚫ Default Color',
      action: () => changeSpeakerNameColor('default'),
      disabled: false,
      active: false,
    },
      ];
    }
    
    // Regular context menu for normal text
    return [
    {
      label: 'Bold',
      action: () => editor?.chain().focus().toggleBold().run(),
      disabled: !editor || !editor.can().chain().focus().toggleBold().run(),
      active: editor?.isActive('bold') || false,
    },
    {
      label: 'Italic',
      action: () => editor?.chain().focus().toggleItalic().run(),
      disabled: !editor || !editor.can().chain().focus().toggleItalic().run(),
      active: editor?.isActive('italic') || false,
    },
    { label: 'separator' },
    {
      label: 'Heading 1',
      action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
        disabled: false,
      active: editor?.isActive('heading', { level: 1 }) || false,
    },
    {
      label: 'Heading 2',
      action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
        disabled: false,
      active: editor?.isActive('heading', { level: 2 }) || false,
    },
    {
      label: 'Heading 3',
      action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
        disabled: false,
      active: editor?.isActive('heading', { level: 3 }) || false,
    },
    {
      label: 'Paragraph',
      action: () => editor?.chain().focus().setParagraph().run(),
        disabled: false,
      active: editor ? !editor.isActive('heading') : false,
    },
    { label: 'separator' },
    {
      label: 'Align Left',
      action: () => editor?.chain().focus().setTextAlign('left').run(),
        disabled: false,
      active: editor?.isActive({ textAlign: 'left' }) || false,
    },
    {
      label: 'Align Center',
      action: () => editor?.chain().focus().setTextAlign('center').run(),
        disabled: false,
      active: editor?.isActive({ textAlign: 'center' }) || false,
    },
    {
      label: 'Align Right',
      action: () => editor?.chain().focus().setTextAlign('right').run(),
        disabled: false,
      active: editor?.isActive({ textAlign: 'right' }) || false,
    },
  ];
  }, [editorState.contextMenu, editorState.viewMode, toggleViewMode, formatAllSpeakerNames, changeSpeakerNameColor, editor]);

  // Handle retry connection
  const handleRetry = useCallback(() => {
    console.log("Retrying connection...");
    if (editorState.provider) {
      editorState.provider.disconnect();
    }
    editorState.setStatus('uninitialized');
  }, [editorState.provider, editorState.setStatus]);

  // Determine loading and error states
  const isLoading = !editorState.ydoc || !editorState.provider || editorState.status === 'uninitialized' || editorState.status === 'authenticating';
  const isConnecting = editorState.status === 'connecting' || editorState.status === 'syncing';
  const hasConnectionIssue = editorState.status === 'disconnected' || editorState.status === 'error';

  return (
    <>
      {/* Header */}
      <Header 
        currentView="editor" 
        scriptTitle={editorState.scriptTitle} 
        onNavigateToScripts={handleAnimatedNavigation}
        layouts={editorState.layouts}
        currentLayout={editorState.currentLayout}
        onLayoutChange={layoutManagement.handleLayoutChange}
        onCreateNewLayout={layoutManagement.handleCreateNewLayout}
        onSaveLayout={layoutManagement.handleSaveCurrentLayout}
      />
      
      {/* Page-based editor layout */}
      <div 
        className={`${styles.editorPageContainer} ${editorState.showRuler ? styles.withRuler : ''}`}
        onContextMenu={handlePageContextMenu}
        onClick={handleEditorClick}
      >
        {/* Floating Toolbar */}
        {!isLoading && !hasConnectionIssue && (
          <FloatingToolbar 
            editor={editor} 
            hasTextSelection={!!editor?.state.selection && !editor.state.selection.empty}
            context={editorState.toolbarContext}
            viewMode={editorState.viewMode}
            onSetViewMode={editorState.setViewMode}
            showRuler={editorState.showRuler}
            onToggleRuler={toggleRuler}
          />
        )}
        
        {/* Loading and Error states */}
        {isLoading ? (
          <div className={styles.loading}>Loading Editor...</div>
        ) : hasConnectionIssue ? (
            <div className={styles.error}>
            <p>{editorState.errorMessage || 'Connection failed.'}</p>
              <button onClick={handleRetry} className={styles.retryButton}>Retry</button>
          </div>
        ) : editorState.viewMode === 'multiple-pages' ? (
          <MultiPageView 
            editor={editor}
            scriptCreationDate={editorState.scriptCreationDate}
            isExiting={editorState.isExiting}
            handlePageContextMenu={handlePageContextMenu}
            handleContextMenu={handleContextMenu}
            handleEditorClick={handleEditorClick}
            showRuler={editorState.showRuler}
            onToggleRuler={toggleRuler}
          />
        ) : (
          <SinglePageView 
            editor={editor}
            scriptCreationDate={editorState.scriptCreationDate}
            isExiting={editorState.isExiting}
            handlePageContextMenu={handlePageContextMenu}
            handleContextMenu={handleContextMenu}
            handleEditorClick={handleEditorClick}
            showRuler={editorState.showRuler}
            onToggleRuler={toggleRuler}
          />
        )}

        {/* Context Menu */}
        <ContextMenuComponent 
          contextMenu={editorState.contextMenu}
          actions={contextMenuActions}
        />
      </div>
    </>
  );
};