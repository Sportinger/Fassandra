import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import type { SidebarCue, SidebarPanelState } from '../../../hooks/useSidebarData';

interface UseCueCardActionsProps {
  editor: Editor | null;
  sidebarPanel: SidebarPanelState;
  setSidebarPanel: React.Dispatch<React.SetStateAction<SidebarPanelState>>;
  setActiveCueId: (id: string | null) => void;
  setExpandedCueId: React.Dispatch<React.SetStateAction<string | null>>;
  setCueDescriptions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export const useCueCardActions = ({
  editor,
  sidebarPanel,
  setSidebarPanel,
  setActiveCueId,
  setExpandedCueId,
  setCueDescriptions,
}: UseCueCardActionsProps) => {
  const handleCueClick = useCallback(
    (cueId: string) => {
      const element = document.querySelector(`.cue-connection[data-cue-id="${cueId}"]`);
      if (element instanceof HTMLElement) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('hover-highlight');
        window.setTimeout(() => element.classList.remove('hover-highlight'), 800);
      }
      setActiveCueId(cueId);
      setExpandedCueId(prev => (prev === cueId ? null : cueId));
    },
    [setActiveCueId, setExpandedCueId],
  );

  const handleDescriptionChange = useCallback(
    (cueId: string, text: string) => {
      setCueDescriptions(prev => ({ ...prev, [cueId]: text }));
    },
    [setCueDescriptions],
  );

  const focusCueNameField = useCallback((cueId: string) => {
    window.setTimeout(() => {
      try {
        const element = document.querySelector(`.rs-cue-name[data-cue-id="${cueId}"]`) as HTMLElement | null;
        if (element) {
          element.focus();
          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      } catch {
        /* ignore focus errors */
      }
    }, 0);
  }, []);

  const toggleCueEditing = useCallback(
    (cue: SidebarCue) => {
      const isEditing = sidebarPanel?.type === 'cue' && sidebarPanel.cueId === cue.cueId;

      const tiptap = editor as any;

      if (isEditing) {
        try {
          const element = document.querySelector(`.rs-cue-name[data-cue-id="${cue.cueId}"]`) as HTMLElement | null;
          const newName = (element?.innerText || '').trim();
          tiptap?.commands.updateCueById?.(cue.cueId, { cueName: newName });
        } catch {
          /* ignore update errors */
        }
        setSidebarPanel(null);
        return;
      }

      setSidebarPanel({
        type: 'cue',
        cueId: cue.cueId,
        cueType: cue.cueType,
        cueNumber: cue.cueNumber,
        cueName: cue.cueName || '',
        draftName: cue.cueName || '',
      });
      focusCueNameField(cue.cueId);
    },
    [editor, focusCueNameField, setSidebarPanel, sidebarPanel],
  );

  const moveCueLink = useCallback(
    (cueId: string) => {
      (editor as any)?.commands.startCueExtend?.(cueId);
    },
    [editor],
  );

  const deleteCueConnection = useCallback(
    (cueId: string) => {
      (editor as any)?.commands.removeCueConnection?.(cueId);
      setSidebarPanel(null);
    },
    [editor, setSidebarPanel],
  );

  return {
    handleCueClick,
    handleDescriptionChange,
    toggleCueEditing,
    moveCueLink,
    deleteCueConnection,
  };
};
