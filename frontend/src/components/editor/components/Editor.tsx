/**
 * Main Editor Component
 * Orchestrates all editor sub-systems with responsive design
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../AuthContext';
import { Header } from '../../Header';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { useEditorCore } from '../hooks/useEditorCore';
import { PageCanvas } from './page/PageCanvas';
import { Toolbar } from './toolbar/Toolbar';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { SinglePageView, MultiPageView } from '../ViewModes';
import { AudioTranscription } from './AudioTranscription';
// import { ErrorDisplay } from './ui/ErrorDisplay';
// import { StatusIndicator } from './ui/StatusIndicator';
import type { EditorProps, ViewMode } from '../types';

// Import the consolidated styles
import '../styles/variables.css';
import '../styles/responsive.css';
import '../styles/toolbar.css';

export const Editor: React.FC<EditorProps> = ({ 
  scriptId, 
  initialTitle, 
  onNavigateBack 
}) => {
  const { token, user } = useAuth();
  const { config, isMobile } = useResponsiveDesign();
  
  // Initialize editor core with Pessoa's existing infrastructure
  const {
    editor,
    scriptTitle,
    connectionStatus,
    errorMessage,
    speakerNames,
    activeUserCount,
    contextMenu,
    toolbarContext,
    setContextMenu,
    retryConnection,
  } = useEditorCore({
    scriptId,
    user,
    token,
    initialTitle,
  });
  
  // Local UI state
  const [viewMode, setViewMode] = useState<ViewMode>('single-page');
  const [showRuler, setShowRuler] = useState(false);
  const [audioTranscriptionActive, setAudioTranscriptionActive] = useState(false);

  // Debug ruler state
  useEffect(() => {
    console.log('[Editor] showRuler state changed:', showRuler);
  }, [showRuler]);
  
  // Debug view mode changes
  useEffect(() => {
    console.log('[Editor] viewMode changed to:', viewMode);
  }, [viewMode]);
  const [localContextMenu, setLocalContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    onSpeakerName: boolean;
    onPageBackground: boolean;
  }>({
    x: 0,
    y: 0,
    visible: false,
    onSpeakerName: false,
    onPageBackground: false,
  });

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    // Check if clicked on speaker name
    const target = e.target as HTMLElement;
    const speakerElement = target.closest('[data-type="speaker"]');
    
    setLocalContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
      onSpeakerName: !!speakerElement,
      onPageBackground: !speakerElement,
    });
  }, []);

  // Handle context menu actions
  const handleContextMenuAction = useCallback((action: string) => {
    if (!editor) return;
    
    switch (action) {
      case 'insert-dialogue':
        console.log('Inserting dialogue block from context menu');
        editor.chain().focus().insertDialogueBlock().run();
        break;
      case 'toggle-view':
        setViewMode(prev => prev === 'single-page' ? 'multiple-pages' : 'single-page');
        break;
      default:
        console.log('Unknown context menu action:', action);
    }
    
    setLocalContextMenu(prev => ({ ...prev, visible: false }));
  }, [editor]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (localContextMenu.visible) {
        setLocalContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [localContextMenu.visible]);
  
  // Early return if no auth
  if (!token || !user) {
    return (
      <div className="editorContainer">
        <LoadingSpinner size="lg" />
        <p>Authenticating...</p>
      </div>
    );
  }
  
  // Show error if connection failed
  if (connectionStatus === 'error' && errorMessage) {
    return (
      <div className="editorContainer">
        <div className="error-display">
          <h3>Connection Error</h3>
          <p>{errorMessage}</p>
          <button onClick={retryConnection}>Retry Connection</button>
        </div>
      </div>
    );
  }

  // Handle animated navigation back
  const handleAnimatedNavigation = useCallback(() => {
    // Add exit animation class if needed
    const pageElement = document.querySelector('.dinA4Page');
    if (pageElement) {
      pageElement.classList.add('exiting');
    }
    
    setTimeout(() => {
      onNavigateBack();
    }, 100);
  }, [onNavigateBack]);

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

  // Debug logging for responsive behavior
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Editor] Responsive config:', {
        breakpoint: config.breakpoint,
        isMobile,
        viewport: config.viewport,
      });
    }
  }, [config, isMobile]);

  return (
    <div className="editorContainer">
      {/* Header */}
      <Header 
        currentView="editor" 
        scriptTitle={(scriptTitle || 'Loading...') as string} 
        onNavigateToScripts={handleAnimatedNavigation}
        layouts={[]} // TODO: Implement layout management
        currentLayout={null}
        onLayoutChange={() => {}} // TODO: Implement
        onCreateNewLayout={async () => {}} // TODO: Implement
        onSaveLayout={async () => {}} // TODO: Implement
        activeUserCount={activeUserCount}
      />
      
      {/* Status indicator for mobile */}
      {isMobile && (
        <div className="mobile-status-indicator">
          <span>📱 Mobile optimized view</span>
          <span>Status: {connectionStatus}</span>
        </div>
      )}
      
      {/* Main editor content with ViewMode support */}
      {viewMode === 'single-page' ? (
        <SinglePageView 
          showRuler={showRuler}
          onToggleRuler={() => setShowRuler(!showRuler)}
          onToggleViewMode={() => setViewMode('multiple-pages')}
        >
          {editor ? (
            <div 
              className="editor-content"
              onContextMenu={handleContextMenu}
              onClick={(e) => {
                // Close context menu on click
                setLocalContextMenu(prev => ({ ...prev, visible: false }));
                
                // Handle editor click for context detection
                const target = e.target as HTMLElement;
                const speakerElement = target.closest('[data-type="speaker"]');
                
                if (speakerElement) {
                  console.log('[Editor] Clicked on speaker element:', speakerElement);
                  // The useEditorCore hook will handle context setting through selection update
                }
              }}
            >
              {/* This is where the TipTap editor content will render */}
              <div ref={(node) => {
                if (node && editor && !node.contains(editor.options.element)) {
                  node.appendChild(editor.options.element);
                }
              }} />
            </div>
          ) : (
            <div className="editor-loading">
              <LoadingSpinner size="lg" />
              <p>Initializing collaborative editor...</p>
            </div>
          )}
        </SinglePageView>
      ) : (
        <MultiPageView 
          showRuler={showRuler}
          onToggleRuler={() => setShowRuler(!showRuler)}
          onToggleViewMode={() => setViewMode('single-page')}
        >
          {editor ? (
            <div 
              className="editor-content"
              onContextMenu={handleContextMenu}
              onClick={(e) => {
                // Close context menu on click
                setLocalContextMenu(prev => ({ ...prev, visible: false }));
                
                // Handle editor click for context detection
                const target = e.target as HTMLElement;
                const speakerElement = target.closest('[data-type="speaker"]');
                
                if (speakerElement) {
                  console.log('[Editor] Clicked on speaker element:', speakerElement);
                  // The useEditorCore hook will handle context setting through selection update
                }
              }}
            >
              {/* This is where the TipTap editor content will render */}
              <div ref={(node) => {
                if (node && editor && !node.contains(editor.options.element)) {
                  node.appendChild(editor.options.element);
                }
              }} />
            </div>
          ) : (
            <div className="editor-loading">
              <LoadingSpinner size="lg" />
              <p>Initializing collaborative editor...</p>
            </div>
          )}
        </MultiPageView>
      )}
      
      {/* Context Menu */}
      {localContextMenu.visible && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            left: `${localContextMenu.x}px`,
            top: `${localContextMenu.y}px`,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 1000,
            minWidth: '200px',
          }}
        >
          {localContextMenu.onPageBackground && (
            <>
              <div 
                className="context-menu-item"
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #eee',
                }}
                onClick={() => handleContextMenuAction('insert-dialogue')}
              >
                💬 Insert Dialogue Block
              </div>
              <div 
                className="context-menu-item"
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                }}
                onClick={() => handleContextMenuAction('toggle-view')}
              >
                {viewMode === 'single-page' ? '📄 Multiple Pages View' : '📃 Single Page View'}
              </div>
            </>
          )}
          
          {localContextMenu.onSpeakerName && (
            <>
              <div 
                className="context-menu-item"
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #eee',
                }}
                onClick={() => handleContextMenuAction('format-speakers')}
              >
                🗣️ Format All Speaker Names
              </div>
              <div 
                className="context-menu-item"
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                }}
                onClick={() => handleContextMenuAction('change-speaker-color')}
              >
                🎨 Change Speaker Color
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Floating Toolbar */}
      <Toolbar 
        editor={editor}
        context={toolbarContext}
        hasTextSelection={editor?.state.selection.empty === false}
        viewMode={viewMode}
        showRuler={showRuler}
        speakerNames={speakerNames}
        onSetViewMode={setViewMode}
        onToggleRuler={() => setShowRuler(!showRuler)}
      />
      
      {/* Audio Transcription - Floating */}
      <AudioTranscription 
        editor={editor}
        isActive={audioTranscriptionActive}
        onToggle={setAudioTranscriptionActive}
      />
    </div>
  );
}; 