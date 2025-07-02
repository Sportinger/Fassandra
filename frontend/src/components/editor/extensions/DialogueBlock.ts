// This is a new file for the DialogueBlock extension.
// We will define the main container node here.
import { Node, mergeAttributes } from '@tiptap/core';

export interface DialogueBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogueBlock: {
      insertDialogueBlock: () => ReturnType;
      setDialogueLayout: (layout: string) => ReturnType;
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
        default: 'side-by-side',
        parseHTML: element => element.getAttribute('data-layout'),
        renderHTML: attributes => {
          return { 'data-layout': attributes.layout };
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
    };
  },
}); 