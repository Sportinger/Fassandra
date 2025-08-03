// This is a new file for the DialogueBlock extension.
// We will define the main container node here.
import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

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
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'dialogue-block' }), 0];
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
}); 