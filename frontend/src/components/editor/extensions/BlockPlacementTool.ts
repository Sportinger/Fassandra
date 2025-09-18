import { Extension, type RawCommands } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Schema } from '@tiptap/pm/model';

type PlacementMode = 'dialogue' | 'scene';

const MODE_ICONS: Record<PlacementMode, string> = {
  dialogue: '💬',
  scene: '🎬',
};

const MODE_LABELS: Record<PlacementMode, string> = {
  dialogue: 'dialogue block',
  scene: 'scene marker',
};

type BlockPlacementState = {
  active: boolean;
  mode: PlacementMode | null;
  decorations: DecorationSet;
  targetPos: number | null;
};

const blockPlacementKey = new PluginKey<BlockPlacementState>('blockPlacementMode');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockPlacementTool: {
      startDialoguePlacement: () => ReturnType;
      startScenePlacement: () => ReturnType;
      stopBlockPlacement: () => ReturnType;
    };
  }
}

function createPlacementWidget(mode: PlacementMode): HTMLElement {
  const el = document.createElement('div');
  el.className = 'block-placement-target';
  el.dataset.mode = mode;
  return el;
}

function showIndicatorForMode(indicator: IndicatorElements, mode: PlacementMode) {
  ensureIndicator(indicator);
  if (!indicator.el || !indicator.iconEl || !indicator.textEl) return;

  const isCoarse = indicator.coarsePointer;
  indicator.iconEl.textContent = MODE_ICONS[mode];
  indicator.textEl.textContent = isCoarse
    ? `Tap between paragraphs to place a ${MODE_LABELS[mode]}`
    : `Click between paragraphs to place a ${MODE_LABELS[mode]}`;
  indicator.el.dataset.mode = mode;
  indicator.el.classList.add('active');

  if (!indicator.coarsePointer) {
    const { x, y } = indicator.lastPointer;
    if (x || y) {
      indicator.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    window.addEventListener('pointermove', indicator.pointerMoveListener, { passive: true });
  } else {
    indicator.el.style.transform = 'translate3d(-50%, 0, 0)';
  }
}

type IndicatorElements = {
  el: HTMLDivElement | null;
  iconEl: HTMLSpanElement | null;
  textEl: HTMLSpanElement | null;
  coarsePointer: boolean;
  lastPointer: { x: number; y: number };
  pointerMoveListener: (event: PointerEvent) => void;
};

function ensureIndicator(indicator: IndicatorElements) {
  if (indicator.el || typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.className = 'cue-select-indicator block-placement-indicator';

  const iconEl = document.createElement('span');
  iconEl.className = 'cue-select-indicator__icon';
  const textEl = document.createElement('span');
  textEl.className = 'cue-select-indicator__text';
  el.append(iconEl, textEl);

  indicator.el = el;
  indicator.iconEl = iconEl;
  indicator.textEl = textEl;
  indicator.coarsePointer = typeof window !== 'undefined'
    ? window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 767
    : false;

  if (indicator.coarsePointer) {
    el.classList.add('cue-select-indicator--mobile');
  }

  document.body.appendChild(el);
}

function hideIndicator(indicator: IndicatorElements) {
  if (!indicator.el) return;
  indicator.el.classList.remove('active');
  indicator.el.style.transform = 'translate3d(-9999px, -9999px, 0)';
  window.removeEventListener('pointermove', indicator.pointerMoveListener);
}

function teardownIndicator(indicator: IndicatorElements) {
  hideIndicator(indicator);
  if (indicator.el) {
    indicator.el.remove();
  }
  indicator.el = null;
  indicator.iconEl = null;
  indicator.textEl = null;
}

function resolveTopLevelBlock(state: EditorState, pos: number) {
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    const parent = $pos.node(depth - 1);
    if (node.type.isBlock && parent && parent.type === state.schema.topNodeType) {
      const start = $pos.before(depth);
      const end = start + node.nodeSize;
      return { start, end, node, depth };
    }
  }
  return null;
}

function calculateInsertionPos(view: EditorView, clientX: number, clientY: number): number | null {
  const posInfo = view.posAtCoords({ left: clientX, top: clientY });
  if (!posInfo) return null;

  const { state } = view;
  if (posInfo.pos <= 0) {
    return 0;
  }
  const topLevel = resolveTopLevelBlock(state, posInfo.pos);
  if (!topLevel) {
    // If document is empty or no block found, prefer inserting at end
    return state.doc.childCount === 0 ? 0 : state.doc.content.size;
  }

  const dom = view.nodeDOM(topLevel.start) as HTMLElement | null;
  if (!dom || !(dom instanceof HTMLElement)) {
    return topLevel.end;
  }

  const rect = dom.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  return clientY > midpoint ? topLevel.end : topLevel.start;
}

function createDialogueBlock(schema: Schema) {
  const dialogueBlockType = schema.nodes['dialogueBlock'];
  const speakerType = schema.nodes['speaker'];
  const dialogueTextType = schema.nodes['dialogueText'];
  const paragraphType = schema.nodes['paragraph'];
  if (!dialogueBlockType || !speakerType || !dialogueTextType || !paragraphType) {
    return null;
  }

  const speakerText = schema.text('Speaker');
  const speakerNode = speakerType.create({}, speakerText ? [speakerText] : undefined);
  const dialogueParagraph = paragraphType.create();
  const dialogueNode = dialogueTextType.create({}, [dialogueParagraph]);
  return dialogueBlockType.create({}, [speakerNode, dialogueNode]);
}

function createSceneBlock(schema: Schema) {
  const sceneBlockType = schema.nodes['sceneBlock'];
  if (!sceneBlockType) {
    return null;
  }
  const label = 'Szene Name';
  const textNode = schema.text(label);
  return sceneBlockType.create({ sceneNumber: '999', sceneName: label }, textNode ? [textNode] : undefined);
}

export const BlockPlacementTool = Extension.create({
  name: 'blockPlacementTool',

  addCommands() {
    return {
      startDialoguePlacement: () => ({ state, dispatch, editor }) => {
        editor.commands.stopCueSelect?.();
        const current = blockPlacementKey.getState(state);
        const shouldDeactivate = current?.active && current.mode === 'dialogue';
        const tr = state.tr;
        const pluginState: BlockPlacementState = shouldDeactivate
          ? { active: false, mode: null, decorations: DecorationSet.empty, targetPos: null }
          : { active: true, mode: 'dialogue', decorations: DecorationSet.empty, targetPos: null };
        tr.setMeta(blockPlacementKey, pluginState);
        if (dispatch) dispatch(tr); else editor.view.dispatch(tr);
        return true;
      },
      startScenePlacement: () => ({ state, dispatch, editor }) => {
        editor.commands.stopCueSelect?.();
        const current = blockPlacementKey.getState(state);
        const shouldDeactivate = current?.active && current.mode === 'scene';
        const tr = state.tr;
        const pluginState: BlockPlacementState = shouldDeactivate
          ? { active: false, mode: null, decorations: DecorationSet.empty, targetPos: null }
          : { active: true, mode: 'scene', decorations: DecorationSet.empty, targetPos: null };
        tr.setMeta(blockPlacementKey, pluginState);
        if (dispatch) dispatch(tr); else editor.view.dispatch(tr);
        return true;
      },
      stopBlockPlacement: () => ({ state, dispatch, editor }) => {
        const tr = state.tr;
        const pluginState: BlockPlacementState = {
          active: false,
          mode: null,
          decorations: DecorationSet.empty,
          targetPos: null,
        };
        tr.setMeta(blockPlacementKey, pluginState);
        if (dispatch) dispatch(tr); else editor.view.dispatch(tr);
        return true;
      },
    } as Partial<RawCommands>;
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const indicator: IndicatorElements = {
      el: null,
      iconEl: null,
      textEl: null,
      coarsePointer: false,
      lastPointer: { x: 0, y: 0 },
      pointerMoveListener: (event: PointerEvent) => {
        indicator.lastPointer = {
          x: event.clientX + 20,
          y: event.clientY - 28,
        };
        if (!indicator.el || indicator.coarsePointer) return;
        indicator.el.style.transform = `translate3d(${indicator.lastPointer.x}px, ${indicator.lastPointer.y}px, 0)`;
      },
    };

    return [
      new Plugin<BlockPlacementState>({
        key: blockPlacementKey,
        state: {
          init: (): BlockPlacementState => ({ active: false, mode: null, decorations: DecorationSet.empty, targetPos: null }),
          apply(tr: Transaction, value: BlockPlacementState) {
            const meta = tr.getMeta(blockPlacementKey) as BlockPlacementState | undefined;
            if (meta) return meta;
            if (value.decorations && tr.docChanged) {
              return { ...value, decorations: value.decorations.map(tr.mapping, tr.doc) };
            }
            return value;
          },
        },
        props: {
          decorations(state: EditorState) {
            const ps = blockPlacementKey.getState(state);
            return ps?.decorations || DecorationSet.empty;
          },
          handleDOMEvents: {
            keydown: (view, event) => {
              const ps = blockPlacementKey.getState(view.state);
              if (!ps?.active) return false;
              const e = event as KeyboardEvent;
              if (e.key === 'Escape') {
                const tr = view.state.tr;
                tr.setMeta(blockPlacementKey, { active: false, mode: null, decorations: DecorationSet.empty, targetPos: null });
                view.dispatch(tr);
                document.body.classList.remove('block-placement-active');
                hideIndicator(indicator);
                return true;
              }
              return false;
            },
            contextmenu: (view, event) => {
              const ps = blockPlacementKey.getState(view.state);
              if (!ps?.active) return false;
              event.preventDefault();
              const tr = view.state.tr;
              tr.setMeta(blockPlacementKey, { active: false, mode: null, decorations: DecorationSet.empty, targetPos: null });
              view.dispatch(tr);
              document.body.classList.remove('block-placement-active');
              hideIndicator(indicator);
              return true;
            },
            mousemove: (view, event) => {
              const ps = blockPlacementKey.getState(view.state);
              if (!ps?.active || !ps.mode) return false;

              indicator.lastPointer = {
                x: (event as MouseEvent).clientX + 20,
                y: (event as MouseEvent).clientY - 28,
              };
              if (!indicator.coarsePointer && indicator.el?.classList.contains('active')) {
                indicator.el.style.transform = `translate3d(${indicator.lastPointer.x}px, ${indicator.lastPointer.y}px, 0)`;
              }

              const targetPos = calculateInsertionPos(view, (event as MouseEvent).clientX, (event as MouseEvent).clientY);
              if (targetPos === ps.targetPos) {
                return false;
              }

              let decorations = DecorationSet.empty;
              if (typeof targetPos === 'number') {
                const deco = Decoration.widget(targetPos, () => createPlacementWidget(ps.mode!), { side: 0 });
                decorations = DecorationSet.create(view.state.doc, [deco]);
              }
              const tr = view.state.tr;
              tr.setMeta(blockPlacementKey, {
                ...ps,
                targetPos: typeof targetPos === 'number' ? targetPos : null,
                decorations,
              });
              view.dispatch(tr);
              return true;
            },
            click: (view, event) => {
              const ps = blockPlacementKey.getState(view.state);
              if (!ps?.active || !ps.mode || ps.targetPos == null) return false;
              event.preventDefault();
              event.stopPropagation();

              const { state } = view;
              const schema = state.schema;
              let tr = state.tr;

              if (ps.mode === 'dialogue') {
                const node = createDialogueBlock(schema);
                if (!node) return false;
                tr = tr.insert(ps.targetPos, node);
                const speakerStart = ps.targetPos + 2;
                const speakerTextLength = 'Speaker'.length;
                tr = tr.setSelection(TextSelection.create(tr.doc, speakerStart, speakerStart + speakerTextLength));
              } else {
                const node = createSceneBlock(schema);
                if (!node) return false;
                tr = tr.insert(ps.targetPos, node);
                const textStart = ps.targetPos + 1;
                const len = 'Szene Name'.length;
                tr = tr.setSelection(TextSelection.create(tr.doc, textStart, textStart + len));
              }

              tr.setMeta(blockPlacementKey, { active: false, mode: null, decorations: DecorationSet.empty, targetPos: null });
              view.dispatch(tr);

              hideIndicator(indicator);
              document.body.classList.remove('block-placement-active');

              if (ps.mode === 'scene') {
                setTimeout(() => {
                  editor?.commands.renumberAllScenes?.();
                }, 0);
              }

              return true;
            },
          },
        },
        view: (_view: EditorView) => ({
          update: (innerView: EditorView) => {
            const ps = blockPlacementKey.getState(innerView.state);
            if (ps?.active && ps.mode) {
              document.body.classList.add('block-placement-active');
              showIndicatorForMode(indicator, ps.mode);
            } else {
              document.body.classList.remove('block-placement-active');
              hideIndicator(indicator);
            }
          },
          destroy: () => {
            document.body.classList.remove('block-placement-active');
            hideIndicator(indicator);
            teardownIndicator(indicator);
          },
        }),
      }),
    ];
  },
});

export default BlockPlacementTool;
