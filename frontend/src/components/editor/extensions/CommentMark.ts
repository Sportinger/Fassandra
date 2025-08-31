import { Mark, mergeAttributes } from '@tiptap/core';

export interface CommentAttributes {
  commentId: string;
  commentText?: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      addComment: (attrs: CommentAttributes) => ReturnType;
      updateCommentById: (commentId: string, attrs: Partial<CommentAttributes>) => ReturnType;
      removeCommentById: (commentId: string) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create({
  name: 'comment',
  excludes: '',
  spanning: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: el => el.getAttribute('data-comment-id'),
        renderHTML: attrs => attrs.commentId ? { 'data-comment-id': attrs.commentId } : {},
      },
      commentText: {
        default: null,
        parseHTML: el => el.getAttribute('data-comment-text'),
        renderHTML: attrs => attrs.commentText ? { 'data-comment-text': attrs.commentText } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'comment-annotation',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      addComment: (attrs: CommentAttributes) => ({ commands }) => {
        return commands.setMark(this.name, attrs);
      },
      updateCommentById: (commentId: string, attrs: Partial<CommentAttributes>) => ({ state, tr, dispatch }) => {
        const type = this.type;
        let changed = false;
        state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
          if (!node.isText || !node.marks.length) return;
          const cms = node.marks.filter(m => m.type.name === this.name);
          if (!cms.length) return;
          const next: any[] = cms.map(m => m.attrs.commentId === commentId ? type.create({ ...m.attrs, ...attrs }) : m);
          if (next.some((m, i) => m !== cms[i])) {
            tr.removeMark(pos, pos + node.nodeSize, type);
            next.forEach(m => tr.addMark(pos, pos + node.nodeSize, m));
            changed = true;
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      },
      removeCommentById: (commentId: string) => ({ state, tr, dispatch }) => {
        const type = this.type;
        let changed = false;
        state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
          if (!node.isText || !node.marks.length) return;
          node.marks.forEach(m => {
            if (m.type.name === this.name && m.attrs.commentId === commentId) {
              tr.removeMark(pos, pos + node.nodeSize, type);
              changed = true;
            }
          });
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      },
    };
  },
});

export default CommentMark;

