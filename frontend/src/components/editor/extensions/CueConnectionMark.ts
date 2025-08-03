import { Mark, mergeAttributes } from '@tiptap/core';
import { CueType } from '../../../types/cue';

export interface CueConnectionAttributes {
  cueId: string;
  cueType: CueType;
  cueNumber: string;
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
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      class: `cue-connection cue-connection-${HTMLAttributes['data-cue-type'] || 'default'}`,
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
        ({ state, tr, dispatch }) => {
          let removed = false;
          const { doc, selection } = state;

          doc.nodesBetween(0, doc.content.size, (node, pos) => {
            if (node.isText && node.marks.length) {
              const marks = node.marks.filter(mark => {
                if (mark.type.name === this.name && mark.attrs.cueId === cueId) {
                  removed = true;
                  return false;
                }
                return true;
              });

              if (marks.length !== node.marks.length) {
                tr.removeMark(pos, pos + node.nodeSize, this.type);
                marks.forEach(mark => {
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
    };
  },
});