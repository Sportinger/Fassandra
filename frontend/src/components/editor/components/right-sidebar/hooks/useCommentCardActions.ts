import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import type { SidebarPanelState } from '../../../hooks/useSidebarData';

interface UseCommentCardActionsProps {
  editor: Editor | null;
  setActiveCommentId: (id: string | null) => void;
  sidebarPanel: SidebarPanelState;
  setSidebarPanel: React.Dispatch<React.SetStateAction<SidebarPanelState>>;
}

export const useCommentCardActions = ({
  editor,
  setActiveCommentId,
  sidebarPanel,
  setSidebarPanel,
}: UseCommentCardActionsProps) => {
  const toggleCommentHighlight = useCallback((commentId: string, highlight: boolean) => {
    document
      .querySelectorAll(`.comment-annotation[data-comment-id="${commentId}"]`)
      .forEach(element => {
        if (highlight) {
          element.classList.add('connected-highlight');
        } else {
          element.classList.remove('connected-highlight');
        }
      });
  }, []);

  const focusComment = useCallback(
    (commentId: string) => {
      const element = document.querySelector(`.comment-annotation[data-comment-id="${commentId}"]`) as
        | HTMLElement
        | null;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('connected-highlight');
        window.setTimeout(() => element.classList.remove('connected-highlight'), 800);
      }
      setActiveCommentId(commentId);
    },
    [setActiveCommentId],
  );

  const toggleCommentEditing = useCallback(
    (commentId: string, currentText: string | undefined) => {
      setSidebarPanel(prev =>
        prev && prev.type === 'comment' && prev.id === commentId
          ? null
          : { type: 'comment', id: commentId, draft: currentText ?? '' },
      );
    },
    [setSidebarPanel],
  );

  const saveComment = useCallback(
    (commentId: string, draft: string) => {
      (editor as any)?.commands.updateCommentById?.(commentId, { commentText: draft });
      setSidebarPanel(null);
    },
    [editor, setSidebarPanel],
  );

  const deleteComment = useCallback(
    (commentId: string) => {
      (editor as any)?.commands.removeCommentById?.(commentId);
      setSidebarPanel(null);
    },
    [editor, setSidebarPanel],
  );

  const isEditingComment = useCallback(
    (commentId: string) => sidebarPanel?.type === 'comment' && sidebarPanel.id === commentId,
    [sidebarPanel],
  );

  return {
    toggleCommentHighlight,
    focusComment,
    toggleCommentEditing,
    saveComment,
    deleteComment,
    isEditingComment,
  };
};
