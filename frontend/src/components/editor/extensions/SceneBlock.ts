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

    // Update scene numbers only when scenes are actually moved/added/deleted
    this.editor.on('update', ({ transaction }) => {
      // Skip auto-numbering during initial content load
      if (isInitialLoad) {
        return;
      }

      // Only update if there was an actual structural change to scene blocks
      let shouldUpdate = false;
      
      transaction.steps.forEach((step: any) => {
        if (step.slice) {
          // Check if this step involves scene blocks
          const content = step.slice.content;
          if (content) {
            content.forEach((node: any) => {
              if (node.type && node.type.name === 'sceneBlock') {
                // Only update for actual structural changes, not text edits
                if (step.constructor.name === 'ReplaceStep' || step.constructor.name === 'ReplaceAroundStep') {
                  shouldUpdate = true;
                }
              }
            });
          }
        }
      });
      
      if (shouldUpdate && transaction.docChanged) {
        setTimeout(() => {
          updateAllSceneNumbers(this.editor);
        }, 100);
      }
    });
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
    const sceneName = node.attrs.sceneName || HTMLAttributes['data-scene-name'] || 'Untitled Scene';
    
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'scene-block',
        class: 'scene-block',
        'data-scene-number': sceneNumber,
        'data-scene-name': sceneName,
      }),
      ['span', { class: 'scene-number', contenteditable: 'false' }, sceneNumber],
      ['span', { class: 'scene-separator', contenteditable: 'false' }, ' '],
      ['span', { class: 'scene-name', contenteditable: 'true' }, sceneName],
    ];
  },

  addCommands() {
    return {
      insertSceneBlock: () => ({ commands }) => {
        // Insert scene with placeholder number, it will be updated automatically
        const result = commands.insertContent({
          type: this.name,
          attrs: { sceneNumber: '999' }, // Temporary number
          content: [{ type: 'text', text: 'Szene Name' }],
        });
        
        // DISABLED: Auto-numbering interferes with scene numbers from database
        // setTimeout(() => {
        //   updateAllSceneNumbers(editor);
        // }, 10);
        
        return result;
      },
      updateSceneNumber: (number: string) => ({ commands }) => {
        return commands.updateAttributes(this.name, { sceneNumber: number });
      },
      updateSceneName: (name: string) => ({ commands }) => {
        return commands.updateAttributes(this.name, { sceneName: name });
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
    };
  },
});