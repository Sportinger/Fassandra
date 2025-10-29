import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { Editor } from '@tiptap/core';
import { CueType, CUE_TYPE_LABELS } from '../../../types/cue';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

import logger from '../../../services/LoggingService';
// Helper function to get word boundaries at a position
function getWordAtPosition(doc: ProseMirrorNode, pos: number): { from: number; to: number; text: string } | null {
  try {
    const $pos = doc.resolve(pos);
    const parent = $pos.parent;
    
    if (!parent.isText && !parent.isTextblock) {
      logger.debug('CueBlock', 'Not in a text block');
      return null;
    }
    
    // If we're in an inline node, we need to check its parent
    if (parent.isText) {
      const grandParent = $pos.node($pos.depth - 1);
      if (!grandParent.isTextblock) return null;
    }
    
    const text = parent.textContent;
    const parentOffset = $pos.parentOffset;
    
    logger.debug('CueBlock', `${text} Offset: ${parentOffset}`);
    
    // Find word boundaries
    let start = parentOffset;
    let end = parentOffset;
    
    // Move start backwards to beginning of word
    while (start > 0 && /\S/.test(text.charAt(start - 1))) {
      start--;
    }
    
    // Move end forwards to end of word  
    while (end < text.length && /\S/.test(text.charAt(end))) {
      end++;
    }
    
    // If we didn't find a word, return null
    if (start === end) {
      logger.debug('CueBlock', 'No word found at position');
      return null;
    }
    
    // Convert to document positions
    const basePos = $pos.start();
    const wordData = {
      from: basePos + start,
      to: basePos + end,
      text: text.substring(start, end),
    };
    
    logger.debug('CueBlock', 'Found word:', wordData);
    return wordData;
  } catch (error) {
    logger.error('CueBlock', 'Error in getWordAtPosition:', error);
    return null;
  }
}

// Helper function to find the scene number for a given position
function getSceneNumberForPosition(editor: Editor, pos: number): number {
  let currentSceneNumber = 1; // Default to scene 1 if no scene found

  // Look backwards from the position to find the nearest scene
  editor.state.doc.nodesBetween(0, pos, (node, nodePos) => {
    if (node.type.name === 'sceneBlock' && nodePos < pos) {
      const sceneNum = parseInt(node.attrs.sceneNumber) || 1;
      currentSceneNumber = sceneNum;
    }
  });

  return currentSceneNumber;
}

// Helper function to update all cue numbers based on scene
function updateAllCueNumbers(editor: Editor) {
  const { tr } = editor.state;
  let hasChanges = false;

  // Track cue counts per scene and type
  const cueCounts: Record<string, Record<CueType, number>> = {};

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'cueBlock') {
      const cueType = node.attrs.cueType as CueType;
      const sceneNumber = getSceneNumberForPosition(editor, pos);
      const sceneKey = `scene_${sceneNumber}`;

      // Initialize counters for this scene if needed
      if (!cueCounts[sceneKey]) {
        cueCounts[sceneKey] = {
          light: 0,
          video: 0,
          sound: 0,
          props: 0,
          technik: 0,
          einruf: 0,
        };
      }

      // Increment counter for this cue type
      cueCounts[sceneKey][cueType]++;

      // Calculate cue number: scene * 100 + cue count
      const baseNumber = sceneNumber * 100;
      const cueNumber = baseNumber + cueCounts[sceneKey][cueType];
      const newCueNumber = cueNumber.toString();

      // Only update if not manually edited AND (no existing number OR number/scene changed)
      // Don't overwrite existing numbers on initial load
      const hasExistingNumber = node.attrs.cueNumber && node.attrs.cueNumber !== '999';
      if (!node.attrs.manualNumber && (!hasExistingNumber || node.attrs.cueNumber !== newCueNumber || node.attrs.sceneNumber !== sceneNumber)) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          cueNumber: newCueNumber,
          sceneNumber: sceneNumber,
        });
        hasChanges = true;
      }
    }
  });

  if (hasChanges) {
    editor.view.dispatch(tr);
  }
}

export interface CueBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    cueBlock: {
      insertCueBlock: (cueType: CueType) => ReturnType;
      updateCueContent: (content: string) => ReturnType;
      updateCueBlockAndConnections: (cueType: CueType, oldNumber: string, newNumber: string, manualNumber?: boolean) => ReturnType;
      updateCueByIdWithNumber: (cueId: string, newNumber: string) => ReturnType;
    };
  }
}

const cueBlockDragKey = new PluginKey('cueBlockDrag');

// Store current drag data globally to work around browser limitations
let currentDragData: any = null;

export const CueBlock = Node.create<CueBlockOptions>({
  name: 'cueBlock',
  group: 'block',
  content: 'inline*',
  draggable: true, // Allow normal drag-and-drop for reordering
  
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: cueBlockDragKey,
        props: {
          handleDOMEvents: {
            mousedown: (_view, event) => {
              const target = event.target as HTMLElement;
              const connectionDragArea = target.closest('.cue-connection-drag-area');
              const moveDragArea = target.closest('.cue-move-drag-area');
              
              if (connectionDragArea) {
                // Prevent ProseMirror from starting its own drag
                event.stopPropagation();
                return true;
              }
              
              // For move drag area, let ProseMirror handle it normally
              if (moveDragArea) {
                return false;
              }
              
              return false;
            },
            
            dragstart: (view, event) => {
              const target = event.target as HTMLElement;
              
              // Check if we're dragging from the connection drag area
              const connectionDragArea = target.closest('.cue-connection-drag-area');
              const moveDragArea = target.closest('.cue-move-drag-area');
              const cueBlock = target.closest('.cue-block');
              
              // If dragging from move area or the cue block itself (but not connection area), let ProseMirror handle it
              if ((moveDragArea || cueBlock) && !connectionDragArea) {
                currentDragData = null; // Clear any connection data
                return false; // Let ProseMirror handle the block move
              }
              
              if (connectionDragArea) {
                logger.debug('CueBlock', 'Drag started from connection drag area');
                
                const cueBlock = connectionDragArea.closest('.cue-block');
                if (!cueBlock) return false;
                
                // Get cue block data
                const pos = view.posAtDOM(cueBlock, 0);
                const node = view.state.doc.nodeAt(pos);
                
                if (!node || node.type.name !== 'cueBlock') return false;
                
                // Stop propagation to prevent ProseMirror from handling this
                event.stopPropagation();
                
                // Store cue data in dataTransfer
                const cueData = {
                  cueId: node.attrs.cueId || `cue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  cueType: node.attrs.cueType,
                  cueNumber: node.attrs.cueNumber,
                  isConnectionDrag: true, // Mark this as a connection drag
                };
                
                logger.debug('CueBlock', 'Starting connection drag with cue data:', cueData);
                
                // Store in global variable to work around browser limitations
                currentDragData = cueData;
                
                // Set a custom drag effect
                event.dataTransfer!.effectAllowed = 'copy';
                event.dataTransfer?.setData('text/plain', 'cue-connection');
                
                // Create a custom drag image
                const dragImage = document.createElement('div');
                dragImage.textContent = `Q${cueData.cueNumber}`;
                dragImage.style.position = 'absolute';
                dragImage.style.top = '-1000px';
                dragImage.style.background = 'rgba(59, 130, 246, 0.8)';
                dragImage.style.color = 'white';
                dragImage.style.padding = '4px 8px';
                dragImage.style.borderRadius = '4px';
                dragImage.style.fontSize = '12px';
                document.body.appendChild(dragImage);
                event.dataTransfer!.setDragImage(dragImage, 0, 0);
                setTimeout(() => document.body.removeChild(dragImage), 0);
                
                // Add dragging class
                cueBlock.classList.add('dragging-connection');
                
                // Store in plugin state for cleanup
                (view as any).cueBlockDragging = cueBlock;
                
                // We need to handle this ourselves
                return true;
              }
              
              // For all other cases, don't interfere
              return false;
            },
            
            dragend: (view, _event) => {
              // Remove dragging class
              const draggingElement = (view as any).cueBlockDragging;
              if (draggingElement) {
                draggingElement.classList.remove('dragging');
                draggingElement.classList.remove('dragging-connection');
                delete (view as any).cueBlockDragging;
              }
              
              // Clear global drag data
              currentDragData = null;
              
              return false;
            },
            
            dragover: (view, event) => {
              // Check if this is a connection drag
              const isConnectionDrag = currentDragData && currentDragData.isConnectionDrag;
              
              if (!isConnectionDrag) {
                // Also check for the body class
                if (!document.body.classList.contains('cue-connection-dragging')) {
                  return false;
                }
              }
              
              logger.debug('CueBlock', 'Dragover with connection drag active');
              
              // For connection drags, we need to handle this event
              event.preventDefault();
              event.dataTransfer!.dropEffect = 'copy';
              
              // Find word under cursor
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (!pos) {
                logger.debug('CueBlock', 'No position found at coordinates');
                return false;
              }
              
              const word = getWordAtPosition(view.state.doc, pos.pos);
              
              if (word) {
                // Only re-render if the word range actually changed
                const currentRange = (view as any).cueDropRange as { from: number; to: number } | undefined;
                if (!currentRange || currentRange.from !== word.from || currentRange.to !== word.to) {
                  const decorations = DecorationSet.create(view.state.doc, [
                    Decoration.inline(word.from, word.to, { class: 'drop-target-word drop-ready' }),
                  ]);
                  (view as any).cueDropDecorations = decorations;
                  (view as any).cueDropRange = { from: word.from, to: word.to };
                  view.dispatch(view.state.tr.setMeta('addDropDecoration', decorations));
                }
              } else {
                // Keep the last decoration until dragleave/drop to avoid flicker near boundaries
                // Do not clear here to prevent rapid toggling
              }
              
              return true;
            },
            
            dragleave: (view, _event) => {
              // Clear drop decorations when leaving editor
              if ((view as any).cueDropDecorations) {
                view.dispatch(view.state.tr.setMeta('removeDropDecoration', true));
                delete (view as any).cueDropDecorations;
                delete (view as any).cueDropRange;
              }
              return false;
            },
            
            drop: (view, event) => {
              // Only handle connection drops
              if (!currentDragData || !currentDragData.isConnectionDrag) {
                return false;
              }
              
              if (!event) return false;
              
              event.preventDefault();
              event.stopPropagation(); // Prevent ProseMirror from handling this
              
              // Clear drop decorations first
              if ((view as any).cueDropDecorations) {
                setTimeout(() => {
                  view.dispatch(view.state.tr.setMeta('removeDropDecoration', true));
                  delete (view as any).cueDropDecorations;
                  delete (view as any).cueDropRange;
                }, 50);
              }
              
              const cueData = currentDragData;
              
              try {
                const pos = view.posAtCoords({ left: (event as DragEvent).clientX, top: (event as DragEvent).clientY });
                
                if (!pos) return false;
                
                const word = getWordAtPosition(view.state.doc, pos.pos);
                
                if (word) {
                  // Apply cue connection mark to the word
                  const { state } = view;
                  const markType = state.schema.marks.cueConnection;
                  
                  if (!markType) {
                    logger.error('CueBlock', 'Error:', 'CueConnection mark type not found in schema');
                    return false;
                  }
                  
                  const tr = state.tr;
                  
                  // First, remove any existing connections from THIS specific cue only
                  state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
                    if (node.isText && node.marks.length) {
                      node.marks.forEach(mark => {
                        // Only remove marks that match THIS cue's type and number
                        if (mark.type.name === 'cueConnection' && 
                            mark.attrs.cueType === cueData.cueType &&
                            mark.attrs.cueNumber === cueData.cueNumber) {
                          tr.removeMark(pos, pos + node.nodeSize, mark.type);
                        }
                      });
                    }
                  });
                  
                  // Then add the new connection
                  const mark = markType.create(cueData);
                  tr.addMark(word.from, word.to, mark);
                  
                  view.dispatch(tr);
                  
                  logger.debug('CueBlock', `${cueData} to word: ${word.text}`);
                  logger.debug('CueBlock', 'Mark attrs:', mark.attrs);
                  
                  // Clear global drag data after successful drop
                  currentDragData = null;
                }
              } catch (error) {
                logger.error('CueBlock', 'Error applying cue connection:', error);
                return false;
              }
              
              return true;
            },
          },
          
          decorations(state) {
            const meta = this.getState(state);
            if (meta?.decorations) {
              return meta.decorations;
            }
            return DecorationSet.empty;
          },
        },
        
        state: {
          init: () => ({ decorations: DecorationSet.empty }),
          apply: (tr, value) => {
            if (tr.getMeta('addDropDecoration')) {
              return { decorations: tr.getMeta('addDropDecoration') };
            }
            if (tr.getMeta('removeDropDecoration')) {
              return { decorations: DecorationSet.empty };
            }
            return value;
          },
        },
      }),
    ];
  },

  onCreate() {
    // Track if handlers are already set up to avoid redundant setup
    let handlersInitialized = false;
    let setupDebounceTimer: number | null = null;

    // Add native drag handlers to connection drag areas
    const setupConnectionDragHandlers = () => {
      const dragAreas = document.querySelectorAll('.cue-connection-drag-area');

      dragAreas.forEach((area: Element) => {
        const dragArea = area as HTMLElement;

        // Skip if already initialized
        if ((dragArea as any).__cueHandlerInitialized) return;
        (dragArea as any).__cueHandlerInitialized = true;

        // Add new listeners
        dragArea.ondragstart = (e) => {
          e.stopPropagation();
          
          const cueBlock = dragArea.closest('.cue-block');
          if (!cueBlock) return;
          
          // Get cue data from the block
          const cueId = cueBlock.getAttribute('data-cue-id') || `cue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const cueNumber = dragArea.querySelector('.cue-number')?.textContent?.replace('Q', '') || '';
          // Get cue type from data attribute
          const cueType = cueBlock.getAttribute('data-cue-type') || 'light';

          logger.debug('CueBlock', 'Extracting cue data:', {
            dataAttribute: cueBlock.getAttribute('data-cue-type'),
            cueId,
            cueType,
            cueNumber
          });

          const cueData = {
            cueId,
            cueType,
            cueNumber,
            isConnectionDrag: true,
          };
          
          currentDragData = cueData;
          logger.debug('CueBlock', 'Native drag start:', cueData);
          
          e.dataTransfer!.effectAllowed = 'copy';
          e.dataTransfer!.setData('text/plain', 'cue-connection');
          
          // Add class to body to indicate connection drag
          document.body.classList.add('cue-connection-dragging');
        };
      });
    };
    
    // Add global drag end handler
    document.addEventListener('dragend', () => {
      document.body.classList.remove('cue-connection-dragging');
      currentDragData = null;
    });
    
    // Add hover handlers for bidirectional highlighting using event delegation
    const setupHoverHandlers = () => {
      // Remove old delegated handlers if they exist
      if ((document as any).cueHoverHandler) {
        document.removeEventListener('mouseover', (document as any).cueHoverHandler);
        document.removeEventListener('mouseout', (document as any).cueHoverOutHandler);
      }
      
      // Use event delegation for better stability
      const hoverHandler = (e: MouseEvent) => {
        // During connection drag, ignore hover toggling to prevent flicker
        if (document.body.classList.contains('cue-connection-dragging')) return;
        const target = e.target as HTMLElement;
        
        // Handle cue block hover
        const cueBlock = target.closest('.cue-block');
        if (cueBlock) {
          const cueType = cueBlock.getAttribute('data-cue-type');
          const cueNumber = cueBlock.querySelector('.cue-number')?.textContent?.replace('Q', '');
          
          // Remove previous highlights
          document.querySelectorAll('.cue-connection.hover-highlight').forEach(el => {
            el.classList.remove('hover-highlight');
          });
          
          // Highlight all connected words
          document.querySelectorAll(`.cue-connection[data-cue-type="${cueType}"][data-cue-number="${cueNumber}"]`).forEach(el => {
            el.classList.add('hover-highlight');
          });
          
          return;
        }
        
        // Handle word hover
        const connection = target.closest('.cue-connection');
        if (connection) {
          // Remove previous highlights
          document.querySelectorAll('.hover-highlight').forEach(el => {
            el.classList.remove('hover-highlight');
          });
          
          // For nested spans (multiple cues), we need to find all cue connections at this position
          const connectionsToHighlight: Set<Element> = new Set();
          
          // Add the connection we're hovering
          connectionsToHighlight.add(connection);
          
          // Check if we're inside a nested structure (parent is also a cue-connection)
          let parent = connection.parentElement;
          while (parent && parent.classList.contains('cue-connection')) {
            connectionsToHighlight.add(parent);
            parent = parent.parentElement;
          }
          
          // Also check for child connections
          connection.querySelectorAll('.cue-connection').forEach(el => {
            connectionsToHighlight.add(el);
          });
          
          // Highlight all found connections
          connectionsToHighlight.forEach(conn => {
            conn.classList.add('hover-highlight');
            
            // Highlight corresponding cue blocks
            const cueType = (conn as HTMLElement).getAttribute('data-cue-type');
            const cueNumber = (conn as HTMLElement).getAttribute('data-cue-number');
            
            if (cueType && cueNumber) {
              document.querySelectorAll(`.cue-block[data-cue-type="${cueType}"]`).forEach((block: Element) => {
                const blockNumber = block.querySelector('.cue-number')?.textContent?.replace('Q', '');
                if (blockNumber === cueNumber) {
                  block.classList.add('hover-highlight');
                }
              });
            }
          });
        }
      };
      
      const hoverOutHandler = (e: MouseEvent) => {
        if (document.body.classList.contains('cue-connection-dragging')) return;
        const target = e.target as HTMLElement;
        const relatedTarget = e.relatedTarget as HTMLElement;
        
        // Check if we're leaving a cue block
        const cueBlock = target.closest('.cue-block');
        if (cueBlock && !relatedTarget?.closest('.cue-block')) {
          document.querySelectorAll('.cue-connection.hover-highlight').forEach(el => {
            el.classList.remove('hover-highlight');
          });
        }
        
        // Check if we're leaving a connection
        const connection = target.closest('.cue-connection');
        if (connection && !relatedTarget?.closest('.cue-connection')) {
          document.querySelectorAll('.hover-highlight').forEach(el => {
            el.classList.remove('hover-highlight');
          });
        }
      };
      
      // Store handlers for cleanup
      (document as any).cueHoverHandler = hoverHandler;
      (document as any).cueHoverOutHandler = hoverOutHandler;
      
      // Add delegated event listeners
      document.addEventListener('mouseover', hoverHandler);
      document.addEventListener('mouseout', hoverOutHandler);
    };
    
    // Setup cue number editor handlers
    const setupCueNumberEditors = () => {
      const cueNumbers = document.querySelectorAll('.cue-number[data-cue-number-editor="true"]');

      cueNumbers.forEach((numberEl: Element) => {
        const numberSpan = numberEl as HTMLElement;

        // Skip if already initialized
        if ((numberSpan as any).__cueNumberHandlerInitialized) return;
        (numberSpan as any).__cueNumberHandlerInitialized = true;

        // On input, update the attribute and mark as manual
        numberSpan.oninput = (e) => {
          const target = e.target as HTMLElement;
          let newNumber = target.textContent?.replace('Q', '').trim() || '';

          // Update the cue block attribute
          const cueBlock = numberSpan.closest('.cue-block');
          if (cueBlock) {
            const pos = this.editor.view.posAtDOM(cueBlock, 0);
            const node = this.editor.state.doc.nodeAt(pos);

            if (node && node.type.name === 'cueBlock') {
              const oldNumber = node.attrs.cueNumber;
              const cueType = node.attrs.cueType;

              const { tr } = this.editor.state;
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                cueNumber: newNumber,
                manualNumber: true, // Mark as manually edited
              });

              // Also update all connection marks with this cue
              if (oldNumber !== newNumber) {
                this.editor.state.doc.nodesBetween(0, this.editor.state.doc.content.size, (n, p) => {
                  if (n.isText && n.marks.length) {
                    n.marks.forEach(mark => {
                      if (mark.type.name === 'cueConnection' &&
                          mark.attrs.cueType === cueType &&
                          mark.attrs.cueNumber === oldNumber) {
                        const newMark = mark.type.create({
                          ...mark.attrs,
                          cueNumber: newNumber,
                          manualNumber: true,
                        });
                        tr.removeMark(p, p + n.nodeSize, mark.type);
                        tr.addMark(p, p + n.nodeSize, newMark);
                      }
                    });
                  }
                });
              }

              this.editor.view.dispatch(tr);
            }
          }
        };

        // On blur, ensure Q prefix
        numberSpan.onblur = (e) => {
          const target = e.target as HTMLElement;
          let newNumber = target.textContent?.replace('Q', '').trim() || '';
          if (newNumber && !target.textContent?.startsWith('Q')) {
            target.textContent = `Q${newNumber}`;
          }
        };

        // Prevent Enter key from adding new line
        numberSpan.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLElement).blur();
          }
        };
      });
    };

    // Debounced setup function to avoid redundant handler registration
    const debouncedSetup = () => {
      if (setupDebounceTimer) {
        clearTimeout(setupDebounceTimer);
      }
      setupDebounceTimer = window.setTimeout(() => {
        setupConnectionDragHandlers();
        setupCueNumberEditors();
        handlersInitialized = true;
        setupDebounceTimer = null;
      }, 300); // Increased debounce to 300ms for better performance
    };

    // Setup handlers after a delay to ensure DOM is ready
    setTimeout(() => {
      setupConnectionDragHandlers();
      setupHoverHandlers();
      setupCueNumberEditors();
      handlersInitialized = true;
    }, 100);

    // Re-setup handlers when content changes (debounced)
    this.editor.on('update', () => {
      // Only re-setup if handlers were already initialized
      if (handlersInitialized) {
        debouncedSetup();
      }
    });
    
    // Update cue numbers whenever the document changes (debounced for performance)
    let cueUpdateTimer: number | null = null;
    let pendingDeletedCues: Array<{cueType: string, cueNumber: string}> = [];

    this.editor.on('update', ({ transaction }) => {
      // Only process structural changes (insertions/deletions), not text edits
      if (!transaction.docChanged) return;

      // Check if cue blocks or scene blocks were added/removed
      let hasCueBlockChange = false;
      let hasSceneBlockChange = false;

      transaction.steps.forEach((step: any) => {
        if (step.slice) {
          // Check if the slice contains cueBlock or sceneBlock nodes
          step.slice.content.descendants((node: any) => {
            if (node.type.name === 'cueBlock') hasCueBlockChange = true;
            if (node.type.name === 'sceneBlock') hasSceneBlockChange = true;
          });
        }
      });

      // Only process if structural changes to cues/scenes occurred
      if (!hasCueBlockChange && !hasSceneBlockChange) return;

      // Find deleted cues (only if cue blocks changed)
      if (hasCueBlockChange) {
        const oldState = transaction.before;
        const newState = transaction.doc;

        // Find deleted cue blocks
        oldState.descendants((node, _pos) => {
          if (node.type.name === 'cueBlock') {
            const cueType = node.attrs.cueType;
            const cueNumber = node.attrs.cueNumber;

            // Check if this cue still exists in the new state
            let stillExists = false;
            newState.descendants((newNode) => {
              if (newNode.type.name === 'cueBlock' &&
                  newNode.attrs.cueType === cueType &&
                  newNode.attrs.cueNumber === cueNumber) {
                stillExists = true;
              }
            });

            if (!stillExists) {
              pendingDeletedCues.push({ cueType, cueNumber });
            }
          }
        });
      }

      // Debounce cue number updates to avoid excessive recalculations
      if (cueUpdateTimer) {
        clearTimeout(cueUpdateTimer);
      }

      cueUpdateTimer = window.setTimeout(() => {
        // Remove connections for deleted cues
        if (pendingDeletedCues.length > 0) {
          const { tr } = this.editor.state;

          pendingDeletedCues.forEach(({ cueType, cueNumber }) => {
            this.editor.state.doc.nodesBetween(0, this.editor.state.doc.content.size, (node, pos) => {
              if (node.isText && node.marks.length) {
                node.marks.forEach(mark => {
                  if (mark.type.name === 'cueConnection' &&
                      mark.attrs.cueType === cueType &&
                      mark.attrs.cueNumber === cueNumber) {
                    tr.removeMark(pos, pos + node.nodeSize, mark.type);
                  }
                });
              }
            });
          });

          if (tr.docChanged) {
            this.editor.view.dispatch(tr);
          }

          pendingDeletedCues = [];
        }

        // Update cue numbers
        updateAllCueNumbers(this.editor);
        cueUpdateTimer = null;
      }, 500); // Debounce cue number updates by 500ms
    });
    
    // Initial numbering
    setTimeout(() => {
      updateAllCueNumbers(this.editor);
    }, 100);
  },

  addAttributes() {
    return {
      cueId: {
        default: null,
        parseHTML: element => element.getAttribute('data-cue-id') || `cue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        renderHTML: attributes => {
          // Generate cueId if it doesn't exist
          const id = attributes.cueId || `cue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          return { 'data-cue-id': id };
        },
      },
      cueType: {
        default: 'light',
        parseHTML: element => element.getAttribute('data-cue-type'),
        renderHTML: attributes => {
          return { 'data-cue-type': attributes.cueType };
        },
      },
      cueNumber: {
        default: '',
        parseHTML: element => element.getAttribute('data-cue-number'),
        renderHTML: attributes => {
          return { 'data-cue-number': attributes.cueNumber };
        },
      },
      sceneNumber: {
        default: 1,
        parseHTML: element => element.getAttribute('data-scene-number'),
        renderHTML: attributes => {
          return { 'data-scene-number': attributes.sceneNumber };
        },
      },
      manualNumber: {
        default: false,
        parseHTML: element => element.getAttribute('data-manual-number') === 'true',
        renderHTML: attributes => {
          if (attributes.manualNumber) {
            return { 'data-manual-number': 'true' };
          }
          return {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="cue-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const cueType = HTMLAttributes['data-cue-type'] || 'light';
    const cueNumber = HTMLAttributes['data-cue-number'] || '';
    const label = CUE_TYPE_LABELS[cueType as CueType];
    
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'cue-block',
        class: `cue-block cue-${cueType}`,
      }),
      ['div', { class: 'cue-connection-drag-area', contenteditable: 'false', draggable: 'true', title: 'Drag to connect to words' },
        ['span', { class: 'cue-number', contenteditable: 'true', 'data-cue-number-editor': 'true' }, cueNumber ? `Q${cueNumber}` : ''],
        ['span', { class: 'cue-label' }, label + ':'],
      ],
      ['span', { class: 'cue-content' }, 0], // Content slot
      ['div', { class: 'cue-move-drag-area', contenteditable: 'false', draggable: 'false', title: 'Drag to reorder' }, 
        ['span', { class: 'drag-handle' }, '⋮⋮'],
      ],
    ];
  },

  addCommands() {
    return {
      insertCueBlock: (cueType: CueType) => ({ commands, editor }) => {
        const cueId = `cue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const result = commands.insertContent({
          type: this.name,
          attrs: { cueId, cueType, cueNumber: '999' }, // Temporary number
          content: [{ type: 'text', text: ' ' }], // Start with single space instead of empty
        });

        // Trigger cue number update
        setTimeout(() => {
          updateAllCueNumbers(editor);
        }, 10);

        return result;
      },
      updateCueContent: (content: string) => ({ commands }) => {
        return commands.updateAttributes(this.name, { content });
      },
      updateCueBlockAndConnections: (cueType: CueType, oldNumber: string, newNumber: string, manualNumber = true) => ({ state, tr, dispatch }) => {
        let changed = false;

        // Update CueBlock node
        state.doc.descendants((node, pos) => {
          if (node.type.name === 'cueBlock' &&
              node.attrs.cueType === cueType &&
              node.attrs.cueNumber === oldNumber) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              cueNumber: newNumber,
              manualNumber,
            });
            changed = true;
          }
        });

        // Update all CueConnectionMarks
        const markType = state.schema.marks.cueConnection;
        if (markType) {
          state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
            if (node.isText && node.marks.length) {
              node.marks.forEach(mark => {
                if (mark.type.name === 'cueConnection' &&
                    mark.attrs.cueType === cueType &&
                    mark.attrs.cueNumber === oldNumber) {
                  const newMark = markType.create({
                    ...mark.attrs,
                    cueNumber: newNumber,
                    manualNumber,
                  });
                  tr.removeMark(pos, pos + node.nodeSize, markType);
                  tr.addMark(pos, pos + node.nodeSize, newMark);
                  changed = true;
                }
              });
            }
          });
        }

        if (changed && dispatch) {
          dispatch(tr);
        }

        return changed;
      },
      updateCueByIdWithNumber: (cueId: string, newNumber: string) => ({ state, tr, dispatch }) => {
        let changed = false;
        let cueType: CueType | null = null;
        let oldNumber: string | null = null;

        // Check if this is a legacy ID format: "legacy-TYPE-NUMBER"
        const isLegacy = cueId.startsWith('legacy-');
        let legacyCueType: string | null = null;
        let legacyCueNumber: string | null = null;
        if (isLegacy) {
          const parts = cueId.split('-');
          if (parts.length >= 3) {
            legacyCueType = parts[1];
            legacyCueNumber = parts.slice(2).join('-');
          }
        }

        // Find and update the CueBlock node by cueId or by legacy type/number
        state.doc.descendants((node, pos) => {
          if (node.type.name === 'cueBlock') {
            let isMatch = false;

            // Try matching by cueId first
            if (node.attrs.cueId === cueId) {
              isMatch = true;
            }
            // For legacy cues, match by type and number
            else if (isLegacy && !node.attrs.cueId &&
                     node.attrs.cueType === legacyCueType &&
                     node.attrs.cueNumber === legacyCueNumber) {
              isMatch = true;
            }

            if (isMatch) {
              cueType = node.attrs.cueType;
              oldNumber = node.attrs.cueNumber;

              // Generate a real cueId if this is a legacy cue
              const realCueId = node.attrs.cueId || `cue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                cueId: realCueId,
                cueNumber: newNumber,
                manualNumber: true,
              });
              changed = true;
              return false; // Stop searching
            }
          }
        });

        // Update all CueConnectionMarks with the same type and old number
        if (cueType && oldNumber && oldNumber !== newNumber) {
          const markType = state.schema.marks.cueConnection;
          if (markType) {
            state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
              if (node.isText && node.marks.length) {
                node.marks.forEach(mark => {
                  if (mark.type.name === 'cueConnection' &&
                      mark.attrs.cueType === cueType &&
                      mark.attrs.cueNumber === oldNumber) {
                    const newMark = markType.create({
                      ...mark.attrs,
                      cueNumber: newNumber,
                      manualNumber: true,
                    });
                    tr.removeMark(pos, pos + node.nodeSize, markType);
                    tr.addMark(pos, pos + node.nodeSize, newMark);
                    changed = true;
                  }
                });
              }
            });
          }
        }

        if (changed && dispatch) {
          dispatch(tr);
        }

        return changed;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-l': () => this.editor.commands.insertCueBlock('light'),
      'Mod-Shift-v': () => this.editor.commands.insertCueBlock('video'),
      'Mod-Shift-s': () => this.editor.commands.insertCueBlock('sound'),
      'Mod-Shift-p': () => this.editor.commands.insertCueBlock('props'),
      'Mod-Shift-t': () => this.editor.commands.insertCueBlock('technik'),
      'Mod-Shift-e': () => this.editor.commands.insertCueBlock('einruf'),
      // Allow arrow keys to navigate out of cue block
      'ArrowDown': () => {
        const { state, view } = this.editor;
        const { selection } = state;
        const { $from } = selection;
        
        // Check if we're at the end of a cue block
        if ($from.parent.type.name === 'cueBlock' && selection.to === $from.end()) {
          // Move to next block
          const pos = $from.after();
          if (pos < state.doc.content.size) {
            view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos))));
            return true;
          }
        }
        return false;
      },
    };
  },
});
