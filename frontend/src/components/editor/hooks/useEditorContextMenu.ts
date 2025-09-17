import { useCallback, useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction, type MouseEvent as ReactMouseEvent } from 'react';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import type { ViewMode } from '../types';
import type {
  CloseContextMenu,
  ContextMenuAction,
  ContextMenuState,
  InsertSubmenuState,
} from '../components/context-menu/contextMenuTypes';

type WordRect = { left: number; top: number; width: number; height: number };

type UseEditorContextMenuOptions = {
  editor: Editor | null;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
  rehearsalMode: boolean;
  rehearsalLinePosition: number;
  debugLog: (...args: any[]) => void;
  setSuppressRehearsalAutoScroll: (value: boolean) => void;
  setShouldCenterOnRehearsalChange: (value: boolean) => void;
  pendingCenterRef: MutableRefObject<boolean>;
  setRehearsalLinePosition: (value: number) => void;
  setRehearsalDocPos: (value: number | null) => void;
  setRehearsalWordBox: (box: WordRect | null) => void;
  broadcastRehearsalState: (payload: Record<string, unknown>) => void;
};

type UseEditorContextMenuReturn = {
  contextMenu: ContextMenuState;
  insertSubmenu: InsertSubmenuState;
  handleContextMenu: (event: ReactMouseEvent) => void;
  handleContextMenuAction: (action: ContextMenuAction) => void;
  openInsertSubmenu: (rect: DOMRect) => void;
  closeInsertSubmenu: () => void;
  closeContextMenu: CloseContextMenu;
};

const INITIAL_CONTEXT_MENU: ContextMenuState = {
  x: 0,
  y: 0,
  visible: false,
  onSpeakerName: false,
  onPageBackground: false,
};

const INITIAL_INSERT_SUBMENU: InsertSubmenuState = { open: false, x: 0, y: 0 };

export const useEditorContextMenu = ({
  editor,
  setViewMode,
  rehearsalMode,
  rehearsalLinePosition,
  debugLog,
  setSuppressRehearsalAutoScroll,
  setShouldCenterOnRehearsalChange,
  pendingCenterRef,
  setRehearsalLinePosition,
  setRehearsalDocPos,
  setRehearsalWordBox,
  broadcastRehearsalState,
}: UseEditorContextMenuOptions): UseEditorContextMenuReturn => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(INITIAL_CONTEXT_MENU);
  const [insertSubmenu, setInsertSubmenu] = useState<InsertSubmenuState>(INITIAL_INSERT_SUBMENU);

  const closeInsertSubmenu = useCallback(() => {
    setInsertSubmenu(INITIAL_INSERT_SUBMENU);
  }, []);

  const closeContextMenu: CloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    setSuppressRehearsalAutoScroll(false);
    setShouldCenterOnRehearsalChange(false);
    pendingCenterRef.current = false;
    closeInsertSubmenu();
  }, [closeInsertSubmenu, pendingCenterRef, setShouldCenterOnRehearsalChange, setSuppressRehearsalAutoScroll]);

  const openInsertSubmenu = useCallback((rect: DOMRect) => {
    setInsertSubmenu({ open: true, x: rect.right + 4, y: rect.top });
  }, []);

  const handleContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const speakerElement = target.closest('[data-type="speaker"]');

    if (rehearsalMode) {
      const containerElement = target.closest('.singlePageContainer') || target.closest('.multiplePagesContainer');
      if (containerElement) {
        const containerRect = (containerElement as HTMLElement).getBoundingClientRect();
        const containerScrollTop = (containerElement as HTMLElement).scrollTop || 0;
        const clickY = e.clientY - containerRect.top + containerScrollTop;
        let docPos: number | undefined;
        try {
          if (editor) {
            const view: any = (editor as any).view;
            if (view && typeof view.posAtCoords === 'function') {
              const res = view.posAtCoords({ left: e.clientX, top: e.clientY });
              if (res && typeof res.pos === 'number') {
                docPos = res.pos;
              }
            }
          }
        } catch {}

        let hasWordTarget = false;
        let wordLineY: number | undefined;
        let wordDocPos: number | undefined;
        let computedWordRect: WordRect | undefined;
        try {
          let caretRange: Range | null = null;
          const anyDoc: any = document as any;
          if (typeof (document as any).caretRangeFromPoint === 'function') {
            caretRange = (document as any).caretRangeFromPoint(e.clientX, e.clientY);
          } else if (typeof anyDoc.caretPositionFromPoint === 'function') {
            const cp = anyDoc.caretPositionFromPoint(e.clientX, e.clientY);
            if (cp && cp.offsetNode) {
              caretRange = document.createRange();
              caretRange.setStart(cp.offsetNode, cp.offset);
              caretRange.collapse(true);
            }
          }
          if (caretRange && caretRange.startContainer && caretRange.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = caretRange.startContainer as Text;
            const data = textNode.data || '';
            const offset = Math.min(Math.max(caretRange.startOffset || 0, 0), data.length);
            const isWordChar = (ch: string) => /[\p{L}\p{N}'’_-]/u.test(ch);
            let start = offset;
            while (start > 0 && isWordChar(data.charAt(start - 1))) start -= 1;
            let end = offset;
            while (end < data.length && isWordChar(data.charAt(end))) end += 1;
            if (end > start) {
              const wordRange = document.createRange();
              wordRange.setStart(textNode, start);
              wordRange.setEnd(textNode, end);
              const rect = wordRange.getBoundingClientRect();
              if (rect && rect.width >= 0 && rect.height >= 0) {
                hasWordTarget = true;
                const containerScrollLeft = (containerElement as any).scrollLeft || 0;
                wordLineY = rect.bottom - containerRect.top + containerScrollTop;
                computedWordRect = {
                  left: rect.left - containerRect.left + containerScrollLeft,
                  top: rect.top - containerRect.top + containerScrollTop,
                  width: rect.width,
                  height: rect.height,
                };
                try {
                  const midX = rect.left + rect.width / 2;
                  const midY = rect.top + rect.height / 2;
                  const view: any = (editor as any)?.view;
                  if (view && typeof view.posAtCoords === 'function') {
                    const res = view.posAtCoords({ left: midX, top: midY });
                    if (res && typeof res.pos === 'number') {
                      wordDocPos = res.pos;
                    }
                  }
                } catch {}
              }
            }
          }
        } catch {}

        debugLog('[Rehearsal Click] Container height:', (containerElement as HTMLElement).scrollHeight, 'Click Y:', clickY, 'ScrollTop:', containerScrollTop);
        setSuppressRehearsalAutoScroll(true);
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          visible: true,
          onSpeakerName: !!speakerElement,
          onPageBackground: !speakerElement,
          rehearsalClickY: clickY,
          rehearsalDocPos: typeof wordDocPos === 'number' ? wordDocPos : docPos,
          hasWordTarget,
          wordLineY,
          wordRect: computedWordRect,
        });
        return;
      }
    }

    setSuppressRehearsalAutoScroll(true);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
      onSpeakerName: !!speakerElement,
      onPageBackground: !speakerElement,
    });
  }, [debugLog, editor, rehearsalMode, setSuppressRehearsalAutoScroll]);

  const handleContextMenuAction = useCallback((action: ContextMenuAction) => {
    if (!editor) return;

    switch (action) {
      case 'insert-paragraph': {
        try {
          const { state, view } = editor;
          const { $from } = state.selection;
          const insertPos = $from.after($from.depth);
          const paragraph = state.schema.nodes.paragraph.create();
          const tr = state.tr
            .insert(insertPos, paragraph)
            .setSelection(TextSelection.near(state.doc.resolve(Math.min(insertPos + 1, state.doc.content.size - 1))));
          view.dispatch(tr);
        } catch {
          editor.chain().focus().insertContent({ type: 'paragraph' }).run();
        }
        break;
      }
      case 'add-comment': {
        const { state } = editor;
        const sel = state.selection;
        if (sel.empty) break;
        const id = `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        (editor as any).chain().focus().addComment({ commentId: id, commentText: '' }).run();
        const evt = new CustomEvent('fassandra:open-comment', { detail: { commentId: id, commentText: '' } });
        window.dispatchEvent(evt);
        break;
      }
      case 'insert-dialogue':
        debugLog('Inserting dialogue block from context menu');
        editor.chain().focus().insertDialogueBlock().run();
        break;
      case 'insert-scene':
        editor.chain().focus().insertSceneBlock().run();
        break;
      case 'toggle-view':
        setViewMode(prev => (prev === 'single-page' ? 'borderless' : 'single-page'));
        break;
      case 'jump': {
        const { wordLineY, hasWordTarget, rehearsalDocPos, wordRect } = contextMenu;
        if (hasWordTarget && typeof wordLineY === 'number') {
          let jumpedDocPos: number | undefined;
          try {
            if (typeof rehearsalDocPos === 'number') {
              setRehearsalDocPos(rehearsalDocPos);
              jumpedDocPos = rehearsalDocPos;
            }
          } catch {}
          const changed = Math.abs(wordLineY - rehearsalLinePosition) > 0.5;
          if (changed) {
            debugLog('[Jump Action] Setting rehearsal line position to:', wordLineY);
            setRehearsalLinePosition(wordLineY);
            if (wordRect) {
              setRehearsalWordBox(wordRect);
            } else {
              setRehearsalWordBox(null);
            }
            const payload: Record<string, unknown> = { rehearsalLinePosition: wordLineY };
            if (typeof jumpedDocPos === 'number') payload.rehearsalDocPos = jumpedDocPos;
            if (wordRect) payload.rehearsalWordRect = wordRect;
            broadcastRehearsalState(payload);
            pendingCenterRef.current = true;
            setSuppressRehearsalAutoScroll(false);
            setShouldCenterOnRehearsalChange(false);
          }
        }
        break;
      }
      case 'format-speakers':
      case 'change-speaker-color':
        debugLog('Unknown context menu action:', action);
        break;
      default:
        debugLog('Unknown context menu action:', action);
        break;
    }

    closeContextMenu();
  }, [broadcastRehearsalState, closeContextMenu, contextMenu, debugLog, editor, pendingCenterRef, rehearsalLinePosition, setRehearsalDocPos, setRehearsalLinePosition, setRehearsalWordBox, setSuppressRehearsalAutoScroll, setShouldCenterOnRehearsalChange, setViewMode]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        closeContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [closeContextMenu, contextMenu.visible]);

  return {
    contextMenu,
    insertSubmenu,
    handleContextMenu,
    handleContextMenuAction,
    openInsertSubmenu,
    closeInsertSubmenu,
    closeContextMenu,
  };
};
