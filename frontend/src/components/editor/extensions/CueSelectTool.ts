import { Extension, type CommandProps, type RawCommands } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { CueType } from '../../../types/cue';

const cueSelectKey = new PluginKey<CueSelectState>('cueSelectMode');

type CueSelectState = {
  active: boolean;
  cueType: CueType | null;
  cueId: string | null;
  decorations: DecorationSet;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    cueSelectTool: {
      startCueSelect: (cueType: CueType) => ReturnType;
      startCueExtend: (cueId: string) => ReturnType;
      stopCueSelect: () => ReturnType;
    };
  }
}

// Find the word boundaries at a position (similar to prior helper)
function getWordAtPosition(doc: ProseMirrorNode, pos: number): { from: number; to: number; text: string } | null {
  const $pos = doc.resolve(pos);
  const parent = $pos.parent;
  if (!parent || !parent.isTextblock) return null;
  const text = parent.textContent;
  const offset = $pos.parentOffset;
  let start = offset;
  let end = offset;
  while (start > 0 && /\S/.test(text.charAt(start - 1))) start--;
  while (end < text.length && /\S/.test(text.charAt(end))) end++;
  if (start === end) return null;
  const basePos = $pos.start();
  return { from: basePos + start, to: basePos + end, text: text.slice(start, end) };
}

// Determine scene number for a given document position
function getSceneNumberForPosition(state: EditorState, pos: number): number {
  let current = 1;
  state.doc.nodesBetween(0, pos, (node, nodePos) => {
    if (node.type && node.type.name === 'sceneBlock' && nodePos < pos) {
      const sn = parseInt((node.attrs?.sceneNumber as any) || '1', 10);
      current = isNaN(sn) ? 1 : sn;
    }
  });
  return current;
}

// Re-number all cueConnection marks by unique cueId per scene and type
function renumberCuesByMarks(view: EditorView) {
  const { state } = view;
  const tr = state.tr;
  const seenFirstPos: Record<string, number> = {}; // cueId -> pos to keep
  const cueMeta: Record<string, { type: CueType; scene: number } | null> = {};
  const markType = state.schema.marks['cueConnection'];

  // First pass: find first occurrence and scene/type
  state.doc.nodesBetween(0, state.doc.content.size, (node: ProseMirrorNode, pos: number) => {
    if (!node.isText || !node.marks?.length) return;
    node.marks.forEach((mark) => {
      if (mark.type.name !== 'cueConnection') return;
      const cueId = mark.attrs.cueId as string;
      const cueType = (mark.attrs.cueType || 'light') as CueType;
      if (!cueId) return;
      if (seenFirstPos[cueId] == null) {
        seenFirstPos[cueId] = pos; // first occurrence kept
        const scene = getSceneNumberForPosition(state, pos);
        cueMeta[cueId] = { type: cueType, scene };
      } else {
        // Do nothing here; we'll drop extras in the rebuild below
      }
    });
  });

  // Build counters per scene and type
  const counters: Record<string, Record<CueType, number>> = {};
  const sortedCues = Object.entries(seenFirstPos).sort((a, b) => a[1] - b[1]);
  const cueNumberMap: Record<string, string> = {};
  for (const [cueId] of sortedCues) {
    const meta = cueMeta[cueId];
    if (!meta) continue;
    const sceneKey = `scene_${meta.scene}`;
    counters[sceneKey] ||= { light: 0, video: 0, sound: 0, props: 0 } as Record<CueType, number>;
    counters[sceneKey][meta.type] += 1;
    const num = meta.scene * 100 + counters[sceneKey][meta.type];
    cueNumberMap[cueId] = String(num);
  }

  // Second pass: update all marks to have consistent cueNumber
  let changed = false;
  state.doc.nodesBetween(0, state.doc.content.size, (node: ProseMirrorNode, pos: number) => {
    if (!node.isText || !node.marks?.length) return;
    const cueMarks = node.marks.filter(mark => mark.type.name === 'cueConnection');
    if (!cueMarks.length) return;
    const rebuilt: typeof cueMarks = [];
    cueMarks.forEach(mark => {
      const cueId = mark.attrs.cueId as string;
      if (!cueId) return;
      // Keep only the first occurrence per cueId across the doc
      if (seenFirstPos[cueId] != null && pos !== seenFirstPos[cueId]) {
        changed = true; // drop this duplicate by not re-adding
        return;
      }
      const targetNumber = cueNumberMap[cueId];
      if (targetNumber && mark.attrs.cueNumber !== targetNumber) {
        rebuilt.push(markType.create({ ...mark.attrs, cueNumber: targetNumber }));
        changed = true;
      } else {
        rebuilt.push(mark);
      }
    });
    if (changed) {
      tr.removeMark(pos, pos + node.nodeSize, markType);
      rebuilt.forEach(m => tr.addMark(pos, pos + node.nodeSize, m));
    }
  });

  if (changed) view.dispatch(tr);
}

export const CueSelectTool = Extension.create({
  name: 'cueSelectTool',

  addOptions() {
    return {};
  },

  addCommands() {
    return {
      startCueSelect:
        (cueType: CueType) => ({ state, dispatch, editor }: CommandProps) => {
          const tr = state.tr;
          const pluginState: CueSelectState = { active: true, cueType, cueId: null, decorations: DecorationSet.empty };
          tr.setMeta(cueSelectKey, pluginState);
          if (dispatch) dispatch(tr);
          else editor.view.dispatch(tr);
          return true;
        },
      startCueExtend:
        (cueId: string) => ({ state, dispatch, editor }: CommandProps) => {
          const tr = state.tr;
          let cueType: CueType | null = null;
          state.doc.nodesBetween(0, state.doc.content.size, (node: ProseMirrorNode, _pos: number) => {
            if (cueType) return false;
            if (node.isText && node.marks.length) {
              node.marks.forEach(mark => {
                if (mark.type.name === 'cueConnection' && mark.attrs.cueId === cueId) {
                  cueType = mark.attrs.cueType as CueType;
                }
              });
            }
          });
          if (!cueType) cueType = 'light';
          const pluginState: CueSelectState = { active: true, cueType, cueId, decorations: DecorationSet.empty };
          tr.setMeta(cueSelectKey, pluginState);
          if (dispatch) dispatch(tr);
          else editor.view.dispatch(tr);
          return true;
        },
      stopCueSelect:
        () => ({ state, dispatch, editor }: CommandProps) => {
          const tr = state.tr;
          const pluginState: CueSelectState = { active: false, cueType: null, cueId: null, decorations: DecorationSet.empty };
          tr.setMeta(cueSelectKey, pluginState);
          if (dispatch) dispatch(tr);
          else editor.view.dispatch(tr);
          return true;
        },
    } as Partial<RawCommands>;
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<CueSelectState>({
        key: cueSelectKey,
        state: {
          init: (): CueSelectState => ({ active: false, cueType: null, cueId: null, decorations: DecorationSet.empty }),
          apply(tr: Transaction, value: CueSelectState) {
            const meta = tr.getMeta(cueSelectKey) as CueSelectState | undefined;
            if (meta) return meta;
            if (value.decorations && tr.docChanged) {
              return { ...value, decorations: value.decorations.map(tr.mapping, tr.doc) };
            }
            return value;
          },
        },
        props: {
          decorations(state: EditorState) {
            const ps = cueSelectKey.getState(state);
            return ps?.decorations || DecorationSet.empty;
          },
          handleDOMEvents: {
            keydown: (view, event) => {
              const ps = cueSelectKey.getState(view.state);
              if (!ps?.active) return false;
              const e = event as KeyboardEvent;
              if (e.key === 'Escape') {
                const tr = view.state.tr;
                tr.setMeta(cueSelectKey, { active: false, cueType: null, cueId: null, decorations: DecorationSet.empty });
                view.dispatch(tr);
                return true;
              }
              return false;
            },
            mousemove: (view, event) => {
              const ps = cueSelectKey.getState(view.state);
              if (!ps?.active) return false;
              const pos = view.posAtCoords({ left: (event as MouseEvent).clientX, top: (event as MouseEvent).clientY });
              if (!pos) return false;
              const word = getWordAtPosition(view.state.doc, pos.pos);
              const decorations = word
                ? DecorationSet.create(view.state.doc, [Decoration.inline(word.from, word.to, { class: 'cue-select-hover' })])
                : DecorationSet.empty;
              const tr = view.state.tr;
              tr.setMeta(cueSelectKey, { ...ps, decorations });
              view.dispatch(tr);
              return true;
            },
            click: (view, event) => {
              const ps = cueSelectKey.getState(view.state);
              if (!ps?.active || !ps.cueType) return false;
              const coords = { left: (event as MouseEvent).clientX, top: (event as MouseEvent).clientY };
              const pos = view.posAtCoords(coords);
              if (!pos) return false;
              const word = getWordAtPosition(view.state.doc, pos.pos);
              if (!word) return false;
              const cueId = ps.cueId || `cue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const markType = view.state.schema.marks['cueConnection'];
              if (!markType) return false;
              const tr = view.state.tr;
              if (ps.cueId) {
                view.state.doc.nodesBetween(0, view.state.doc.content.size, (node: ProseMirrorNode, pos: number) => {
                  if (!node.isText || !node.marks.length) return;
                  const cueMarks = node.marks.filter(mark => mark.type.name === 'cueConnection');
                  const keep = cueMarks.filter(mark => mark.attrs.cueId !== cueId);
                  if (keep.length !== cueMarks.length) {
                    tr.removeMark(pos, pos + node.nodeSize, markType);
                    keep.forEach(mark => tr.addMark(pos, pos + node.nodeSize, mark));
                  }
                });
              }
              const tempMark = markType.create({ cueId, cueType: ps.cueType, cueNumber: '0' });
              tr.addMark(word.from, word.to, tempMark);
              tr.setMeta(cueSelectKey, { active: false, cueType: null, cueId: null, decorations: DecorationSet.empty });
              view.dispatch(tr);
              setTimeout(() => renumberCuesByMarks(view), 0);
              return true;
            },
          },
        },
        view: (_view) => ({
          update: (innerView: EditorView) => {
            renumberCuesByMarks(innerView);
            try {
              const ps = cueSelectKey.getState(innerView.state);
              if (ps?.active) {
                document.body.classList.add('cue-select-active');
              } else {
                document.body.classList.remove('cue-select-active');
              }
            } catch {}
          },
          destroy: () => {
            try { document.body.classList.remove('cue-select-active'); } catch {}
          },
        }),
      }),
    ];
  },
});

export default CueSelectTool;
