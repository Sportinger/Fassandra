import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction, type MouseEvent as ReactMouseEvent } from 'react';
import type { Editor } from '@tiptap/react';
import type { ToolbarContext } from '../types';

type ShowContextMenu = (x: number, y: number, context: ToolbarContext) => void;

type UseEditorCanvasClickArgs = {
  editor: Editor | null;
  debugLog: (...args: any[]) => void;
  editAllSpeakers: boolean;
  setEditAllSpeakers: Dispatch<SetStateAction<boolean>>;
  setCurrentSpeakerName: (name: string | null) => void;
  liveRenameBaseRef: MutableRefObject<string | null>;
  hideContextMenu: () => void;
  showContextMenu: ShowContextMenu;
};

const clearSpeakerHighlights = () => {
  document.querySelectorAll('[data-type="speaker"].speaker-selected').forEach((el) => {
    el.classList.remove('speaker-selected');
    try { (el as HTMLElement).removeAttribute('data-speaker-selected'); } catch {}
    try {
      const hel = el as HTMLElement;
      hel.style.removeProperty('border');
      hel.style.removeProperty('outline');
      hel.style.removeProperty('outline-offset');
      hel.style.removeProperty('padding');
      hel.style.removeProperty('box-shadow');
    } catch {}
  });
};

const clearCueSceneHighlights = () => {
  document.querySelectorAll('[data-type="cue-block"].cue-selected').forEach((el) => el.classList.remove('cue-selected'));
  document.querySelectorAll('[data-type="scene-block"].scene-selected').forEach((el) => el.classList.remove('scene-selected'));
};

export const useEditorCanvasClick = ({
  editor,
  debugLog,
  editAllSpeakers,
  setEditAllSpeakers,
  setCurrentSpeakerName,
  liveRenameBaseRef,
  hideContextMenu,
  showContextMenu,
}: UseEditorCanvasClickArgs) => {
  return useCallback((event: ReactMouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const speakerElement = target.closest('[data-type="speaker"]') as HTMLElement | null;
    const dialogueTextElement = target.closest('[data-type="dialogue-text"]');
    const dialogueBlockElement = target.closest('[data-type="dialogue-block"]');
    const cueBlockElement = target.closest('[data-type="cue-block"]') as HTMLElement | null;
    const sceneBlockElement = target.closest('[data-type="scene-block"]') as HTMLElement | null;

    const previouslySelectedSpeaker = document.querySelector('[data-type="speaker"].speaker-selected') as HTMLElement | null;
    const prevSpeakerBlock = previouslySelectedSpeaker?.closest('[data-type="dialogue-block"]');
    const currentClickBlock = target.closest('[data-type="dialogue-block"]');
    const clickedInsideProseMirror = Boolean(target.closest('.ProseMirror'));

    if (!previouslySelectedSpeaker || !prevSpeakerBlock || prevSpeakerBlock !== currentClickBlock) {
      clearSpeakerHighlights();
      if (editor) {
        try {
          const anyEditor = editor as any;
          const { state, view } = anyEditor;
          let tr = state.tr;
          let changed = false;
          state.doc.descendants((node: any, position: number) => {
            if (node.type?.name === 'speaker' && node.attrs?.selected) {
              tr = tr.setNodeMarkup(position, undefined, { ...node.attrs, selected: false });
              changed = true;
            }
            return true;
          });
          if (changed) view.dispatch(tr);
        } catch {}
      }
    }

    clearCueSceneHighlights();

    if (speakerElement) {
      debugLog('[Editor] Clicked on speaker element:', speakerElement);
      const speakerName = speakerElement.textContent?.trim() || '';
      setCurrentSpeakerName(speakerName);
      if (editAllSpeakers) liveRenameBaseRef.current = speakerName;

      try {
        const anyEditor = editor as any;
        const view: any = anyEditor?.view;
        const state = editor?.state;
        if (view && state) {
          let targetPos: number | null = null;
          state.doc.descendants((node: any, position: number) => {
            if (node.type?.name === 'speaker') {
              const domForNode = view.nodeDOM(position) as HTMLElement | null;
              if (domForNode && (domForNode === speakerElement || domForNode.contains(speakerElement))) {
                targetPos = position;
                return false;
              }
            }
            return true;
          });
          if (typeof targetPos === 'number') {
            const nodeAt = state.doc.nodeAt(targetPos);
            if (nodeAt) {
              let tr = state.tr;
              state.doc.descendants((node: any, position: number) => {
                if (node.type?.name === 'speaker' && node.attrs?.selected) {
                  tr = tr.setNodeMarkup(position, undefined, { ...node.attrs, selected: false });
                }
                return true;
              });
              tr = tr.setNodeMarkup(targetPos, undefined, { ...nodeAt.attrs, selected: true });
              view.dispatch(tr);
              const end = targetPos + 1 + nodeAt.content.size;
              try {
                (editor as any).chain().setTextSelection(end).focus().run();
              } catch {}
            }
          }
        }
      } catch {}

      if (editAllSpeakers) {
        document.querySelectorAll('[data-type="speaker"]').forEach((el) => {
          if (el.textContent?.trim() === speakerName) {
            el.classList.add('speaker-selected');
            try { el.setAttribute('data-speaker-selected', 'true'); } catch {}
          } else {
            el.classList.remove('speaker-selected');
            try { el.removeAttribute('data-speaker-selected'); } catch {}
          }
        });
      } else {
        speakerElement.classList.add('speaker-selected');
        try { speakerElement.setAttribute('data-speaker-selected', 'true'); } catch {}
      }

      showContextMenu(event.clientX, event.clientY, 'speaker-select');
      event.stopPropagation();
      return;
    }

    if (dialogueTextElement && dialogueBlockElement) {
      debugLog('[Editor] Clicked on dialogue text element:', dialogueTextElement);
      const speakerInBlock = dialogueBlockElement.querySelector('[data-type="speaker"]');
      if (speakerInBlock) {
        const speakerName = speakerInBlock.textContent?.trim() || '';
        setCurrentSpeakerName(speakerName);
        if (editAllSpeakers) {
          document.querySelectorAll('[data-type="speaker"]').forEach((el) => {
            if (el.textContent?.trim() === speakerName) {
              el.classList.add('speaker-selected');
            }
          });
        }
      }
      showContextMenu(event.clientX, event.clientY, 'text-formatting');
      event.stopPropagation();
      return;
    }

    if (cueBlockElement) {
      debugLog('[Editor] Clicked on cue block element:', cueBlockElement);
      cueBlockElement.classList.add('cue-selected');
      showContextMenu(event.clientX, event.clientY, 'cue-select');
      event.stopPropagation();
      return;
    }

    if (sceneBlockElement) {
      debugLog('[Editor] Clicked on scene block element:', sceneBlockElement);
      sceneBlockElement.classList.add('scene-selected');
      try {
        if (editor) {
          const anyEditor = editor as any;
          const view: any = anyEditor.view;
          const posInNode = view.posAtDOM(sceneBlockElement, 0);
          if (typeof posInNode === 'number' && posInNode >= 0) {
            editor.chain().setTextSelection(Math.min(posInNode + 1, editor.state.doc.content.size - 1)).run();
          }
        }
      } catch {}
      showContextMenu(event.clientX, event.clientY, 'scene-select');
      event.stopPropagation();
      return;
    }

    try {
      if (editor) {
        const { state } = editor;
        const { selection } = state;
        if (selection && !selection.empty) {
          const pos = selection.head;
          editor.chain().setTextSelection(pos).run();
        }

        if (!clickedInsideProseMirror) {
          editor.commands.blur();
          try {
            const anyEditor = editor as any;
            const { state: s, view } = anyEditor;
            let tr = s.tr;
            let changed = false;
            s.doc.descendants((node: any, position: number) => {
              if (node.type?.name === 'speaker' && node.attrs?.selected) {
                tr = tr.setNodeMarkup(position, undefined, { ...node.attrs, selected: false });
                changed = true;
              }
              return true;
            });
            if (changed) view.dispatch(tr);
          } catch {}
        }
      }
    } catch {}

    hideContextMenu();
    setEditAllSpeakers(false);
    setCurrentSpeakerName(null);
  }, [debugLog, editAllSpeakers, editor, hideContextMenu, liveRenameBaseRef, setCurrentSpeakerName, setEditAllSpeakers, showContextMenu]);
};
