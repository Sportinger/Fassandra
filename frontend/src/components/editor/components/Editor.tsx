/**
 * Main Editor Component
 * Orchestrates all editor sub-systems with responsive design
 */

import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../../../AuthContext';
import { Header } from '../../Header';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { useEditorCore } from '../hooks/useEditorCore';
import { PageCanvas } from './page/PageCanvas';
import { Toolbar } from './toolbar/Toolbar';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { StatusIndicator } from './ui/StatusIndicator';
import { SinglePageView, MultiPageView } from '../ViewModes';
import { AudioTranscription } from './AudioTranscription';
// Removed DemoModeManager import - development utility
// import { ErrorDisplay } from './ui/ErrorDisplay';
// import { StatusIndicator } from './ui/StatusIndicator';
import type { EditorProps, ViewMode } from '../types';
import { getPageBreaks, updatePageBreaks, PageBreakInfo, PageBreakUpdate } from '../../../api';

// Import the consolidated styles
import '../styles/variables.css';
import '../styles/responsive.css';
import '../styles/toolbar.css';
import '../styles/cue-blocks.css';
import '../styles/scene-blocks.css';
import '../styles/page-indicators.css';
import '../styles/search.css';

interface PageBreak {
  id: string;
  pageNumber: number;
  position: number; // Position in the document (percentage from top)
}

export const Editor: React.FC<EditorProps> = ({ 
  scriptId, 
  initialTitle, 
  onNavigateBack 
}) => {
  // 🔧 CRITICAL FIX: ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const { token, user, tokenReady } = useAuth();
  const { config, isMobile } = useResponsiveDesign();

  // 🔧 FIXED: Reduce debug logging to prevent console spam
  const debugLog = useMemo(() => {
    return process.env.NODE_ENV === 'development' ? console.log : () => {};
  }, []);
  
  // Initialize editor core with Pessoa's existing infrastructure
  const {
    editor,
    ydoc,
    provider,
    connectionStatus,
    errorMessage,
    availableSpeakers,
    contextMenu,
    toolbarContext,
    showContextMenu,
    hideContextMenu,
    activeUserCount,
  } = useEditorCore({
    scriptId,
    user,
    hasToken: !!token,
  });
  
  // Local UI state
  const [viewMode, setViewMode] = useState<ViewMode>('single-page');
  const [showRuler, setShowRuler] = useState(false);
  const [showPageNumbers, setShowPageNumbers] = useState(false);
  const [audioTranscriptionActive, setAudioTranscriptionActive] = useState(false);
  const [pageBreaks, setPageBreaks] = useState<PageBreak[]>([]);
  const [pageBreakInfo, setPageBreakInfo] = useState<PageBreakInfo[]>([]);
  const [loadingPageBreaks, setLoadingPageBreaks] = useState(false);
  
  // Removed demo mode state - development utility
  // Removed demo-related state - development utility
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

  // Fetch page breaks when editor is ready
  useEffect(() => {
    if (!scriptId || !token || !tokenReady) return;

    const fetchPageBreaks = async () => {
      try {
        setLoadingPageBreaks(true);
        const response = await getPageBreaks(scriptId, token);
        setPageBreakInfo(response.blocks);
        
        // Convert page break info to visual page breaks
        const breaks: PageBreak[] = [];
        const pageNumbers = [...new Set(response.blocks.map(b => b.page_number))].sort((a, b) => a - b);
        
        // Calculate cumulative content length for each page to position breaks correctly
        const pageContentLengths: { [key: number]: number } = {};
        let totalContentLength = 0;
        
        // Group blocks by page and calculate content lengths
        pageNumbers.forEach(pageNum => {
          const pageBlocks = response.blocks.filter(b => b.page_number === pageNum);
          const pageContentLength = pageBlocks.reduce((sum, block) => {
            // Estimate content length (characters + formatting)
            const contentLength = (block.content_preview || '').length + 50; // +50 for formatting/spacing
            return sum + contentLength;
          }, 0);
          pageContentLengths[pageNum] = pageContentLength;
          totalContentLength += pageContentLength;
        });
        
        // Calculate cumulative positions for page breaks
        let cumulativeLength = 0;
        pageNumbers.forEach((pageNum, index) => {
          if (pageNum > 1) { // Don't create a break before page 1
            // Add previous page content length to cumulative position
            if (index > 0) {
              cumulativeLength += pageContentLengths[pageNumbers[index - 1]] || 0;
            }
            
            // Convert to pixel position (assume ~1000px document height for typical script)
            const estimatedDocHeight = Math.max(1000, totalContentLength * 0.8); // Adaptive height
            const pixelPosition = (cumulativeLength / totalContentLength) * estimatedDocHeight;
            
            breaks.push({
              id: `page-${pageNum}`,
              pageNumber: pageNum,
              position: Math.max(50, pixelPosition), // Minimum 50px from top
            });
          }
        });
        
        setPageBreaks(breaks);
        debugLog('[Editor] Loaded page breaks with calculated positions:', breaks);
        
        // 🔧 DEMO: If no page breaks exist (all content on page 1), create demo breaks for testing
        if (breaks.length === 0 && showPageNumbers && response.blocks.length > 10) {
          const demoBreaks: PageBreak[] = [
            { id: 'demo-page-2', pageNumber: 2, position: 600 },
            { id: 'demo-page-3', pageNumber: 3, position: 1200 },
            { id: 'demo-page-4', pageNumber: 4, position: 1800 },
          ];
          setPageBreaks(demoBreaks);
          debugLog('[Editor] 🎯 Created demo page breaks for testing:', demoBreaks);
          console.log('📄 Demo page breaks created! All content is currently on page 1. In a real script with multiple pages, these would show actual page transitions.');
        }
      } catch (error) {
        console.error('Failed to fetch page breaks:', error);
      } finally {
        setLoadingPageBreaks(false);
      }
    };

    fetchPageBreaks();
      }, [scriptId, token, tokenReady, debugLog]);

  // Handle page break changes with real-time synchronization
  const handlePageBreaksChange = async (updatedPageBreaks: PageBreak[]) => {
    if (!token || !tokenReady) return;

    try {
      setPageBreaks(updatedPageBreaks);
      
      // Real-time sync: Update Yjs document with page break changes
      if (ydoc) {
        const pageBreakMap = ydoc.getMap('pageBreaks');
        ydoc.transact(() => {
          pageBreakMap.set('breaks', updatedPageBreaks);
          pageBreakMap.set('lastUpdated', Date.now());
          pageBreakMap.set('updatedBy', user?.id || 'unknown');
        });
        debugLog('[Editor] Synchronized page breaks via Yjs:', updatedPageBreaks);
      }
      
      // Convert page break changes to block updates
      const updates: PageBreakUpdate[] = [];
      
      // Logic to determine which blocks need page number updates based on page break positions
      // This is simplified - in a real implementation, you'd need to map page break positions
      // to actual block positions in the document
      pageBreakInfo.forEach(blockInfo => {
        const pageBreak = updatedPageBreaks.find(pb => pb.pageNumber === blockInfo.page_number);
        if (pageBreak) {
          updates.push({
            block_id: blockInfo.block_id,
            page_number: pageBreak.pageNumber,
          });
        }
      });

      if (updates.length > 0) {
        await updatePageBreaks(scriptId, updates, token);
        debugLog('[Editor] Updated page breaks in database:', updates);
      }
    } catch (error) {
      console.error('Failed to update page breaks:', error);
      // Revert changes on error
      const response = await getPageBreaks(scriptId, token);
      setPageBreakInfo(response.blocks);
    }
  };

  // Recalculate page break positions based on actual content in editor
  const recalculatePageBreakPositions = useCallback(() => {
    if (!editor || !showPageNumbers || pageBreakInfo.length === 0) return;

    const editorElement = editor.view.dom;
    if (!editorElement) return;

    const updatedBreaks: PageBreak[] = [];
    const pageNumbers = [...new Set(pageBreakInfo.map(b => b.page_number))].sort((a, b) => a - b);
    
    let cumulativeHeight = 0;
    
    pageNumbers.forEach((pageNum, index) => {
      if (pageNum > 1) {
        // For uploaded content, use the estimated position with some dynamic adjustment
        const pageBlocks = pageBreakInfo.filter(b => b.page_number === pageNum);
        const estimatedHeight = pageBlocks.length * 80; // Rough estimate: 80px per block
        
        // Add some spacing between pages
        cumulativeHeight += estimatedHeight + 40; // 40px spacing between pages
        
        updatedBreaks.push({
          id: `page-${pageNum}`,
          pageNumber: pageNum,
          position: Math.max(100, cumulativeHeight), // Minimum 100px from top
        });
      }
    });

    if (updatedBreaks.length > 0) {
      setPageBreaks(updatedBreaks);
      debugLog('[Editor] Recalculated page break positions:', updatedBreaks);
    }
  }, [editor, showPageNumbers, pageBreakInfo, debugLog]);

  // Initialize default page breaks for manual text entry
  useEffect(() => {
    if (!editor || !showPageNumbers) return;

    // If we have page break info from uploaded content, recalculate positions
    if (pageBreakInfo.length > 0) {
      recalculatePageBreakPositions();
      return;
    }

    // Create default page breaks every 500px (approximate page height)
    const defaultBreaks: PageBreak[] = [];
    for (let i = 2; i <= 5; i++) { // Create page breaks for pages 2-5
      defaultBreaks.push({
        id: `default-page-${i}`,
        pageNumber: i,
        position: (i - 1) * 500, // 500px per page approximation
      });
    }

    // Only set default breaks if we don't have any existing breaks
    if (pageBreaks.length === 0) {
      setPageBreaks(defaultBreaks);
      debugLog('[Editor] Created default page breaks for manual text entry:', defaultBreaks);
    }
  }, [editor, showPageNumbers, pageBreaks.length, pageBreakInfo.length, recalculatePageBreakPositions, debugLog]);

  // Recalculate positions when content changes
  useEffect(() => {
    if (!editor || !showPageNumbers || pageBreakInfo.length === 0) return;

    const handleContentUpdate = () => {
      // Debounce recalculation to avoid excessive updates
      setTimeout(() => {
        recalculatePageBreakPositions();
      }, 1000);
    };

    editor.on('update', handleContentUpdate);

    return () => {
      editor.off('update', handleContentUpdate);
    };
  }, [editor, showPageNumbers, pageBreakInfo.length, recalculatePageBreakPositions]);

  // Listen for real-time page break changes from other users
  useEffect(() => {
    if (!ydoc || !showPageNumbers) return;

    const pageBreakMap = ydoc.getMap('pageBreaks');
    
    const handlePageBreakChanges = () => {
      const remoteBreaks = pageBreakMap.get('breaks');
      const lastUpdated = pageBreakMap.get('lastUpdated');
      const updatedBy = pageBreakMap.get('updatedBy');
      
      if (remoteBreaks && updatedBy !== user?.id) {
        debugLog('[Editor] Received remote page break changes:', remoteBreaks);
        setPageBreaks(remoteBreaks);
        
        // Show notification to user about remote changes
        console.log(`📄 Page numbers updated by another user at ${new Date(lastUpdated).toLocaleTimeString()}`);
      }
    };

    pageBreakMap.observe(handlePageBreakChanges);

    return () => {
      pageBreakMap.unobserve(handlePageBreakChanges);
    };
  }, [ydoc, showPageNumbers, user?.id, debugLog]);

  // Debug ruler state
  useEffect(() => {
    debugLog('[Editor] showRuler state changed:', showRuler);
  }, [showRuler, debugLog]);

  // Debug page numbers state
  useEffect(() => {
    debugLog('[Editor] showPageNumbers state changed:', showPageNumbers);
  }, [showPageNumbers, debugLog]);
  
  // Debug view mode changes
  useEffect(() => {
    debugLog('[Editor] viewMode changed to:', viewMode);
  }, [viewMode, debugLog]);

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
        debugLog('Inserting dialogue block from context menu');
        editor.chain().focus().insertDialogueBlock().run();
        break;
      case 'toggle-view':
        setViewMode(prev => prev === 'single-page' ? 'multiple-pages' : 'single-page');
        break;
      default:
        debugLog('Unknown context menu action:', action);
    }
    
    setLocalContextMenu(prev => ({ ...prev, visible: false }));
  }, [editor, debugLog]);

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

  // Removed demo manager initialization - development utility

  // Removed demo mode toggle function - development utility

  // Debug logging for responsive behavior
  useEffect(() => {
    debugLog('[Editor] Responsive config:', {
      breakpoint: config.breakpoint,
      isMobile,
      viewport: config.viewport,
    });
  }, [config, isMobile, debugLog]);

  // 🔧 CRITICAL FIX: EARLY RETURNS MOVED AFTER ALL HOOKS
  // Early return if no auth
  if (!token || !user || !tokenReady) {
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
          <button onClick={() => window.location.reload()}>Retry Connection</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editorContainer">
      {/* Header */}
      <Header 
        currentView="editor" 
        scriptTitle={(initialTitle || 'Loading...') as string} 
        onNavigateToScripts={handleAnimatedNavigation}
        layouts={[]} // TODO: Implement layout management
        currentLayout={null}
        onLayoutChange={() => {}} // TODO: Implement
        onCreateNewLayout={async () => {}} // TODO: Implement
        onSaveLayout={async () => {}} // TODO: Implement
        activeUserCount={activeUserCount} // Removed demo bot count
        // Removed demo mode props - development utility
      />
      
      {/* 🎭 THEATER ENHANCEMENT: Enhanced collaboration status indicator */}
      {(connectionStatus !== 'connected' || activeUserCount > 0 || isMobile) && (
        <StatusIndicator 
          status={connectionStatus}
          activeUserCount={activeUserCount}
          isMobile={isMobile}
          message={errorMessage || undefined}
        />
      )}
      
      {/* Removed demo mode status indicator - development utility */}
      
      {/* Main editor content with ViewMode support */}
      {viewMode === 'single-page' ? (
        <SinglePageView 
          showRuler={showRuler}
          showPageNumbers={showPageNumbers}
          onToggleRuler={() => setShowRuler(!showRuler)}
          onToggleViewMode={() => setViewMode('multiple-pages')}
          pageBreaks={pageBreaks}
          onPageBreaksChange={handlePageBreaksChange}
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
                  debugLog('[Editor] Clicked on speaker element:', speakerElement);
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
              <div>
                <p>Initializing collaborative editor...</p>
                {ydoc && provider ? (
                  <p style={{ fontSize: '14px', opacity: 0.7 }}>
                    ✅ Collaboration ready - Creating editor...
                  </p>
                ) : (
                  <p style={{ fontSize: '14px', opacity: 0.7 }}>
                    🔄 Status: {connectionStatus} - Setting up real-time sync...
                  </p>
                )}
              </div>
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
                  debugLog('[Editor] Clicked on speaker element:', speakerElement);
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
              <div>
                <p>Initializing collaborative editor...</p>
                {ydoc && provider ? (
                  <p style={{ fontSize: '14px', opacity: 0.7 }}>
                    ✅ Collaboration ready - Creating editor...
                  </p>
                ) : (
                  <p style={{ fontSize: '14px', opacity: 0.7 }}>
                    🔄 Status: {connectionStatus} - Setting up real-time sync...
                  </p>
                )}
              </div>
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
        showPageNumbers={showPageNumbers}
        speakerNames={new Set(availableSpeakers)}
        onSetViewMode={setViewMode}
        onToggleRuler={() => setShowRuler(!showRuler)}
        onTogglePageNumbers={() => setShowPageNumbers(!showPageNumbers)}
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