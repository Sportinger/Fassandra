import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Editor } from '@tiptap/react';

type SpeakerSelectionState = {
  editAllSpeakers: boolean;
  setEditAllSpeakers: Dispatch<SetStateAction<boolean>>;
  currentSpeakerName: string | null;
  setCurrentSpeakerName: Dispatch<SetStateAction<string | null>>;
  liveRenameBaseRef: MutableRefObject<string | null>;
  isLiveRenamingRef: MutableRefObject<boolean>;
};

export const useSpeakerSelection = (editor: Editor | null): SpeakerSelectionState => {
  const [editAllSpeakers, setEditAllSpeakers] = useState(false);
  const [currentSpeakerName, setCurrentSpeakerName] = useState<string | null>(null);
  const liveRenameBaseRef = useRef<string | null>(null);
  const isLiveRenamingRef = useRef(false);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('[data-type="speaker"]')) as HTMLElement[];
    if (editAllSpeakers && currentSpeakerName) {
      liveRenameBaseRef.current = currentSpeakerName;
      elements.forEach((el) => {
        const isMatch = (el.textContent || '').trim() === currentSpeakerName;
        if (isMatch) {
          el.classList.add('speaker-selected');
          try { el.setAttribute('data-same-speaker', 'true'); } catch {}
        } else {
          el.classList.remove('speaker-selected');
          try { el.removeAttribute('data-same-speaker'); } catch {}
        }
      });
    } else {
      liveRenameBaseRef.current = null;
      elements.forEach((el) => {
        const keepExplicit = el.getAttribute('data-speaker-selected') === 'true';
        if (!keepExplicit) {
          el.classList.remove('speaker-selected');
        }
        try { el.removeAttribute('data-same-speaker'); } catch {}
      });
    }
  }, [editAllSpeakers, currentSpeakerName]);

  useEffect(() => {
    if (!editor) return undefined;

    const handleUpdate = () => {
      if (!editAllSpeakers) return;
      const base = liveRenameBaseRef.current;
      if (!base || !base.trim()) return;
      if (isLiveRenamingRef.current) return;

      const { state, view } = editor as any;
      let selectedPos: number | null = null;
      let selectedNode: any = null;

      state.doc.descendants((node: any, position: number) => {
        if (node.type?.name === 'speaker' && node.attrs?.selected) {
          selectedPos = position;
          selectedNode = node;
          return false;
        }
        return true;
      });

      if (selectedPos === null) {
        const $from = state.selection?.$from;
        if ($from) {
          for (let depth = $from.depth; depth >= 0; depth -= 1) {
            const node = $from.node(depth);
            if (node?.type?.name === 'speaker') {
              selectedNode = node;
              selectedPos = $from.before(depth);
              break;
            }
          }
        }
      }

      if (selectedPos === null || !selectedNode) return;
      const newName = (selectedNode.textContent || '').trim();
      if (!newName || newName === base) return;

      isLiveRenamingRef.current = true;
      try {
        let tr = state.tr;
        let changed = false;
        state.doc.descendants((node: any, pos: number) => {
          if (node.type?.name === 'speaker' && node.textContent?.trim() === base) {
            const from = pos + 1;
            const to = from + node.content.size;
            tr = tr.replaceRangeWith(from, to, state.schema.text(newName));
            changed = true;
          }
          return true;
        });
        if (changed) view.dispatch(tr);
        liveRenameBaseRef.current = newName;
        setCurrentSpeakerName(newName);
      } finally {
        setTimeout(() => { isLiveRenamingRef.current = false; }, 0);
      }
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, editAllSpeakers]);

  return {
    editAllSpeakers,
    setEditAllSpeakers,
    currentSpeakerName,
    setCurrentSpeakerName,
    liveRenameBaseRef,
    isLiveRenamingRef,
  };
};
