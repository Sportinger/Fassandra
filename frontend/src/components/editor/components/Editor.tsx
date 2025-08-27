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
import type { EditorProps, ViewMode } from '../types';

import logger from '../../../services/LoggingService';
import '../styles/variables.css';
import '../styles/responsive.css';
import '../styles/toolbar.css';
import '../styles/cue-blocks.css';
import '../styles/scene-blocks.css';
import '../styles/page-indicators.css';
import '../styles/search.css';
import '../styles/cue-connections.css';
import '../styles/rehearsal-line.css';
/**
 * Main Editor Component
 * Orchestrates all editor sub-systems with responsive design
 */

// Import the consolidated styles
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
    isYjsSynced,
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
    rehearsalClickY?: number;
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

  // Sync rehearsal line position with other users via awareness
  useEffect(() => {
    if (!provider || !provider.awareness) return;

    const handleAwarenessChange = () => {
      const states = provider.awareness.getStates();
      
      // Check all other users' states for rehearsal line position only
      states.forEach((state, clientId) => {
        if (clientId !== provider.awareness.clientID) {
          // Sync rehearsal line position
          if (state.rehearsalLinePosition !== undefined) {
            debugLog('[Rehearsal Sync] Received position from other user:', state.rehearsalLinePosition);
            const newPosition = state.rehearsalLinePosition;
            setRehearsalLinePosition(newPosition);
            
            // Scroll to the new position if in rehearsal mode and single-page view
            if (rehearsalMode && viewMode === 'single-page' && newPosition > 0) {
              debugLog('[Rehearsal Sync] Scrolling to synced position:', newPosition);
              
              // Find the container element
              const containerElement = document.querySelector('.singlePageContainer');
              if (containerElement) {
                const containerRect = containerElement.getBoundingClientRect();
                const absoluteLinePosition = containerRect.top + window.scrollY + newPosition;
                const targetScrollPosition = absoluteLinePosition - (window.innerHeight / 2);
                
                // Smooth scroll to center the line
                window.scrollTo({
                  top: Math.max(0, targetScrollPosition),
                  behavior: 'smooth'
                });
                
                debugLog('[Rehearsal Sync] Scrolled to position:', targetScrollPosition);
              }
            }
          }
        }
      });
    };

    provider.awareness.on('change', handleAwarenessChange);

    return () => {
      provider.awareness.off('change', handleAwarenessChange);
    };
  }, [provider, debugLog, rehearsalMode, viewMode]);

  // Initialize rehearsal line position in awareness when provider is ready
  useEffect(() => {
    if (provider && provider.awareness && rehearsalLinePosition > 0) {
      provider.awareness.setLocalStateField('rehearsalLinePosition', rehearsalLinePosition);
    }
  }, [provider, rehearsalLinePosition]); // Run when provider becomes available or position changes

  // Smooth scroll to keep rehearsal line centered
  useEffect(() => {
    debugLog('[Rehearsal Line State] Position:', rehearsalLinePosition, 'Mode:', rehearsalMode, 'View:', viewMode);
    
    if (!rehearsalMode || viewMode !== 'single-page') return;

    // Find the container element
    const containerElement = document.querySelector('.singlePageContainer');
    if (!containerElement) {
      debugLog('[Rehearsal Scroll] ERROR: Container element not found!');
      return;
    }

    // Calculate the position to scroll to (line position minus half viewport height)
    const containerRect = containerElement.getBoundingClientRect();
    const absoluteLinePosition = containerRect.top + window.scrollY + rehearsalLinePosition;
    const targetScrollPosition = absoluteLinePosition - (window.innerHeight / 2);

    // Smooth scroll to center the line
    window.scrollTo({
      top: targetScrollPosition,
      behavior: 'smooth'
    });

    debugLog('[Rehearsal Scroll] Scrolling to center line at position:', rehearsalLinePosition);
  }, [rehearsalLinePosition, rehearsalMode, viewMode, debugLog]);

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
    
    // Store the click position for rehearsal mode jump
    if (rehearsalMode) {
      // Find the container that holds all pages
      const containerElement = target.closest('.singlePageContainer') || target.closest('.multiplePagesContainer');
      if (containerElement) {
        const containerRect = containerElement.getBoundingClientRect();
        const scrollTop = containerElement.scrollTop || window.scrollY;
        const clickY = e.clientY - containerRect.top + scrollTop;
        
        debugLog('[Rehearsal Click] Container height:', containerElement.scrollHeight, 'Click Y:', clickY, 'ScrollTop:', scrollTop);
        
        // Store the position for later use
        setLocalContextMenu({
          x: e.clientX,
          y: e.clientY,
          visible: true,
          onSpeakerName: !!speakerElement,
          onPageBackground: !speakerElement,
          rehearsalClickY: clickY, // Absolute position in document
        });
        return;
      }
    }
    
    setLocalContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
      onSpeakerName: !!speakerElement,
      onPageBackground: !speakerElement,
    });
  }, [rehearsalMode]);

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
      case 'jump':
        if (localContextMenu.rehearsalClickY !== undefined) {
          const newPosition = localContextMenu.rehearsalClickY;
          debugLog('[Jump Action] Setting rehearsal line position to:', newPosition);
          setRehearsalLinePosition(newPosition);
          
          // Sync the position with other users via awareness
          if (provider && provider.awareness) {
            debugLog('[Jump Action] Syncing position via awareness:', newPosition);
            provider.awareness.setLocalStateField('rehearsalLinePosition', newPosition);
          }
          
          // Verify the line is visible
          setTimeout(() => {
            const lineElement = document.querySelector('.rehearsal-line');
            if (lineElement) {
              const computedStyle = window.getComputedStyle(lineElement);
              debugLog('[Jump Action] Line element found, display:', computedStyle.display, 'top:', computedStyle.top);
            } else {
              debugLog('[Jump Action] WARNING: Line element not found!');
            }
          }, 100);
        }
        break;
      default:
        debugLog('Unknown context menu action:', action);
    }
    
    setLocalContextMenu(prev => ({ ...prev, visible: false }));
  }, [editor, debugLog, localContextMenu.rehearsalClickY, provider]);

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

  // Debug logs disabled after verification
  // useEffect(() => {
  //   if (!editor || !isYjsSynced) return;
  //   const timer = setTimeout(() => {
  //     try {
  //       const byDataAttr = document.querySelectorAll('div[data-type="page-indicator"]').length;
  //       const byClass = document.querySelectorAll('div.page-indicator').length;
  //       logger.info('Editor', '[DEBUG_PAGE_INDICATORS] Counts:', { byDataAttr, byClass });
  //       const samples = Array.from(document.querySelectorAll('div[data-type="page-indicator"]'))
  //         .slice(0, 3)
  //         .map((el: any) => el?.outerHTML?.slice(0, 120));
  //       if (samples.length > 0) {
  //         logger.info('Editor', '[DEBUG_PAGE_INDICATORS] Samples:', samples);
  //       }
  //       const counts: Record<string, number> = {};
  //       editor.state.doc.descendants((node: any) => {
  //         const n = node.type?.name || 'unknown';
  //         counts[n] = (counts[n] || 0) + 1;
  //       });
  //       logger.info('Editor', '[DEBUG_PM_NODES] Node counts:', counts);
  //     } catch (e) {
  //       logger.warn('Editor', '[DEBUG_PAGE_INDICATORS] Failed to inspect DOM:', e);
  //     }
  //   }, 400);
  //   return () => clearTimeout(timer);
  // }, [editor, isYjsSynced]);

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
        connectionStatus={connectionStatus} // Pass connection status to header
        // Removed demo mode props - development utility
      />
      
      {/* Status indicator removed - now shown in header as sphere */}
      
      {/* Removed demo mode status indicator - development utility */}
      
      {/* Main editor content with ViewMode support */}
      {viewMode === 'single-page' ? (
        <SinglePageView 
          showRuler={showRuler}
          onToggleRuler={() => setShowRuler(!showRuler)}
          onToggleViewMode={() => setViewMode('multiple-pages')}
          rehearsalMode={rehearsalMode}
          rehearsalLinePosition={rehearsalLinePosition}
          onOutsideClick={hideContextMenu}
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
                const sceneBlockElement = target.closest('[data-type="scene-block"]');
                
                
                // Remove any existing selection classes first
                document.querySelectorAll('[data-type="speaker"].speaker-selected').forEach(el => {
                  el.classList.remove('speaker-selected');
                });
                document.querySelectorAll('[data-type="cue-block"].cue-selected').forEach(el => {
                  el.classList.remove('cue-selected');
                });
                document.querySelectorAll('[data-type="scene-block"].scene-selected').forEach(el => {
                  el.classList.remove('scene-selected');
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
                } else if (sceneBlockElement) {
                  // Clicked on scene block - show scene-select context
                  debugLog('[Editor] Clicked on scene block element:', sceneBlockElement);
                  
                  // Add selected class to clicked scene block
                  sceneBlockElement.classList.add('scene-selected');
                  
                  showContextMenu(e.clientX, e.clientY, 'scene-select');
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
                const sceneBlockElement = target.closest('[data-type="scene-block"]');
                
                
                // Remove any existing selection classes first
                document.querySelectorAll('[data-type="speaker"].speaker-selected').forEach(el => {
                  el.classList.remove('speaker-selected');
                });
                document.querySelectorAll('[data-type="cue-block"].cue-selected').forEach(el => {
                  el.classList.remove('cue-selected');
                });
                document.querySelectorAll('[data-type="scene-block"].scene-selected').forEach(el => {
                  el.classList.remove('scene-selected');
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
                } else if (sceneBlockElement) {
                  // Clicked on scene block - show scene-select context
                  debugLog('[Editor] Clicked on scene block element:', sceneBlockElement);
                  
                  // Add selected class to clicked scene block
                  sceneBlockElement.classList.add('scene-selected');
                  
                  showContextMenu(e.clientX, e.clientY, 'scene-select');
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
          {rehearsalMode && localContextMenu.rehearsalClickY !== undefined && (
            <div 
              className="context-menu-item"
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
                fontWeight: 'bold',
                color: '#ff0000',
              }}
              onClick={() => handleContextMenuAction('jump')}
            >
              Jump
            </div>
          )}
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
          const newMode = !rehearsalMode;
          setRehearsalMode(newMode);
          logger.debug('Editor', 'Rehearsal mode toggled:', newMode);
          
          // If turning on rehearsal mode and line position is set, scroll to it
          if (newMode && rehearsalLinePosition > 0 && viewMode === 'single-page') {
            setTimeout(() => {
              const containerElement = document.querySelector('.singlePageContainer');
              if (containerElement) {
                const containerRect = containerElement.getBoundingClientRect();
                const absoluteLinePosition = containerRect.top + window.scrollY + rehearsalLinePosition;
                const targetScrollPosition = absoluteLinePosition - (window.innerHeight / 2);
                
                window.scrollTo({
                  top: targetScrollPosition,
                  behavior: 'smooth'
                });
              }
            }, 100); // Small delay to ensure DOM is updated
          }
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