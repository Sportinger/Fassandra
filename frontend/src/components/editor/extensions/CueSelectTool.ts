import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { CueType } from '../../../types/cue';

const cueSelectKey = new PluginKey('cueSelectMode');

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
  const seenFirstPos: Record<string, number> = {}; // cueId -> first pos
  const cueMeta: Record<string, { type: CueType; scene: number } | null> = {};

  // First pass: find first occurrence and scene/type
  state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
    if (node.isText && node.marks?.length) {
      node.marks.forEach(mark => {
        if (mark.type.name === 'cueConnection') {
          const cueId = mark.attrs.cueId as string;
          const cueType = (mark.attrs.cueType || 'light') as CueType;
          if (!cueId) return;
          if (seenFirstPos[cueId] == null) {
            seenFirstPos[cueId] = pos;
            const scene = getSceneNumberForPosition(state, pos);
            cueMeta[cueId] = { type: cueType, scene };
          }
        }
      });
    }
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
  state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
    if (node.isText && node.marks?.length) {
      node.marks.forEach(mark => {
        if (mark.type.name === 'cueConnection') {
          const cueId = mark.attrs.cueId as string;
          if (!cueId) return;
          const targetNumber = cueNumberMap[cueId];
          if (targetNumber && mark.attrs.cueNumber !== targetNumber) {
            // Replace this mark instance with updated cueNumber
            tr.removeMark(pos, pos + node.nodeSize, mark.type);
            const newMark = mark.type.create({ ...mark.attrs, cueNumber: targetNumber });
            tr.addMark(pos, pos + node.nodeSize, newMark);
            changed = true;
          }
        }
      });
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
        (cueType: CueType) => ({ tr, state, dispatch, editor }) => {
          const pluginState = { active: true, cueType, decorations: DecorationSet.empty };
          tr.setMeta(cueSelectKey, pluginState);
          if (dispatch) editor.view.dispatch(tr);
          return true;
        },
      stopCueSelect:
        () => ({ tr, state, dispatch, editor }) => {
          const pluginState = { active: false, cueType: null, decorations: DecorationSet.empty } as any;
          tr.setMeta(cueSelectKey, pluginState);
          if (dispatch) editor.view.dispatch(tr);
          return true;
        },
    } as any;
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<{ active: boolean; cueType: CueType | null; decorations: DecorationSet }>({
        key: cueSelectKey,
        state: {
          init: () => ({ active: false, cueType: null, decorations: DecorationSet.empty }),
          apply(tr, value) {
            const meta = tr.getMeta(cueSelectKey);
            if (meta) return meta;
            // Map decorations through doc changes
            if (value.decorations && tr.docChanged) {
              return { ...value, decorations: value.decorations.map(tr.mapping, tr.doc) };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const ps = this.getState(state);
            return ps?.decorations || DecorationSet.empty;
          },
          handleDOMEvents: {
            keydown: (view, event) => {
              const ps = cueSelectKey.getState(view.state);
              if (!ps?.active) return false;
              const e = event as KeyboardEvent;
              if (e.key === 'Escape') {
                const tr = view.state.tr;
                tr.setMeta(cueSelectKey, { active: false, cueType: null, decorations: DecorationSet.empty });
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
              // Create a new cue mark
              const cueId = `cue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              // Temporary number; renumber after insert
              const markType = view.state.schema.marks['cueConnection'];
              if (!markType) return false;
              const tr = view.state.tr;
              const tmpMark = markType.create({ cueId, cueType: ps.cueType, cueNumber: '0' });
              tr.addMark(word.from, word.to, tmpMark);
              // Exit select mode and clear highlight
              tr.setMeta(cueSelectKey, { active: false, cueType: null, decorations: DecorationSet.empty });
              view.dispatch(tr);
              // Renumber all cues based on scene/type order
              setTimeout(() => renumberCuesByMarks(view), 0);
              return true;
            },
          },
        },
        view: (view) => ({
          update: (view) => {
            // On any doc change, ensure numbering stays consistent
            renumberCuesByMarks(view);
          },
          destroy: () => {},
        }),
      }),
    ];
  },
});

export default CueSelectTool;
