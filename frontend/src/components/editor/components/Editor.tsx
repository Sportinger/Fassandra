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

// Import the consolidated styles
import '../styles/variables.css';
import '../styles/responsive.css';
import '../styles/toolbar.css';
import '../styles/cue-blocks.css';
import '../styles/scene-blocks.css';
import '../styles/page-indicators.css';
import '../styles/search.css';
import '../styles/cue-connections.css';
import '../styles/rehearsal-line.css';


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
  const [audioTranscriptionActive, setAudioTranscriptionActive] = useState(false);
  const [rehearsalMode, setRehearsalMode] = useState(false);
  const [rehearsalLinePosition, setRehearsalLinePosition] = useState<number>(0);
  const [editAllSpeakers, setEditAllSpeakers] = useState(false);
  const [currentSpeakerName, setCurrentSpeakerName] = useState<string | null>(null);
  
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




  // Debug ruler state
  useEffect(() => {
    debugLog('[Editor] showRuler state changed:', showRuler);
  }, [showRuler, debugLog]);
  
  // Debug view mode changes
  useEffect(() => {
    debugLog('[Editor] viewMode changed to:', viewMode);
  }, [viewMode, debugLog]);

  // Highlight all speakers when editAllSpeakers mode changes
  useEffect(() => {
    if (editAllSpeakers && currentSpeakerName) {
      // Highlight all speakers with the current name
      document.querySelectorAll('[data-type="speaker"]').forEach(el => {
        if (el.textContent?.trim() === currentSpeakerName) {
          el.classList.add('speaker-selected');
        } else {
          el.classList.remove('speaker-selected');
        }
      });
    } else {
      // Only highlight the current speaker
      document.querySelectorAll('[data-type="speaker"]').forEach(el => {
        if (el.textContent?.trim() === currentSpeakerName && el.closest('.speaker-selected')) {
          // Keep current speaker highlighted
        } else {
          el.classList.remove('speaker-selected');
        }
      });
    }
  }, [editAllSpeakers, currentSpeakerName]);

  // Sync speaker name changes across all speakers when in "edit all" mode
  useEffect(() => {
    if (!editor || !editAllSpeakers || !currentSpeakerName) return;

    let isUpdating = false;

    const handleUpdate = ({ transaction }: any) => {
      // Skip if we're already updating to prevent recursion
      if (isUpdating || !transaction.docChanged) return;
      
      let speakerChanged = false;
      let newSpeakerName = '';
      let changedPos = -1;
      
      // Find if a speaker was changed
      transaction.steps.forEach((step: any, index: number) => {
        if (step.slice && step.slice.content && step.slice.content.firstChild) {
          const fromPos = step.from || transaction.mapping.maps[index].ranges[0];
          transaction.doc.nodesBetween(fromPos, fromPos + 1, (checkNode: any, pos: number) => {
            if (checkNode.type.name === 'speaker' && checkNode.textContent.trim() !== currentSpeakerName) {
              speakerChanged = true;
              newSpeakerName = checkNode.textContent.trim();
              changedPos = pos;
              return false;
            }
          });
        }
      });
      
      if (speakerChanged && newSpeakerName && changedPos >= 0) {
        // Set flag to prevent recursion
        isUpdating = true;
        
        // Update all other speakers with the old name to the new name
        setTimeout(() => {
          const { state, view } = editor;
          const { tr } = state;
          let hasChanges = false;
          
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'speaker' && 
                node.textContent.trim() === currentSpeakerName && 
                pos !== changedPos) {
              // Replace the text content
              const from = pos + 1;
              const to = from + node.content.size;
              tr.replaceRangeWith(from, to, state.schema.text(newSpeakerName));
              hasChanges = true;
            }
          });
          
          if (hasChanges) {
            view.dispatch(tr);
          }
          
          // Update the current speaker name
          setCurrentSpeakerName(newSpeakerName);
          
          // Reset flag after a delay
          setTimeout(() => {
            isUpdating = false;
          }, 100);
        }, 0);
      }
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, editAllSpeakers, currentSpeakerName]);

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
        scriptTitle={initialTitle} 
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
          onToggleRuler={() => setShowRuler(!showRuler)}
          onToggleViewMode={() => setViewMode('multiple-pages')}
          rehearsalMode={rehearsalMode}
          rehearsalLinePosition={rehearsalLinePosition}
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
                const dialogueTextElement = target.closest('[data-type="dialogue-text"]');
                const dialogueBlockElement = target.closest('[data-type="dialogue-block"]');
                const cueBlockElement = target.closest('[data-type="cue-block"]');
                
                
                // Remove any existing selection classes first
                document.querySelectorAll('[data-type="speaker"].speaker-selected').forEach(el => {
                  el.classList.remove('speaker-selected');
                });
                document.querySelectorAll('[data-type="cue-block"].cue-selected').forEach(el => {
                  el.classList.remove('cue-selected');
                });
                
                if (speakerElement) {
                  // Clicked on speaker - show speaker-select context
                  debugLog('[Editor] Clicked on speaker element:', speakerElement);
                  
                  const speakerName = speakerElement.textContent?.trim() || '';
                  setCurrentSpeakerName(speakerName);
                  
                  // Add selected class to clicked speaker
                  speakerElement.classList.add('speaker-selected');
                  
                  // If editAllSpeakers is true, highlight all speakers with the same name
                  if (editAllSpeakers) {
                    document.querySelectorAll('[data-type="speaker"]').forEach(el => {
                      if (el.textContent?.trim() === speakerName) {
                        el.classList.add('speaker-selected');
                      }
                    });
                  }
                  
                  showContextMenu(e.clientX, e.clientY, 'speaker-select');
                  e.stopPropagation(); // Prevent default toolbar from showing
                } else if (dialogueTextElement && dialogueBlockElement) {
                  // Clicked inside dialogue text - also show speaker-select context
                  debugLog('[Editor] Clicked on dialogue text element:', dialogueTextElement);
                  
                  // Find and highlight the speaker element within the same dialogue block
                  const speakerInBlock = dialogueBlockElement.querySelector('[data-type="speaker"]');
                  if (speakerInBlock) {
                    const speakerName = speakerInBlock.textContent?.trim() || '';
                    setCurrentSpeakerName(speakerName);
                    
                    speakerInBlock.classList.add('speaker-selected');
                    
                    // If editAllSpeakers is true, highlight all speakers with the same name
                    if (editAllSpeakers) {
                      document.querySelectorAll('[data-type="speaker"]').forEach(el => {
                        if (el.textContent?.trim() === speakerName) {
                          el.classList.add('speaker-selected');
                        }
                      });
                    }
                  }
                  
                  showContextMenu(e.clientX, e.clientY, 'speaker-select');
                  e.stopPropagation(); // Prevent default toolbar from showing
                } else if (cueBlockElement) {
                  // Clicked on cue block - show cue-select context
                  debugLog('[Editor] Clicked on cue block element:', cueBlockElement);
                  
                  // Add selected class to clicked cue block
                  cueBlockElement.classList.add('cue-selected');
                  
                  showContextMenu(e.clientX, e.clientY, 'cue-select');
                  e.stopPropagation(); // Prevent default toolbar from showing
                } else {
                  // Clicked elsewhere - hide any special context and clear speaker selection
                  // This allows the toolbar to show text-formatting when text is selected
                  hideContextMenu();
                  setEditAllSpeakers(false);
                  setCurrentSpeakerName(null);
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
          rehearsalMode={rehearsalMode}
          rehearsalLinePosition={rehearsalLinePosition}
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
                const dialogueTextElement = target.closest('[data-type="dialogue-text"]');
                const dialogueBlockElement = target.closest('[data-type="dialogue-block"]');
                const cueBlockElement = target.closest('[data-type="cue-block"]');
                
                
                // Remove any existing selection classes first
                document.querySelectorAll('[data-type="speaker"].speaker-selected').forEach(el => {
                  el.classList.remove('speaker-selected');
                });
                document.querySelectorAll('[data-type="cue-block"].cue-selected').forEach(el => {
                  el.classList.remove('cue-selected');
                });
                
                if (speakerElement) {
                  // Clicked on speaker - show speaker-select context
                  debugLog('[Editor] Clicked on speaker element:', speakerElement);
                  
                  const speakerName = speakerElement.textContent?.trim() || '';
                  setCurrentSpeakerName(speakerName);
                  
                  // Add selected class to clicked speaker
                  speakerElement.classList.add('speaker-selected');
                  
                  // If editAllSpeakers is true, highlight all speakers with the same name
                  if (editAllSpeakers) {
                    document.querySelectorAll('[data-type="speaker"]').forEach(el => {
                      if (el.textContent?.trim() === speakerName) {
                        el.classList.add('speaker-selected');
                      }
                    });
                  }
                  
                  showContextMenu(e.clientX, e.clientY, 'speaker-select');
                  e.stopPropagation(); // Prevent default toolbar from showing
                } else if (dialogueTextElement && dialogueBlockElement) {
                  // Clicked inside dialogue text - also show speaker-select context
                  debugLog('[Editor] Clicked on dialogue text element:', dialogueTextElement);
                  
                  // Find and highlight the speaker element within the same dialogue block
                  const speakerInBlock = dialogueBlockElement.querySelector('[data-type="speaker"]');
                  if (speakerInBlock) {
                    const speakerName = speakerInBlock.textContent?.trim() || '';
                    setCurrentSpeakerName(speakerName);
                    
                    speakerInBlock.classList.add('speaker-selected');
                    
                    // If editAllSpeakers is true, highlight all speakers with the same name
                    if (editAllSpeakers) {
                      document.querySelectorAll('[data-type="speaker"]').forEach(el => {
                        if (el.textContent?.trim() === speakerName) {
                          el.classList.add('speaker-selected');
                        }
                      });
                    }
                  }
                  
                  showContextMenu(e.clientX, e.clientY, 'speaker-select');
                  e.stopPropagation(); // Prevent default toolbar from showing
                } else if (cueBlockElement) {
                  // Clicked on cue block - show cue-select context
                  debugLog('[Editor] Clicked on cue block element:', cueBlockElement);
                  
                  // Add selected class to clicked cue block
                  cueBlockElement.classList.add('cue-selected');
                  
                  showContextMenu(e.clientX, e.clientY, 'cue-select');
                  e.stopPropagation(); // Prevent default toolbar from showing
                } else {
                  // Clicked elsewhere - hide any special context and clear speaker selection
                  // This allows the toolbar to show text-formatting when text is selected
                  hideContextMenu();
                  setEditAllSpeakers(false);
                  setCurrentSpeakerName(null);
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
        speakerNames={new Set(availableSpeakers)}
        currentSpeakerName={currentSpeakerName}
        editAllSpeakers={editAllSpeakers}
        onToggleEditAllSpeakers={() => setEditAllSpeakers(!editAllSpeakers)}
        onSetViewMode={setViewMode}
        onToggleRuler={() => setShowRuler(!showRuler)}
        rehearsalMode={rehearsalMode}
        onToggleRehearsalMode={() => {
          setRehearsalMode(!rehearsalMode);
          console.log('Rehearsal mode toggled:', !rehearsalMode);
        }}
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