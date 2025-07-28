import { Node, mergeAttributes } from '@tiptap/core';
import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

// Helper function to update all page indicators
function updateAllPageIndicators(editor: Editor) {
  let pageNumber = 1;
  const { tr } = editor.state;
  let hasChanges = false;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'pageIndicator') {
      const currentNumber = node.attrs.pageNumber;
      const newNumber = pageNumber.toString();
      
      if (currentNumber !== newNumber) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          pageNumber: newNumber,
        });
        hasChanges = true;
      }
      pageNumber++;
    }
  });

  if (hasChanges) {
    editor.view.dispatch(tr);
  }
}

// Helper function to get current page number for a position
export function getPageNumberForPosition(editor: Editor, pos: number): number {
  let currentPageNumber = 1; // Default to page 1
  
  // Look backwards from the position to find the nearest page indicator
  editor.state.doc.nodesBetween(0, pos, (node, nodePos) => {
    if (node.type.name === 'pageIndicator' && nodePos < pos) {
      const pageNum = parseInt(node.attrs.pageNumber) || 1;
      currentPageNumber = pageNum;
    }
  });
  
  return currentPageNumber;
}

export interface PageIndicatorOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageIndicator: {
      insertPageIndicator: () => ReturnType;
      updatePageNumber: (number: string) => ReturnType;
    };
  }
}

export const PageIndicator = Node.create<PageIndicatorOptions>({
  name: 'pageIndicator',
  group: 'block',
  content: '', // No content needed - just page number
  draggable: true,
  atom: true, // Make it an atomic node
  
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  onCreate() {
    // Update page numbers whenever the document changes
    this.editor.on('update', ({ transaction }) => {
      // Check if we need to update page numbers
      let shouldUpdate = false;
      
      if (transaction.docChanged) {
        transaction.steps.forEach((step: any) => {
          if (step.slice) {
            shouldUpdate = true;
          }
        });
      }
      
      if (shouldUpdate) {
        setTimeout(() => {
          updateAllPageIndicators(this.editor);
        }, 10);
      }
    });
    
    // Initial numbering
    setTimeout(() => {
      updateAllPageIndicators(this.editor);
    }, 100);
  },

  addAttributes() {
    return {
      pageNumber: {
        default: '1',
        parseHTML: element => element.getAttribute('data-page-number'),
        renderHTML: attributes => {
          return { 'data-page-number': attributes.pageNumber };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="page-indicator"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const pageNumber = HTMLAttributes['data-page-number'] || '1';
    
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'page-indicator',
        class: 'page-indicator',
      }),
      ['span', { class: 'page-label', contenteditable: 'false' }, `SEITE ${pageNumber}`],
    ];
  },

  addCommands() {
    return {
      insertPageIndicator: () => ({ commands, editor }) => {
        // Insert page indicator with temporary number
        const result = commands.insertContent({
          type: this.name,
          attrs: { pageNumber: '999' }, // Temporary number
        });
        
        // Trigger page number update
        setTimeout(() => {
          updateAllPageIndicators(editor);
        }, 10);
        
        return result;
      },
      updatePageNumber: (number: string) => ({ commands }) => {
        return commands.updateAttributes(this.name, { pageNumber: number });
      },
      spreadPagesEvenly: (pageCount: number = 10) => ({ commands, editor, state }: any) => {
        // Calculate positions for even distribution
        const docLength = state.doc.content.size;
        const interval = Math.floor(docLength / (pageCount + 1));
        
        // Insert page indicators at calculated positions
        let inserted = false;
        for (let i = 1; i <= pageCount; i++) {
          const pos = i * interval;
          // Find the nearest valid position (after a block)
          const resolved = state.doc.resolve(Math.min(pos, docLength - 1));
          const insertPos = resolved.after(resolved.depth);
          
          if (insertPos < docLength) {
            commands.insertContentAt(insertPos, {
              type: 'pageIndicator',
              attrs: { pageNumber: i.toString() }
            });
            inserted = true;
          }
        }
        
        // Update numbering after all insertions
        if (inserted) {
          setTimeout(() => {
            updateAllPageIndicators(editor);
          }, 50);
        }
        
        return inserted;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-g': () => this.editor.commands.insertPageIndicator(),
    };
  },
});