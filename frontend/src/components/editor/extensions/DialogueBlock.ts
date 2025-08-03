// This is a new file for the DialogueBlock extension.
// We will define the main container node here.
import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection, NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface DialogueBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogueBlock: {
      insertDialogueBlock: () => ReturnType;
      setDialogueLayout: (layout: string) => ReturnType;
      exitDialogueBlock: () => ReturnType;
      toggleDialogueStrikeThrough: () => ReturnType;
    };
  }
}

export const DialogueBlock = Node.create<DialogueBlockOptions>({
  name: 'dialogueBlock',
  group: 'block',
  content: 'speaker dialogueText',
  draggable: true, // Re-enable dragging
  allowGapCursor: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      layout: {
        default: 'default',
        parseHTML: element => element.getAttribute('data-layout'),
        renderHTML: attributes => {
          return { 'data-layout': attributes.layout };
        },
      },
      struckThrough: {
        default: false,
        parseHTML: element => element.getAttribute('data-struck-through') === 'true',
        renderHTML: attributes => {
          if (attributes.struckThrough) {
            return { 'data-struck-through': 'true' };
          }
          return {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="dialogue-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div', 
      mergeAttributes(
        this.options.HTMLAttributes, 
        HTMLAttributes, 
        { 
          'data-type': 'dialogue-block',
          'data-drag-handle': '.dialogue-drag-handle' // Specify handle selector
        }
      ), 
      0
    ];
  },

  addCommands() {
    return {
      insertDialogueBlock: () => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          content: [
            { type: 'speaker', content: [{ type: 'text', text: 'Speaker' }] },
            { type: 'dialogueText', content: [{ type: 'paragraph' }] },
          ],
        });
      },
      setDialogueLayout: (layout: string) => ({ commands }) => {
        return commands.updateAttributes(this.name, { layout });
      },
      toggleDialogueStrikeThrough: () => ({ commands, state }) => {
        const { selection } = state;
        const { $from } = selection;
        
        // Find the dialogue block node
        for (let depth = $from.depth; depth >= 0; depth--) {
          const node = $from.node(depth);
          if (node.type.name === 'dialogueBlock') {
            const currentStruckThrough = node.attrs.struckThrough || false;
            return commands.updateAttributes(this.name, { struckThrough: !currentStruckThrough });
          }
        }
        
        return false;
      },
      exitDialogueBlock: () => ({ state, dispatch }) => {
        // Insert a new paragraph after the current dialogue block
        const { selection } = state;
        const { $from } = selection;
        
        // Find the dialogue block node
        let dialogueBlockPos = null;
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === 'dialogueBlock') {
            dialogueBlockPos = $from.end(depth);
            break;
          }
        }
        
        if (dialogueBlockPos !== null) {
          // Insert a new paragraph after the dialogue block
          const tr = state.tr.insert(dialogueBlockPos, state.schema.nodes.paragraph.create());
          // Move cursor to the new paragraph using TextSelection.near
          const newPos = tr.doc.resolve(dialogueBlockPos + 1);
          tr.setSelection(TextSelection.near(newPos));
          if (dispatch) {
            dispatch(tr);
          }
          return true;
        }
        
        return false;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Escape key to exit dialogue block
      'Escape': () => this.editor.commands.exitDialogueBlock(),
      // Enter key at end of dialogue text to create new paragraph
      'Mod-Enter': () => this.editor.commands.exitDialogueBlock(),
      // Double Enter to exit dialogue block
      'Enter Enter': ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from } = selection;
        
        // Check if we're in a dialogue block and the current paragraph is empty
        const isInDialogueBlock = $from.node().type.name === 'paragraph' && 
                                  $from.parent.type.name === 'dialogueText';
        
        if (isInDialogueBlock && $from.parent.textContent.trim() === '') {
          return this.editor.commands.exitDialogueBlock();
        }
        
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('dialogueBlockDragHandle'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'dialogueBlock') {
                // Find the speaker node within this dialogue block
                let speakerPos = null;
                let speakerEndPos = null;
                
                node.forEach((child, offset) => {
                  if (child.type.name === 'speaker') {
                    speakerPos = pos + offset + 1;
                    speakerEndPos = speakerPos + child.nodeSize;
                  }
                });
                
                if (speakerEndPos !== null) {
                  // Add drag handle after the speaker content
                  decorations.push(
                    Decoration.widget(speakerEndPos - 1, () => {
                      const handle = document.createElement('span');
                      handle.className = 'dialogue-drag-handle';
                      handle.innerHTML = ' ⋮⋮';
                      handle.setAttribute('data-drag-handle', 'true');
                      handle.setAttribute('data-dialogue-block-pos', pos.toString());
                      // Don't make the handle itself draggable
                      handle.draggable = false;
                      return handle;
                    }, {
                      side: 1, // Place after the speaker text
                    })
                  );
                }
              }
            });
            
            return DecorationSet.create(state.doc, decorations);
          },
          
          handleDOMEvents: {
            mousedown: (view, event) => {
              const target = event.target as HTMLElement;
              
              // Check if clicking on drag handle
              if (!target.classList.contains('dialogue-drag-handle')) {
                return false;
              }
              
              // Get the dialogue block position from the handle
              const blockPos = parseInt(target.getAttribute('data-dialogue-block-pos') || '0');
              
              // Select the entire dialogue block
              const nodeSelection = NodeSelection.create(view.state.doc, blockPos);
              view.dispatch(view.state.tr.setSelection(nodeSelection));
              
              // Find the dialogue block element
              const blockEl = view.domAtPos(blockPos).node as HTMLElement;
              if (!blockEl || blockEl.nodeType !== Node.ELEMENT_NODE) return true;
              
              const dialogueBlockEl = blockEl.closest('[data-type="dialogue-block"]');
              if (!dialogueBlockEl) return true;
              
              // Make the entire dialogue block draggable temporarily
              dialogueBlockEl.setAttribute('draggable', 'true');
              
              // Start drag operation
              event.preventDefault();
              const dataTransfer = new DataTransfer();
              
              // Create a custom drag event
              setTimeout(() => {
                const dragEvent = new DragEvent('dragstart', {
                  bubbles: true,
                  cancelable: true,
                  dataTransfer: dataTransfer,
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
                dialogueBlockEl.dispatchEvent(dragEvent);
              }, 0);
              
              return true;
            },
            
            dragend: (view, event) => {
              // Clean up draggable attributes
              view.dom.querySelectorAll('[data-type="dialogue-block"][draggable="true"]').forEach(el => {
                el.removeAttribute('draggable');
              });
              return false;
            },
          },
        },
      }),
    ];
  },
}); 