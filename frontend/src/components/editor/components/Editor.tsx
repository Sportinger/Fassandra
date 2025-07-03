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
      />
      
      {/* Status indicator for mobile */}
      {isMobile && (
        <div className="mobile-status-indicator">
          <span>📱 Mobile optimized view</span>
          <span>Status: {connectionStatus}</span>
        </div>
      )}
      
      {/* Main editor content */}
      <PageCanvas showRuler={showRuler}>
        {/* TipTap Editor with DIN A4 responsive design */}
        <div className="dinA4Page">
          {editor ? (
            <div 
              className="editor-content"
              onClick={(e) => {
                // Handle context menu
                if (e.button === 2) { // Right click
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    visible: true,
                    onSpeakerName: false,
                    onPageBackground: true,
                  });
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
        </div>
      </PageCanvas>
      
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
    </div>
  );
}; 