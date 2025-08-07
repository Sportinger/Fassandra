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
        };
      }
      
      // Increment counter for this cue type
      cueCounts[sceneKey][cueType]++;
      
      // Calculate cue number: scene * 100 + cue count
      const baseNumber = sceneNumber * 100;
      const cueNumber = baseNumber + cueCounts[sceneKey][cueType];
      const newCueNumber = cueNumber.toString();
      
      // Update if different
      if (node.attrs.cueNumber !== newCueNumber || node.attrs.sceneNumber !== sceneNumber) {
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
                  cueId: `cue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
                // Highlight drop target
                const decorations = DecorationSet.create(view.state.doc, [
                  Decoration.inline(word.from, word.to, { class: 'drop-target-word drop-ready' }),
                ]);
                
                (view as any).cueDropDecorations = decorations;
                view.dispatch(view.state.tr.setMeta('addDropDecoration', decorations));
              } else {
                // Clear decorations if not over a word
                if ((view as any).cueDropDecorations) {
                  view.dispatch(view.state.tr.setMeta('removeDropDecoration', true));
                  delete (view as any).cueDropDecorations;
                }
              }
              
              return true;
            },
            
            dragleave: (view, _event) => {
              // Clear drop decorations when leaving editor
              if ((view as any).cueDropDecorations) {
                view.dispatch(view.state.tr.setMeta('removeDropDecoration', true));
                delete (view as any).cueDropDecorations;
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
    // Add native drag handlers to connection drag areas
    const setupConnectionDragHandlers = () => {
      const dragAreas = document.querySelectorAll('.cue-connection-drag-area');
      
      dragAreas.forEach((area: Element) => {
        const dragArea = area as HTMLElement;
        
        // Remove any existing listeners
        dragArea.ondragstart = null;
        
        // Add new listeners
        dragArea.ondragstart = (e) => {
          e.stopPropagation();
          
          const cueBlock = dragArea.closest('.cue-block');
          if (!cueBlock) return;
          
          // Get cue data from the block
          const cueNumber = dragArea.querySelector('.cue-number')?.textContent?.replace('Q', '') || '';
          // Get cue type from data attribute
          const cueType = cueBlock.getAttribute('data-cue-type') || 'light';
          
          logger.debug('CueBlock', 'Extracting cue data:', {
            dataAttribute: cueBlock.getAttribute('data-cue-type'),
            cueType,
            cueNumber
          });
          
          const cueData = {
            cueId: `cue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    
    // Setup handlers after a delay to ensure DOM is ready
    setTimeout(() => {
      setupConnectionDragHandlers();
      setupHoverHandlers();
    }, 100);
    
    // Re-setup handlers when content changes
    this.editor.on('update', () => {
      setTimeout(() => {
        setupConnectionDragHandlers();
        setupHoverHandlers();
      }, 100);
    });
    
    // Update cue numbers whenever the document changes
    this.editor.on('update', ({ transaction }) => {
      // Check if we need to update cue numbers
      let shouldUpdate = false;
      let deletedCues: Array<{cueType: string, cueNumber: string}> = [];
      
      // Check if any cue blocks were deleted
      if (transaction.docChanged) {
        // Check what was deleted
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
              deletedCues.push({ cueType, cueNumber });
            }
          }
        });
        
        transaction.steps.forEach((step: any) => {
          if (step.slice) {
            shouldUpdate = true;
          }
        });
      }
      
      // Remove connections for deleted cues
      if (deletedCues.length > 0) {
        const { tr } = this.editor.state;
        
        deletedCues.forEach(({ cueType, cueNumber }) => {
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
      }
      
      if (shouldUpdate) {
        setTimeout(() => {
          updateAllCueNumbers(this.editor);
        }, 10);
      }
    });
    
    // Initial numbering
    setTimeout(() => {
      updateAllCueNumbers(this.editor);
    }, 100);
  },

  addAttributes() {
    return {
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
        ['span', { class: 'cue-number' }, cueNumber ? `Q${cueNumber}` : ''],
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
        const result = commands.insertContent({
          type: this.name,
          attrs: { cueType, cueNumber: '999' }, // Temporary number
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
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-l': () => this.editor.commands.insertCueBlock('light'),
      'Mod-Shift-v': () => this.editor.commands.insertCueBlock('video'),
      'Mod-Shift-s': () => this.editor.commands.insertCueBlock('sound'),
      'Mod-Shift-p': () => this.editor.commands.insertCueBlock('props'),
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