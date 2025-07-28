import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { Editor } from '@tiptap/core';
import { CueType, CUE_TYPE_LABELS } from '../../../types/cue';

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

export const CueBlock = Node.create<CueBlockOptions>({
  name: 'cueBlock',
  group: 'block',
  content: 'inline*',
  draggable: true, // Enable drag-and-drop
  
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  onCreate() {
    // Update cue numbers whenever the document changes
    this.editor.on('update', ({ transaction }) => {
      // Check if we need to update cue numbers
      let shouldUpdate = false;
      
      // Check if any cue or scene blocks were affected
      if (transaction.docChanged) {
        transaction.steps.forEach((step: any) => {
          if (step.slice) {
            shouldUpdate = true;
          }
        });
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
      ['span', { class: 'cue-number', contenteditable: 'false' }, cueNumber ? `Q${cueNumber}` : ''],
      ['span', { class: 'cue-label', contenteditable: 'false' }, label + ':'],
      ['span', { class: 'cue-content' }, 0], // Content slot without contenteditable
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