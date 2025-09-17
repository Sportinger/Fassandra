import { useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import type { ViewMode } from '../types';

interface BorderlessSpeakerOptions {
  editor: Editor | null;
  viewMode: ViewMode;
  setCurrentSpeakerName: (name: string | null) => void;
  showContextMenu: (x: number, y: number, context: any) => void;
}

export const useBorderlessSpeakerInteractions = ({
  editor,
  viewMode,
  setCurrentSpeakerName,
  showContextMenu,
}: BorderlessSpeakerOptions) => {
  useEffect(() => {
    if (!editor || viewMode !== 'borderless') return undefined;
    const root: HTMLElement = (editor as any).options.element as HTMLElement;
    if (!root) return undefined;

    const onClick = (evt: MouseEvent) => {
      const target = evt.target as HTMLElement | null;
      if (!target) return;
      const speakerEl = target.closest('[data-type="speaker"]') as HTMLElement | null;
      if (speakerEl) {
        try { setCurrentSpeakerName((speakerEl.textContent || '').trim()); } catch {}
        try {
          const view: any = (editor as any).view;
          const { state } = editor as any;
          let targetPos: number | null = null;
          state.doc.descendants((node: any, position: number) => {
            if (node.type?.name === 'speaker') {
              const domForNode = view.nodeDOM(position) as HTMLElement | null;
              if (domForNode && (domForNode === speakerEl || domForNode.contains(speakerEl))) {
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
              const end = targetPos + 1 + (nodeAt.content?.size || 0);
              try { (editor as any).chain().setTextSelection(end).focus().run(); } catch {}
            }
          }
        } catch {}
        showContextMenu(evt.clientX, evt.clientY, 'speaker-select');
        evt.stopPropagation();
      }
    };

    root.addEventListener('click', onClick, true);
    return () => {
      root.removeEventListener('click', onClick, true);
    };
  }, [editor, viewMode, setCurrentSpeakerName, showContextMenu]);
};
