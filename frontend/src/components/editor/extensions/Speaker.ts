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
  addAttributes() {
    return {
      selected: {
        default: false,
        parseHTML: element => element.getAttribute('data-speaker-selected') === 'true',
        renderHTML: attributes => {
          if (attributes.selected) {
            return { 'data-speaker-selected': 'true' };
          }
          return {};
        },
      },
    } as any;
  },

  parseHTML() {
    return [{ tag: 'div[data-type="speaker"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const isSelected = (HTMLAttributes as any)['data-speaker-selected'] === 'true';
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'speaker',
      'contenteditable': isSelected ? 'true' : 'false'
    }), 0];
  },
}); 
