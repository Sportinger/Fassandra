import { Node } from '@tiptap/core';

// Backward-compatibility only: keep old 'pageIndicator' nodes loadable but invisible.
export const PageIndicatorCompat = Node.create({
  name: 'pageIndicator',
  group: 'block',
  content: 'text*',
  draggable: false,
  selectable: false,
  atom: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="page-indicator"]' },
    ];
  },

  renderHTML() {
    return ['div', { 'data-type': 'page-indicator', style: 'display:none' }, 0];
  },
});

