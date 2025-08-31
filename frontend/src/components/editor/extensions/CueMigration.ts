import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import type { EditorState } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

function isTextblock(node: ProseMirrorNode) {
  return (node as any).isTextblock === true;
}

function getWordAtPosition(doc: ProseMirrorNode, pos: number): { from: number; to: number } | null {
  try {
    const $pos = (doc as any).resolve(pos);
    const parent = $pos.parent;
    if (!parent || !isTextblock(parent)) return null;
    const text = parent.textContent;
    const offset = $pos.parentOffset;
    let start = offset;
    let end = offset;
    while (start > 0 && /\S/.test(text.charAt(start - 1))) start--;
    while (end < text.length && /\S/.test(text.charAt(end))) end++;
    if (start === end) return null;
    const basePos = $pos.start();
    return { from: basePos + start, to: basePos + end };
  } catch {
    return null;
  }
}

function findFirstWordAfter(state: EditorState, fromPos: number): { from: number; to: number } | null {
  const { doc } = state;
  // Scan forward for the first textblock with a word
  let targetPos: { from: number; to: number } | null = null;
  doc.nodesBetween(fromPos, doc.content.size, (node, pos) => {
    if (targetPos) return false;
    if (isTextblock(node) && node.textContent && node.textContent.trim().length > 0) {
      // Use the start of this textblock
      const at = pos + 1; // inside the block
      const word = getWordAtPosition(doc, at) || { from: at, to: at + Math.min(1, node.textContent.length) };
      targetPos = word;
      return false;
    }
    return true;
  });
  return targetPos;
}

export const CueMigration = Extension.create({
  name: 'cueMigration',

  onCreate() {
    // Convert legacy cueBlock nodes into cueConnection marks and remove the blocks
    setTimeout(() => {
      try {
        const editor = this.editor as unknown as Editor;
        const { state, view } = editor;
        const markType = state.schema.marks['cueConnection'];
        if (!markType) return;
        const tr = state.tr;
        let mutated = false;
        state.doc.descendants((node, pos) => {
          if (node.type && node.type.name === 'cueBlock') {
            const cueType = (node.attrs?.cueType as string) || 'light';
            const cueName = (node.textContent || '').trim() || null;
            const after = pos + node.nodeSize;
            const word = findFirstWordAfter(state, after);
            if (word) {
              const cueId = `cue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const m = markType.create({ cueId, cueType, cueNumber: '0', cueName });
              tr.addMark(word.from, word.to, m);
              mutated = true;
            }
            // Remove the old node
            tr.delete(pos, pos + node.nodeSize);
            mutated = true;
            return false;
          }
          return true;
        });
        if (mutated) {
          view.dispatch(tr);
        }
      } catch (e) {
        // Best-effort; ignore errors
      }
    }, 50);
  },
});

export default CueMigration;

