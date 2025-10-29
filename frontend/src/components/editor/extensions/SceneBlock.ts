import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { Editor } from '@tiptap/core';

// Helper function to update all scene numbers in order while preserving scene names
function updateAllSceneNumbers(editor: Editor) {
  let sceneNumber = 1;
  const { tr } = editor.state;
  let hasChanges = false;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'sceneBlock') {
      const currentNumber = node.attrs.sceneNumber;
      const newNumber = sceneNumber.toString();
      
      if (currentNumber !== newNumber) {
        // Preserve all existing attributes, only update the scene number
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          sceneNumber: newNumber,
          // sceneName is preserved from node.attrs
        });
        hasChanges = true;
      }
      sceneNumber++;
    }
  });

  if (hasChanges) {
    editor.view.dispatch(tr);
  }
}

export interface SceneBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sceneBlock: {
      insertSceneBlock: () => ReturnType;
      updateSceneNumber: (number: string) => ReturnType;
      updateSceneName: (name: string) => ReturnType;
      renumberAllScenes: () => ReturnType;
    };
  }
}

export const SceneBlock = Node.create<SceneBlockOptions>({
  name: 'sceneBlock',
  group: 'block',
  content: 'inline*',
  draggable: true, // Enable drag-and-drop
  
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  onCreate() {
    // Track if we're in the initial load phase
    let isInitialLoad = true;
    setTimeout(() => {
      isInitialLoad = false;
    }, 2000); // Give 2 seconds for initial content to load

    // Keep track of scene count to detect additions/deletions
    let previousSceneCount = 0;
    let sceneUpdateTimer: number | null = null;

    // 🔧 PERFORMANCE FIX: Defer scene counting to avoid blocking on every keystroke
    // Update scene numbers when scenes are added, deleted, or moved
    this.editor.on('update', ({ transaction }) => {
      // Skip auto-numbering during initial content load
      if (isInitialLoad) {
        return;
      }

      // Only check for scene changes, don't count immediately
      let sceneStructureChanged = false;

      transaction.steps.forEach((step: any) => {
        const stepType = step.constructor.name;
        // Check for operations that might affect scenes
        if (stepType === 'ReplaceStep' || stepType === 'ReplaceAroundStep' || stepType === 'DeleteStep') {
          sceneStructureChanged = true;
        }

        if (transaction.getMeta('deleteScene')) {
          sceneStructureChanged = true;
        }
      });

      // Debounce scene counting and updates
      if (sceneStructureChanged && transaction.docChanged) {
        if (sceneUpdateTimer) {
          clearTimeout(sceneUpdateTimer);
        }

        // Defer counting and update using requestIdleCallback
        sceneUpdateTimer = window.setTimeout(() => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              let currentSceneCount = 0;
              this.editor.state.doc.descendants((node) => {
                if (node.type.name === 'sceneBlock') {
                  currentSceneCount++;
                }
              });

              if (currentSceneCount !== previousSceneCount) {
                previousSceneCount = currentSceneCount;
                updateAllSceneNumbers(this.editor);
              }
            }, { timeout: 1000 });
          } else {
            // Fallback: just update after delay
            let currentSceneCount = 0;
            this.editor.state.doc.descendants((node) => {
              if (node.type.name === 'sceneBlock') {
                currentSceneCount++;
              }
            });

            if (currentSceneCount !== previousSceneCount) {
              previousSceneCount = currentSceneCount;
              updateAllSceneNumbers(this.editor);
            }
          }
          sceneUpdateTimer = null;
        }, 500);
      }
    });

    // Set initial scene count
    setTimeout(() => {
      this.editor.state.doc.descendants((node) => {
        if (node.type.name === 'sceneBlock') {
          previousSceneCount++;
        }
      });
    }, 100);
  },

  addAttributes() {
    return {
      sceneNumber: {
        default: '1',
        parseHTML: element => element.getAttribute('data-scene-number'),
        renderHTML: attributes => {
          return { 'data-scene-number': attributes.sceneNumber };
        },
      },
      sceneName: {
        default: '',
        parseHTML: element => element.getAttribute('data-scene-name'),
        renderHTML: attributes => {
          return { 'data-scene-name': attributes.sceneName };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="scene-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const sceneNumber = node.attrs.sceneNumber || HTMLAttributes['data-scene-number'] || '1';
    // Fallback to inline text content if attribute is missing (supports server-imported scenes)
    const inlineText = (node as any).textContent || '';
    const sceneName = node.attrs.sceneName || HTMLAttributes['data-scene-name'] || inlineText || 'Untitled Scene';
    
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'scene-block',
        class: 'scene-block clickable-scene',
        'data-scene-number': sceneNumber,
        'data-scene-name': sceneName,
        'data-context': 'scene-select', // Add context for click handling
      }),
      ['span', { class: 'scene-number', contenteditable: 'false' }, sceneNumber],
      ['span', { class: 'scene-separator', contenteditable: 'false' }, ' '],
      // Render inline content (editable) for the scene name. This enables renaming.
      ['span', { class: 'scene-name' }, 0],
    ];
  },

  addCommands() {
    return {
      insertSceneBlock: () => ({ commands, editor }) => {
        // Insert scene with placeholder number, it will be updated automatically
        const result = commands.insertContent({
          type: this.name,
          attrs: { sceneNumber: '999' }, // Temporary number
          content: [{ type: 'text', text: 'Szene Name' }],
        });
        
        // Enable auto-numbering after insertion
        setTimeout(() => {
          updateAllSceneNumbers(editor);
        }, 10);
        
        return result;
      },
      updateSceneNumber: (number: string) => ({ commands }) => {
        return commands.updateAttributes(this.name, { sceneNumber: number });
      },
      updateSceneName: (name: string) => ({ commands }) => {
        return commands.updateAttributes(this.name, { sceneName: name });
      },
      renumberAllScenes: () => ({ editor }) => {
        updateAllSceneNumbers(editor);
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-z': () => this.editor.commands.insertSceneBlock(),
      // Allow Enter to exit scene block and create new paragraph
      'Enter': () => {
        const { state, view } = this.editor;
        const { selection } = state;
        const { $from } = selection;
        
        // Check if we're in a scene block
        if ($from.parent.type.name === 'sceneBlock') {
          // Insert a new paragraph after the scene block
          const pos = $from.after();
          view.dispatch(
            state.tr
              .insert(pos, state.schema.nodes.paragraph.create())
              .setSelection(TextSelection.near(state.doc.resolve(pos + 1)))
          );
          return true;
        }
        return false;
      },
      // Handle backspace to properly delete scenes
      'Backspace': () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;
        
        // Check if we're at the start of a scene block
        if ($from.parent.type.name === 'sceneBlock' && $from.parentOffset === 0) {
          // Mark transaction for scene deletion
          const tr = state.tr.setMeta('deleteScene', true);
          this.editor.view.dispatch(tr);
          return false; // Let default backspace behavior handle the deletion
        }
        return false;
      },
    };
  },
});
