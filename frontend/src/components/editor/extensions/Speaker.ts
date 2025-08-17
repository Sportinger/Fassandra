// This is a new file for the Speaker extension.
// This will define the node for the speaker's name.
import { Node, mergeAttributes } from '@tiptap/core';

export const Speaker = Node.create({
  name: 'speaker',
  content: 'text*',
  group: 'block',
  defining: true,
  marks: 'textStyle', // Allow textStyle marks (which includes color)
  atom: false, // Allow marks to be applied to content

  parseHTML() {
    return [{ tag: 'div[data-type="speaker"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'speaker',
      'contenteditable': 'false' // Prevent editing
    }), 0];
  },
}); 