import { Node } from '@tiptap/core';

// Visible page indicator node rendered inline in the document.
export const PageIndicator = Node.create({
  name: 'pageIndicator',
  group: 'block',
  content: 'text*',
  draggable: false,
  selectable: false,
  atom: true,

  addAttributes() {
    return {
      pageNumber: {
        default: 1,
        parseHTML: element => parseInt(element.getAttribute('data-page-number') || '1', 10),
        renderHTML: attributes => ({ 'data-page-number': String(attributes.pageNumber) }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="page-indicator"]' },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const n = node?.attrs?.pageNumber || HTMLAttributes['data-page-number'] || 1;
    return ['div', { 'data-type': 'page-indicator', 'data-page-number': n, class: 'page-indicator-inline' }, `Page ${n}`];
  },
});

