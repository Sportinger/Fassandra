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
          // Save cueName
          const nameElement = document.querySelector(`.rs-cue-name[data-cue-id="${cue.cueId}"]`) as HTMLElement | null;
          const newName = (nameElement?.innerText || '').trim();

          // Save cueNumber
          const numberElement = document.querySelector(`.rs-card[data-cue-id="${cue.cueId}"] .rs-cue-number`) as HTMLElement | null;
          const newNumber = (numberElement?.innerText || '').replace('Q', '').trim();

          // DEBUG: Log what we're trying to save
          console.log('[CUE SAVE DEBUG] ================');
          console.log('[CUE SAVE DEBUG] cue.cueId:', cue.cueId);
          console.log('[CUE SAVE DEBUG] cue.cueNumber (old):', cue.cueNumber);
          console.log('[CUE SAVE DEBUG] newNumber:', newNumber);
          console.log('[CUE SAVE DEBUG] cue.cueName (old):', cue.cueName);
          console.log('[CUE SAVE DEBUG] newName:', newName);
          console.log('[CUE SAVE DEBUG] numberElement found:', !!numberElement);
          console.log('[CUE SAVE DEBUG] nameElement found:', !!nameElement);
          console.log('[CUE SAVE DEBUG] editor available:', !!tiptap);
          console.log('[CUE SAVE DEBUG] updateCueByIdWithNumber available:', !!tiptap?.commands?.updateCueByIdWithNumber);
          console.log('[CUE SAVE DEBUG] updateCueById available:', !!tiptap?.commands?.updateCueById);

          // Check what changed - compare against the original values
          // For number, compare against customNumber if it exists, otherwise cueNumber
          const originalNumber = cue.customNumber || cue.cueNumber;
          const numberChanged = newNumber && newNumber !== originalNumber;
          const nameChanged = newName !== (cue.cueName || '');

          console.log('[CUE SAVE DEBUG] originalNumber:', originalNumber);
          console.log('[CUE SAVE DEBUG] numberChanged:', numberChanged);
          console.log('[CUE SAVE DEBUG] nameChanged:', nameChanged);

          // Update custom number if changed
          // This sets manualNumber: true and stores in customNumber field
          if (numberChanged) {
            console.log('[CUE SAVE DEBUG] Calling updateCueByIdWithNumber with customNumber...');
            const result1 = tiptap?.commands.updateCueByIdWithNumber?.(cue.cueId, newNumber);
            console.log('[CUE SAVE DEBUG] updateCueByIdWithNumber result:', result1);
          } else {
            console.log('[CUE SAVE DEBUG] Skipping number update (no change or empty)');
          }

          // Update cueName if changed
          if (nameChanged) {
            console.log('[CUE SAVE DEBUG] Calling updateCueById for name...');
            const result2 = tiptap?.commands.updateCueById?.(cue.cueId, {
              cueName: newName,
            });
            console.log('[CUE SAVE DEBUG] updateCueById result:', result2);
          } else {
            console.log('[CUE SAVE DEBUG] Skipping name update (no changes)');
          }
          console.log('[CUE SAVE DEBUG] ================');
        } catch (err) {
          console.error('[CUE SAVE DEBUG] Error:', err);
        }
        setSidebarPanel(null);
        return;
      }

      // Expand the cue details when entering edit mode
      setExpandedCueId(cue.cueId);

      setSidebarPanel({
        type: 'cue',
        cueId: cue.cueId,
        cueType: cue.cueType,
        cueNumber: cue.cueNumber,
        cueName: cue.cueName || '',
        draftName: cue.cueName || '',
        manualNumber: cue.manualNumber,
        customNumber: cue.customNumber,
      });
      focusCueNameField(cue.cueId);
    },
    [editor, focusCueNameField, setSidebarPanel, sidebarPanel, setExpandedCueId],
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
