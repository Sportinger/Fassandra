import { Node } from '@tiptap/core';

// Visible page indicator node rendered inline in the document.
export const PageIndicator = Node.create({
  name: 'pageIndicator',
  group: 'block',
  content: 'text*',
  draggable: false,
  selectable: false,
  atom: true,

  addStorage() {
    return {
      updateNumbers: null as (() => void) | null,
    };
  },

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

  onCreate() {
    // 🔧 PERFORMANCE FIX: Disabled auto-renumbering on every update
    // This was causing lag by traversing the entire document on every keystroke
    // Page indicators are deprecated - no longer auto-update
    const renumber = () => {
      // Disabled for performance
    };

    this.storage.updateNumbers = renumber;
    // Removed: setTimeout(renumber, 0);
    // Removed: this.editor.on('update', renumber);
  },

  onDestroy() {
    if (this.storage.updateNumbers) {
      this.editor.off('update', this.storage.updateNumbers);
    }
  },
});
