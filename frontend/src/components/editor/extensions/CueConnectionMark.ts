import { Mark, mergeAttributes } from '@tiptap/core';
import type { Mark as ProseMirrorMark, Node as ProseMirrorNode } from '@tiptap/pm/model';
import { CueType } from '../../../types/cue';

export interface CueConnectionAttributes {
  cueId: string;
  cueType: CueType;
  cueNumber: string;
  cueName?: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    cueConnectionMark: {
      /**
       * Set a cue connection mark
       */
      setCueConnection: (attributes: CueConnectionAttributes) => ReturnType;
      /**
       * Toggle a cue connection mark
       */
      toggleCueConnection: (attributes: CueConnectionAttributes) => ReturnType;
      /**
       * Unset a cue connection mark
       */
      unsetCueConnection: () => ReturnType;
      /**
       * Remove a specific cue connection by ID
       */
      removeCueConnection: (cueId: string) => ReturnType;
    };
  }
}

export const CueConnectionMark = Mark.create({
  name: 'cueConnection',
  
  // Allow multiple cueConnection marks on the same text
  excludes: '',
  spanning: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      cueId: {
        default: null,
        parseHTML: element => element.getAttribute('data-cue-id'),
        renderHTML: attributes => {
          if (!attributes.cueId) {
            return {};
          }
          return {
            'data-cue-id': attributes.cueId,
          };
        },
      },
      cueType: {
        default: null,
        parseHTML: element => element.getAttribute('data-cue-type'),
        renderHTML: attributes => {
          if (!attributes.cueType) {
            return {};
          }
          return {
            'data-cue-type': attributes.cueType,
          };
        },
      },
      cueNumber: {
        default: null,
        parseHTML: element => element.getAttribute('data-cue-number'),
        renderHTML: attributes => {
          if (!attributes.cueNumber) {
            return {};
          }
          return {
            'data-cue-number': attributes.cueNumber,
          };
        },
      },
      cueName: {
        default: null,
        parseHTML: element => element.getAttribute('data-cue-name'),
        renderHTML: attributes => {
          if (!attributes.cueName) return {};
          return {
            'data-cue-name': attributes.cueName,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-cue-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Count how many cue marks are on this text
    let cueCount = 1;
    let allCueTypes = [HTMLAttributes['data-cue-type'] || 'default'];
    
    // Note: We can't access other marks from here, so we rely on the data-cue-count attribute
    if (HTMLAttributes['data-cue-count']) {
      cueCount = parseInt(HTMLAttributes['data-cue-count'], 10) || 1;
    }
    
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      class: `cue-connection cue-connection-${HTMLAttributes['data-cue-type'] || 'default'}`,
      'data-cue-count': cueCount.toString(),
      'data-all-cue-types': allCueTypes.join(','),
    });

    return ['span', attrs, 0];
  },

  addCommands() {
    return {
      setCueConnection:
        (attributes: CueConnectionAttributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      toggleCueConnection:
        (attributes: CueConnectionAttributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
      unsetCueConnection:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      removeCueConnection:
        (cueId: string) =>
        ({ state, tr, dispatch }: { state: any; tr: any; dispatch?: (tr: any) => void }) => {
          let removed = false;
          const { doc } = state;

          doc.nodesBetween(0, doc.content.size, (node: ProseMirrorNode, pos: number) => {
            if (node.isText && node.marks.length) {
              const marks = node.marks.filter((mark: ProseMirrorMark) => {
                if (mark.type.name === this.name && mark.attrs.cueId === cueId) {
                  removed = true;
                  return false;
                }
                return true;
              });

              if (marks.length !== node.marks.length) {
                tr.removeMark(pos, pos + node.nodeSize, this.type);
                marks.forEach((mark: ProseMirrorMark) => {
                  tr.addMark(pos, pos + node.nodeSize, mark);
                });
              }
            }
          });

          if (removed && dispatch) {
            dispatch(tr);
          }

          return removed;
        },
      updateCueById:
        (cueId: string, attrs: Partial<CueConnectionAttributes>) =>
        ({ state, tr, dispatch }: { state: any; tr: any; dispatch?: (tr: any) => void }) => {
          let changed = false;
          const { doc } = state;
          const markType = this.type;
          doc.nodesBetween(0, doc.content.size, (node: ProseMirrorNode, pos: number) => {
            if (!node.isText || !node.marks.length) return;
            const cueMarks = node.marks.filter((m: ProseMirrorMark) => m.type.name === this.name);
            if (!cueMarks.length) return;
            const newMarks = cueMarks.map((m: ProseMirrorMark) => {
              if (m.attrs.cueId === cueId) {
                changed = true;
                return markType.create({ ...m.attrs, ...attrs });
              }
              return m;
            });
            if (changed) {
              // Rebuild the cue marks for this node only
              tr.removeMark(pos, pos + node.nodeSize, markType);
              newMarks.forEach((nm: ProseMirrorMark) => tr.addMark(pos, pos + node.nodeSize, nm));
            }
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    };
  },
});
