// This is a new file for the DialogueText extension.
// This will define the node for the dialogue content.
import { Node, mergeAttributes } from '@tiptap/core';

export const DialogueText = Node.create({
  name: 'dialogueText',
  content: 'paragraph+',
  group: 'block',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="dialogue-text"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'dialogue-text' }), 0];
  },
}); 