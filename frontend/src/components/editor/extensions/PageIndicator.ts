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
    const renumber = () => {
      try {
        const { state } = this.editor;
        const tr = state.tr;
        let page = 1;
        let changed = false;

        state.doc.descendants((node, pos) => {
          if (node.type.name !== this.name) {
            return true;
          }

          if (node.attrs.pageNumber !== page) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              pageNumber: page,
            });
            changed = true;
          }

          page += 1;
          return false;
        });

        if (changed) {
          this.editor.view.dispatch(tr);
        }
      } catch (error) {
        console.error('[PageIndicator] Failed to renumber pages', error);
      }
    };

    this.storage.updateNumbers = renumber;
    setTimeout(renumber, 0);
    this.editor.on('update', renumber);
  },

  onDestroy() {
    if (this.storage.updateNumbers) {
      this.editor.off('update', this.storage.updateNumbers);
    }
  },
});
