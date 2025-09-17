import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../../../AuthContext';
import { Header } from '../../Header';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { useEditorCore } from '../hooks/useEditorCore';
import { useSidebarData } from '../hooks/useSidebarData';
import { useRehearsalMode } from '../hooks/useRehearsalMode';
import { Toolbar } from './toolbar/Toolbar';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { SinglePageView, BorderlessView } from '../ViewModes';
import { FloatingCuesLayer } from './FloatingCuesLayer';
import { CueConnectors } from './CueConnectors';
import { FloatingCommentsLayer } from './FloatingCommentsLayer';
import RulerOverlay from './RulerOverlay';
import { MessageSquareQuoteIcon } from '../icons';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorProps, ViewMode } from '../types';
import { EditorContent } from './EditorContent';
import { EditorShell } from './EditorShell';
import { RightSidebar } from './RightSidebar';

import logger from '../../../services/LoggingService';
import '../styles/variables.css';
import '../styles/responsive.css';
import '../styles/toolbar.css';
import '../styles/cue-blocks.css';
import '../styles/scene-blocks.css';
// Removed page-indicator styles (page breaks deprecated)
import '../styles/search.css';
import '../styles/cue-connections.css';
import '../styles/rehearsal-line.css';
import '../styles/floating-cues.css';
import '../styles/ruler-overlay.css';
import '../styles/comments.css';
import '../styles/print.css';
import '../styles/right-sidebar.css';
import { CUE_TYPE_ICONS } from '../../../types/cue';
import type { CueType } from '../../../types/cue';
/**
 * Main Editor Component
 * Orchestrates all editor sub-systems with responsive design
 */

// Import the consolidated styles
export const Editor: React.FC<EditorProps> = ({ 
  scriptId, 
  initialTitle, 
  onNavigateBack 
}) => {
  // 🔧 CRITICAL FIX: ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const { token, user, tokenReady } = useAuth();
  const { config, isMobile } = useResponsiveDesign();

  // 🔧 FIXED: Reduce debug logging to prevent console spam
  const debugLog = useMemo(() => {
    return process.env.NODE_ENV === 'development' ? console.log : () => {};
  }, []);
  
  // Initialize editor core with Fassandra's existing infrastructure
  const {
    editor,
    ydoc,
    provider,
    connectionStatus,
    errorMessage,
    availableSpeakers,
    contextMenu,
    toolbarContext,
    showContextMenu,
    hideContextMenu,
    activeUserCount,
    isYjsSynced,
  } = useEditorCore({
    scriptId,
    user,
    hasToken: !!token,
  });
  
  // Local UI state
  const [viewMode, setViewMode] = useState<ViewMode>('single-page');
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pageCount, setPageCount] = useState<number>(1);
  const [showRuler, setShowRuler] = useState(false);
  const {
    rehearsalMode,
    setRehearsalMode,
    rehearsalLinePosition,
    setRehearsalLinePosition,
    rehearsalDocPos,
    setRehearsalDocPos,
    rehearsalWordBox,
    setRehearsalWordBox,
    suppressRehearsalAutoScroll,
    setSuppressRehearsalAutoScroll,
    setShouldCenterOnRehearsalChange,
    pendingCenterRef,
    isApplyingRemoteRehearsalRef,
    autoFollowActive,
    lastAsrText,
    startAutoFollow,
    stopAutoFollow,
    broadcastRehearsalState,
    adoptRemotePosition,
  } = useRehearsalMode({
    editor,
    provider,
    scriptId,
    token: token || null,
    viewMode,
    debugLog,
  });
  const [editAllSpeakers, setEditAllSpeakers] = useState(false);
  const [currentSpeakerName, setCurrentSpeakerName] = useState<string | null>(null);
  const liveRenameBaseRef = useRef<string | null>(null);
  const isLiveRenamingRef = useRef<boolean>(false);
  const [rulerOverlayActive, setRulerOverlayActive] = useState(false);
  const [insertSubmenu, setInsertSubmenu] = useState<{open:boolean;x:number;y:number}>({ open: false, x: 0, y: 0 });
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  // Sidebar collections and UI state
  const {
    sidebarScenes,
    sidebarCues,
    sidebarComments,
    sidebarTab,
    setSidebarTab,
    cuesCollapsed,
    setCuesCollapsed,
    commentsCollapsed,
    setCommentsCollapsed,
    cueFilters,
    setCueFilters,
    activeSidebarSceneId,
    setActiveSidebarSceneId,
    activeSidebarCueId,
    setActiveSidebarCueId,
    expandedCueId,
    setExpandedCueId,
    activeSidebarCommentId,
    setActiveSidebarCommentId,
    cueDescriptions,
    setCueDescriptions,
    sidebarPanel,
    setSidebarPanel,
  } = useSidebarData(editor);

  const handleCueOpen = useCallback((payload: { cueId: string }) => {
    try {
      const el = document.querySelector(`.cue-connection[data-cue-id="${payload.cueId}"]`);
      if (el) {
        (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement).classList.add('hover-highlight');
        setTimeout(() => (el as HTMLElement).classList.remove('hover-highlight'), 800);
      }
    } catch {}
    setRightSidebarOpen(true);
    setSidebarTab('cues');
    setCuesCollapsed(false);
    setActiveSidebarCueId(payload.cueId);
    setSidebarPanel(null);
    setTimeout(() => {
      const container = document.querySelector('.rightSidebar .rightSidebarInner') as HTMLElement | null;
      const card = document.querySelector(`.rightSidebar [data-cue-id="${payload.cueId}"]`) as HTMLElement | null;
      if (container && card) card.scrollIntoView({ block: 'nearest' });
    }, 50);
  }, [setRightSidebarOpen, setCuesCollapsed, setActiveSidebarCueId, setSidebarPanel]);

  const handleCommentOpen = useCallback(({ id }: { id: string; text: string }) => {
    try {
      const el = document.querySelector(`.comment-annotation[data-comment-id="${id}"]`);
      if (el) {
        (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement).classList.add('connected-highlight');
        setTimeout(() => (el as HTMLElement).classList.remove('connected-highlight'), 800);
      }
    } catch {}
    setRightSidebarOpen(true);
    setSidebarTab('comments');
    setCommentsCollapsed(false);
    setActiveSidebarCommentId(id);
    setSidebarPanel(null);
    setTimeout(() => {
      const container = document.querySelector('.rightSidebar .rightSidebarInner') as HTMLElement | null;
      const card = document.querySelector(`.rightSidebar [data-comment-id="${id}"]`) as HTMLElement | null;
      if (container && card) card.scrollIntoView({ block: 'nearest' });
    }, 50);
  }, [setRightSidebarOpen, setCommentsCollapsed, setActiveSidebarCommentId, setSidebarPanel]);

  // Collapse expanded cue panel when clicking outside the sidebar
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const currentId = expandedCueId;
      if (!currentId) return;

      // If we're actively editing this cue, keep it visible
      if (sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === currentId) {
        return;
      }

      const card = document.querySelector(`.rightSidebar [data-cue-id="${currentId}"]`);
      const target = e.target as Node | null;
      if (card && target && !card.contains(target)) {
        setExpandedCueId(null);
      }
    };
    document.addEventListener('click', handleDocClick, true);
    return () => document.removeEventListener('click', handleDocClick, true);
  }, [expandedCueId, sidebarPanel]);

  // In borderless view, ensure clicking a speaker bubble opens the speaker toolbar
  useEffect(() => {
    if (!editor || viewMode !== 'borderless') return;
    const root: HTMLElement = (editor as any).options.element as HTMLElement;
    if (!root) return;
    const onClick = (evt: MouseEvent) => {
      const target = evt.target as HTMLElement | null;
      if (!target) return;
      const speakerEl = target.closest('[data-type="speaker"]') as HTMLElement | null;
      if (speakerEl) {
        try { setCurrentSpeakerName((speakerEl.textContent || '').trim()); } catch {}
        // Persist selection on the underlying speaker node and place caret at end
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
    return () => { root.removeEventListener('click', onClick, true); };
  }, [editor, viewMode, showContextMenu]);
  
  // Removed demo mode state - development utility
  // Removed demo-related state - development utility
  const [localContextMenu, setLocalContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    onSpeakerName: boolean;
    onPageBackground: boolean;
    rehearsalClickY?: number;
    rehearsalDocPos?: number;
    hasWordTarget?: boolean;
    wordLineY?: number;
    wordRect?: { left: number; top: number; width: number; height: number };
  }>({
    x: 0,
    y: 0,
    visible: false,
    onSpeakerName: false,
    onPageBackground: false,
  });




  // Debug ruler state
  useEffect(() => {
    debugLog('[Editor] showRuler state changed:', showRuler);
  }, [showRuler, debugLog]);
  
  // Debug view mode changes
  useEffect(() => {
    debugLog('[Editor] viewMode changed to:', viewMode);
  }, [viewMode, debugLog]);

  // Compute page count from TipTap pageIndicator nodes
  useEffect(() => {
    if (!editor) return;
    const recompute = () => {
      try {
        let count = 0;
        editor.state.doc.descendants((node: any) => {
          if (node.type && node.type.name === 'pageIndicator') count += 1;
        });
        if (count === 0) count = 1;
        setPageCount(count);
      } catch {}
    };
    recompute();
    editor.on('update', recompute);
    return () => { editor.off('update', recompute); };
  }, [editor]);

  // Compute current page from TipTap document by counting pageIndicator nodes before selection
  useEffect(() => {
    if (!editor) return;
    const recompute = () => {
      try {
        let current = 1;
        let passed = 0;
        const selPos = editor.state?.selection?.from ?? 0;
        editor.state.doc.descendants((node: any, pos: number) => {
          if (node.type && node.type.name === 'pageIndicator') {
            passed += 1;
            if (pos < selPos) current = passed;
          }
        });
        setPageNumber(current);
      } catch {}
    };
    recompute();
    editor.on('update', recompute);
    return () => { editor.off('update', recompute); };
  }, [editor]);

  // Highlight all speakers when editAllSpeakers mode changes
  useEffect(() => {
    const all = Array.from(document.querySelectorAll('[data-type="speaker"]')) as HTMLElement[];
    if (editAllSpeakers && currentSpeakerName) {
      // Initialize live-rename baseline to the current selected name
      liveRenameBaseRef.current = currentSpeakerName;
      // Highlight all speakers with the same name (non-editable marking)
      all.forEach((el) => {
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
      // Remove multi-selection highlighting from all except the one explicitly selected via node attr
      all.forEach((el) => {
        // Keep explicit selected ones (editable), remove multi-select markings
        const keepExplicit = el.getAttribute('data-speaker-selected') === 'true';
        if (!keepExplicit) {
          el.classList.remove('speaker-selected');
        }
        try { el.removeAttribute('data-same-speaker'); } catch {}
      });
    }
  }, [editAllSpeakers, currentSpeakerName]);

  // Live rename: when edit-all is ON, propagate changes to all matching speakers
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      if (!editAllSpeakers) return;
      const base = liveRenameBaseRef.current;
      if (!base || !base.trim()) return;
      if (isLiveRenamingRef.current) return;

      const { state, view } = editor as any;
      // Find the currently selected speaker node (by attribute or selection)
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
      // Fallback to selection path
      if (selectedPos === null) {
        const $from = state.selection?.$from;
        if ($from) {
          for (let depth = $from.depth; depth >= 0; depth--) {
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

      // Update all speakers whose text equals the base
      isLiveRenamingRef.current = true;
      try {
        let tr = state.tr;
        let changed = false;
        state.doc.descendants((node: any, pos: number) => {
          if (node.type?.name === 'speaker' && node.textContent?.trim() === base) {
            // Replace content
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
    return () => { editor.off('update', handleUpdate); };
  }, [editor, editAllSpeakers]);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    // Check if clicked on speaker name
    const target = e.target as HTMLElement;
    const speakerElement = target.closest('[data-type="speaker"]');
    
    // Store the click position for rehearsal mode jump
    if (rehearsalMode) {
      // Find the container that holds all pages
      const containerElement = target.closest('.singlePageContainer') || target.closest('.multiplePagesContainer');
      if (containerElement) {
        const containerRect = containerElement.getBoundingClientRect();
        const containerScrollTop = containerElement.scrollTop || 0;
        const clickY = e.clientY - containerRect.top + containerScrollTop;
        // Map the click to a precise ProseMirror document position
        let docPos: number | undefined;
        try {
          if (editor) {
            const view: any = (editor as any).view;
            if (view && typeof view.posAtCoords === 'function') {
              const coords = { left: e.clientX, top: e.clientY } as any;
              const res = view.posAtCoords(coords);
              if (res && typeof res.pos === 'number') {
                docPos = res.pos;
              }
            }
          }
        } catch {}
        // Determine if the right-click is on a word box and compute its bottom Y
        let hasWordTarget = false;
        let wordLineY: number | undefined = undefined;
        let wordDocPos: number | undefined = undefined;
        try {
          // Use caret range at click to find the word boundaries
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
            // Expand to word boundaries (letters, numbers, apostrophes, umlauts)
            const isWordChar = (ch: string) => /[\p{L}\p{N}'’_-]/u.test(ch);
            let start = offset;
            while (start > 0 && isWordChar(data.charAt(start - 1))) start--;
            let end = offset;
            while (end < data.length && isWordChar(data.charAt(end))) end++;
            if (end > start) {
              // Compute bounding rect for the word segment
              const wordRange = document.createRange();
              wordRange.setStart(textNode, start);
              wordRange.setEnd(textNode, end);
              const rect = wordRange.getBoundingClientRect();
              if (rect && rect.width >= 0 && rect.height >= 0) {
                hasWordTarget = true;
                wordLineY = rect.bottom - containerRect.top + containerScrollTop;
                // Compute word rectangle relative to container
                const containerScrollLeft = (containerElement as any).scrollLeft || 0;
                const wordTop = rect.top - containerRect.top + containerScrollTop;
                const wordLeft = rect.left - containerRect.left + containerScrollLeft;
                const wordWidth = rect.width;
                const wordHeight = rect.height;
                var computedWordRect = { left: wordLeft, top: wordTop, width: wordWidth, height: wordHeight };
                // Derive a doc position from the middle of the word box for better accuracy
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
        
        debugLog('[Rehearsal Click] Container height:', containerElement.scrollHeight, 'Click Y:', clickY, 'ScrollTop:', containerScrollTop);
        
        // Suppress auto-scroll until user chooses an action
        setSuppressRehearsalAutoScroll(true);
        // Store the position for later use
        setLocalContextMenu({
          x: e.clientX,
          y: e.clientY,
          visible: true,
          onSpeakerName: !!speakerElement,
          onPageBackground: !speakerElement,
          rehearsalClickY: clickY, // fallback Position in container coordinates
          rehearsalDocPos: typeof wordDocPos === 'number' ? wordDocPos : docPos,
          hasWordTarget,
          wordLineY,
          wordRect: (typeof computedWordRect !== 'undefined') ? computedWordRect : undefined,
        });
        return;
      }
    }
    
    setSuppressRehearsalAutoScroll(true);
    setLocalContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
      onSpeakerName: !!speakerElement,
      onPageBackground: !speakerElement,
    });
  }, [rehearsalMode]);

  // Handle context menu actions
  const handleContextMenuAction = useCallback((action: string) => {
    if (!editor) return;
    
    switch (action) {
      case 'insert-paragraph': {
        try {
          const { state, view } = editor;
          const { $from } = state.selection;
          // Insert a new empty paragraph AFTER the current block (like scene/speaker handlers)
          const insertPos = $from.after($from.depth);
          const paragraph = state.schema.nodes.paragraph.create();
          const tr = state.tr
            .insert(insertPos, paragraph)
            .setSelection(TextSelection.near(state.doc.resolve(Math.min(insertPos + 1, state.doc.content.size - 1))));
          view.dispatch(tr);
        } catch {
          // Fallback to simple insert at cursor
          editor.chain().focus().insertContent({ type: 'paragraph' }).run();
        }
        break;
      }
      case 'add-comment': {
        const { state } = editor;
        const sel = state.selection;
        if (sel.empty) break;
        const id = `cmt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        (editor as any).chain().focus().addComment({ commentId: id, commentText: '' }).run();
        // open the comment popover for this id
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
      case 'jump':
        if (localContextMenu.hasWordTarget && typeof localContextMenu.wordLineY === 'number') {
          // Prefer precise mapping via ProseMirror doc position if available
          let newPosition = localContextMenu.wordLineY;
          let jumpedDocPos: number | undefined = undefined;
          try {
            if (editor && typeof localContextMenu.rehearsalDocPos === 'number') {
              const pos = localContextMenu.rehearsalDocPos;
              setRehearsalDocPos(pos);
              jumpedDocPos = pos;
            }
          } catch {}

          // Only proceed if the position actually changes
          const changed = Math.abs(newPosition - rehearsalLinePosition) > 0.5;
          if (!changed) {
            debugLog('[Jump Action] Ignored — position unchanged:', newPosition);
            break;
          }

          debugLog('[Jump Action] Setting rehearsal line position to:', newPosition);
          setRehearsalLinePosition(newPosition);
          // Set word box from localContextMenu if available
          if (localContextMenu.wordRect) {
            setRehearsalWordBox(localContextMenu.wordRect);
          } else {
            setRehearsalWordBox(null);
          }
          
          // Sync the position with other users via awareness
          const payload: Record<string, any> = { rehearsalLinePosition: newPosition };
          if (typeof jumpedDocPos === 'number') payload.rehearsalDocPos = jumpedDocPos;
          if (localContextMenu.wordRect) payload.rehearsalWordRect = localContextMenu.wordRect;
          debugLog('[Jump Action] Syncing via awareness (atomic):', payload);
          broadcastRehearsalState(payload);
          
          // Mark that we should center once due to a real position change
          pendingCenterRef.current = true;
          // Re-enable auto-scroll after executing jump, but do not keep centering on subsequent clicks
          setSuppressRehearsalAutoScroll(false);
          setShouldCenterOnRehearsalChange(false);
        }
        break;
      default:
        debugLog('Unknown context menu action:', action);
    }
    
    setLocalContextMenu(prev => ({ ...prev, visible: false }));
    // If menu closed without jumping, re-enable auto scroll but don't auto-center
    setSuppressRehearsalAutoScroll(false);
    setShouldCenterOnRehearsalChange(false);
    setInsertSubmenu({ open: false, x: 0, y: 0 });
  }, [editor, debugLog, localContextMenu.wordLineY, localContextMenu.hasWordTarget, localContextMenu.rehearsalDocPos, provider, rehearsalLinePosition]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (localContextMenu.visible) {
        setLocalContextMenu(prev => ({ ...prev, visible: false }));
        // Re-enable auto-scroll, but ensure we do NOT recentre
        // the rehearsal line when the menu was closed without a jump.
        setSuppressRehearsalAutoScroll(false);
        setShouldCenterOnRehearsalChange(false);
        pendingCenterRef.current = false;
        setInsertSubmenu({ open: false, x: 0, y: 0 });
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [localContextMenu.visible]);

  // Ensure we start at top when opening a script the first time
  useEffect(() => {
    // Scroll the page and container to the very top once the editor is ready/synced
    const t = setTimeout(() => {
      try {
        const container = document.querySelector('.singlePageContainer') as HTMLElement | null;
        if (container) container.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: 'auto' });
      } catch {}
    }, 80);
    return () => clearTimeout(t);
  }, [scriptId, editor, isYjsSynced]);

  // Listen for global toggle event from toolbar ruler button
  useEffect(() => {
    const handler = () => setRulerOverlayActive(prev => !prev);
    window.addEventListener('fassandra:toggle-ruler-overlay', handler as any);
    return () => window.removeEventListener('fassandra:toggle-ruler-overlay', handler as any);
  }, []);

  // Handle animated navigation back
  const handleAnimatedNavigation = useCallback(() => {
    // Add exit animation class if needed
    const pageElement = document.querySelector('.dinA4Page');
    if (pageElement) {
      pageElement.classList.add('exiting');
    }
    
    setTimeout(() => {
      onNavigateBack();
    }, 100);
  }, [onNavigateBack]);

  // Handle browser back button navigation
  useEffect(() => {
    const handlePopState = (_event: PopStateEvent) => {
      handleAnimatedNavigation();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleAnimatedNavigation]);

  // Removed demo manager initialization - development utility

  // Removed demo mode toggle function - development utility

  // Debug logging for responsive behavior
  useEffect(() => {
    debugLog('[Editor] Responsive config:', {
      breakpoint: config.breakpoint,
      isMobile,
      viewport: config.viewport,
    });
  }, [config, isMobile, debugLog]);

  // Debug logs disabled after verification
  // useEffect(() => {
  //   if (!editor || !isYjsSynced) return;
  //   const timer = setTimeout(() => {
  //     try {
  //       const byDataAttr = document.querySelectorAll('div[data-type="page-indicator"]').length;
  //       const byClass = document.querySelectorAll('div.page-indicator').length;
  //       logger.info('Editor', '[DEBUG_PAGE_INDICATORS] Counts:', { byDataAttr, byClass });
  //       const samples = Array.from(document.querySelectorAll('div[data-type="page-indicator"]'))
  //         .slice(0, 3)
  //         .map((el: any) => el?.outerHTML?.slice(0, 120));
  //       if (samples.length > 0) {
  //         logger.info('Editor', '[DEBUG_PAGE_INDICATORS] Samples:', samples);
  //       }
  //       const counts: Record<string, number> = {};
  //       editor.state.doc.descendants((node: any) => {
  //         const n = node.type?.name || 'unknown';
  //         counts[n] = (counts[n] || 0) + 1;
  //       });
  //       logger.info('Editor', '[DEBUG_PM_NODES] Node counts:', counts);
  //     } catch (e) {
  //       logger.warn('Editor', '[DEBUG_PAGE_INDICATORS] Failed to inspect DOM:', e);
  //     }
  //   }, 400);
  //   return () => clearTimeout(timer);
  // }, [editor, isYjsSynced]);

  // 🔧 CRITICAL FIX: EARLY RETURNS MOVED AFTER ALL HOOKS
  // Early return if no auth
  if (!token || !user || !tokenReady) {
    return (
      <div className="editorContainer">
        <LoadingSpinner size="lg" />
        <p>Authenticating...</p>
      </div>
    );
  }
  
  // Show error if connection failed
  if (connectionStatus === 'error' && errorMessage) {
    return (
      <div className="editorContainer">
        <div className="error-display">
          <h3>Connection Error</h3>
          <p>{errorMessage}</p>
          <button onClick={() => window.location.reload()}>Retry Connection</button>
        </div>
      </div>
    );
  }

  return (
    <EditorShell
      header={(
        <Header 
          currentView="editor" 
          scriptTitle={initialTitle} 
          onNavigateToScripts={handleAnimatedNavigation}
          layouts={[]} // TODO: Implement layout management
          currentLayout={null}
          onLayoutChange={() => {}} // TODO: Implement
          onCreateNewLayout={async () => {}} // TODO: Implement
          onSaveLayout={async () => {}} // TODO: Implement
          activeUserCount={activeUserCount} // Removed demo bot count
          connectionStatus={connectionStatus} // Pass connection status to header
          // Removed demo mode props - development utility
        />
      )}
    >
      
      {/* Status indicator removed - now shown in header as sphere */}
      
      {/* Removed demo mode status indicator - development utility */}
      
      {/* Main editor content */}
      {viewMode === 'borderless' ? (
        <BorderlessView
          showRuler={false}
          onToggleRuler={() => setShowRuler(!showRuler)}
          onToggleViewMode={() => setViewMode('single-page')}
          rehearsalMode={rehearsalMode}
          rehearsalLinePosition={rehearsalLinePosition}
          overlay={
            editor ? (
              <>
                <FloatingCuesLayer
                  editor={editor}
                  onOpenCue={handleCueOpen}
                />
                {editor && (
                  <CueConnectors editor={editor} expandedCueId={expandedCueId} />
                )}
                {/* Disable ruler overlay in borderless to keep a stable left column */}
                {viewMode !== 'borderless' && (
                  <RulerOverlay active={rulerOverlayActive} onClose={() => setRulerOverlayActive(false)} />
                )}
                <FloatingCommentsLayer
                  editor={editor}
                  onOpenComment={handleCommentOpen}
                />
                {rehearsalMode && rehearsalWordBox && (
                  <div
                    className="rehearsal-word-box"
                    style={{
                      left: `${rehearsalWordBox.left}px`,
                      top: `${rehearsalWordBox.top}px`,
                      width: `${rehearsalWordBox.width}px`,
                      height: `${rehearsalWordBox.height}px`,
                    }}
                  />
                )}
              </>
            ) : null
          }
        >
          <EditorContent
            editor={editor}
            connectionStatus={connectionStatus}
            ydoc={ydoc}
            provider={provider}
            onContextMenu={handleContextMenu}
            setLocalContextMenu={setLocalContextMenu}
            setSuppressRehearsalAutoScroll={setSuppressRehearsalAutoScroll}
            setShouldCenterOnRehearsalChange={setShouldCenterOnRehearsalChange}
            pendingCenterRef={pendingCenterRef}
            debugLog={debugLog}
            editAllSpeakers={editAllSpeakers}
            setEditAllSpeakers={setEditAllSpeakers}
            setCurrentSpeakerName={setCurrentSpeakerName}
            liveRenameBaseRef={liveRenameBaseRef}
            isLiveRenamingRef={isLiveRenamingRef}
            hideContextMenu={hideContextMenu}
            showContextMenu={showContextMenu}
          />
        </BorderlessView>
      ) : (
        <SinglePageView 
          className={rightSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}
          showRuler={false}
          pageNumber={pageNumber}
          pageCount={pageCount}
          onToggleRuler={() => setShowRuler(!showRuler)}
          onToggleViewMode={() => setViewMode(viewMode === 'single-page' ? 'borderless' : 'single-page')}
          rehearsalMode={rehearsalMode}
          rehearsalLinePosition={rehearsalLinePosition}
          overlay={
            editor ? (
              // Floating cues overlay anchored to connected words
              <>
                {/* eslint-disable-next-line react/jsx-no-useless-fragment */}
                <FloatingCuesLayer
                  editor={editor}
                  onOpenCue={handleCueOpen}
                />
                {editor && (
                  <CueConnectors editor={editor} expandedCueId={expandedCueId} />
                )}
                {/* Ruler overlay */}
                {viewMode !== 'borderless' && (
                  <RulerOverlay active={rulerOverlayActive} onClose={() => setRulerOverlayActive(false)} />
                )}
                {/* Comments overlay */}
                <FloatingCommentsLayer
                  editor={editor}
                  onOpenComment={handleCommentOpen}
                />
                {/* Rehearsal word highlight box */}
                {rehearsalMode && rehearsalWordBox && (
                  <div
                    className="rehearsal-word-box"
                    style={{
                      left: `${rehearsalWordBox.left}px`,
                      top: `${rehearsalWordBox.top}px`,
                      width: `${rehearsalWordBox.width}px`,
                      height: `${rehearsalWordBox.height}px`,
                    }}
                  />
                )}
              </>
            ) : null
          }
              onOutsideClick={() => {
                try {
                  if (editor) {
                    const { state } = editor;
                    const { selection } = state;
                    if (selection && !selection.empty) {
                      const pos = selection.head;
                      editor.chain().setTextSelection(pos).run();
                    }
                    editor.commands.blur();
                    // Also clear any selected speaker node attributes on outside click
                    try {
                      const { state: s, view } = editor as any;
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
                } catch {}
                hideContextMenu();
                setEditAllSpeakers(false);
                setCurrentSpeakerName(null);
              }}
        >
          <EditorContent
            editor={editor}
            connectionStatus={connectionStatus}
            ydoc={ydoc}
            provider={provider}
            onContextMenu={handleContextMenu}
            setLocalContextMenu={setLocalContextMenu}
            setSuppressRehearsalAutoScroll={setSuppressRehearsalAutoScroll}
            setShouldCenterOnRehearsalChange={setShouldCenterOnRehearsalChange}
            pendingCenterRef={pendingCenterRef}
            debugLog={debugLog}
            editAllSpeakers={editAllSpeakers}
            setEditAllSpeakers={setEditAllSpeakers}
            setCurrentSpeakerName={setCurrentSpeakerName}
            liveRenameBaseRef={liveRenameBaseRef}
            isLiveRenamingRef={isLiveRenamingRef}
            hideContextMenu={hideContextMenu}
            showContextMenu={showContextMenu}
          />
        </SinglePageView>
      )}

      {/* Context Menu */}
      {localContextMenu.visible && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            left: `${localContextMenu.x}px`,
            top: `${localContextMenu.y}px`,
            background: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
            zIndex: 1000,
            minWidth: '200px',
            overflow: 'hidden',
          }}
        >
          {rehearsalMode && localContextMenu.hasWordTarget && (
            <div 
              className="context-menu-item"
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
                fontWeight: 'bold',
                color: '#ff6b6b',
              }}
              onClick={() => handleContextMenuAction('jump')}
            >
              Jump
            </div>
          )}
          {(localContextMenu.onPageBackground || (editor && editor.state && !editor.state.selection.empty)) && (
            <>
              {!editor?.state.selection.empty && (
                <div 
                  className="context-menu-item"
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                  onClick={() => handleContextMenuAction('add-comment')}
                >
                  💬 Add Comment
                </div>
              )}
              {/* Insert submenu trigger */}
              <div 
                className="context-menu-item"
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
                onMouseEnter={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setInsertSubmenu({ open: true, x: rect.right + 4, y: rect.top });
                }}
                onMouseLeave={() => {/* keep open for submenu */}}
              >
                <span>➕ Insert</span>
                <span style={{ opacity: 0.6 }}>▶</span>
              </div>
              <div 
                className="context-menu-item"
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                }}
                onClick={() => handleContextMenuAction('toggle-view')}
              >
                {viewMode === 'single-page' ? '📄 Multiple Pages View' : '📃 Single Page View'}
              </div>
            </>
          )}
          
          {localContextMenu.onSpeakerName && (
            <>
              <div 
                className="context-menu-item"
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border)',
                }}
                onClick={() => handleContextMenuAction('format-speakers')}
              >
                🗣️ Format All Speaker Names
              </div>
              <div 
                className="context-menu-item"
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                }}
                onClick={() => handleContextMenuAction('change-speaker-color')}
              >
                🎨 Change Speaker Color
              </div>
            </>
          )}
        </div>
      )}

      {/* Insert submenu */}
      {insertSubmenu.open && (
        <div
          className="context-submenu"
          style={{
            position: 'fixed',
            left: `${insertSubmenu.x}px`,
            top: `${insertSubmenu.y}px`,
            background: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
            zIndex: 1001,
            minWidth: '180px',
            padding: '4px 0',
          }}
          onMouseLeave={() => setInsertSubmenu({open:false,x:0,y:0})}
        >
          <div className="context-menu-item" style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }} onClick={() => handleContextMenuAction('insert-paragraph')}>
            📝 Free Text
          </div>
          <div className="context-menu-item" style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }} onClick={() => handleContextMenuAction('insert-dialogue')}>
            <MessageSquareQuoteIcon size={14} /> Dialogue
          </div>
          <div className="context-menu-item" style={{ padding: '10px 14px', cursor: 'pointer' }} onClick={() => handleContextMenuAction('insert-scene')}>
            🎬 Scene
          </div>
        </div>
      )}

      {/* Floating Toolbar */}
      <Toolbar 
        editor={editor}
        context={toolbarContext}
        hasTextSelection={editor?.state.selection.empty === false}
        viewMode={viewMode}
        speakerNames={new Set(availableSpeakers)}
        currentSpeakerName={currentSpeakerName}
        editAllSpeakers={editAllSpeakers}
        onToggleEditAllSpeakers={() => setEditAllSpeakers(!editAllSpeakers)}
        onSetViewMode={setViewMode}
        rehearsalMode={rehearsalMode}
        onToggleRehearsalMode={() => {
          const newMode = !rehearsalMode;
          setRehearsalMode(newMode);
          logger.debug('Editor', 'Rehearsal mode toggled:', newMode);
          
          // If turning ON rehearsal mode: try to adopt another user's position via Yjs awareness
          if (newMode) {
            try {
              if (adoptRemotePosition()) {
                return;
              }
            } catch {}
          }
        }}
        autoFollowActive={autoFollowActive}
        asrPreviewText={lastAsrText}
        onToggleAutoFollow={async () => {
          if (autoFollowActive) {
            await stopAutoFollow();
          } else {
            await startAutoFollow();
          }
        }}
      />
      {/* Right Sidebar */}
      <RightSidebar
        open={rightSidebarOpen}
        onToggleOpen={() => setRightSidebarOpen(v => !v)}
        tab={sidebarTab}
        setTab={setSidebarTab}
        scenes={sidebarScenes}
        activeSceneId={activeSidebarSceneId}
        setActiveSceneId={setActiveSidebarSceneId}
        sidebarPanel={sidebarPanel}
        setSidebarPanel={setSidebarPanel}
        cuesCollapsed={cuesCollapsed}
        setCuesCollapsed={setCuesCollapsed}
        sidebarCues={sidebarCues}
        cueFilters={cueFilters}
        setCueFilters={setCueFilters}
        activeCueId={activeSidebarCueId}
        setActiveCueId={setActiveSidebarCueId}
        expandedCueId={expandedCueId}
        setExpandedCueId={setExpandedCueId}
        cueDescriptions={cueDescriptions}
        setCueDescriptions={setCueDescriptions}
        commentsCollapsed={commentsCollapsed}
        setCommentsCollapsed={setCommentsCollapsed}
        sidebarComments={sidebarComments}
        activeCommentId={activeSidebarCommentId}
        setActiveCommentId={setActiveSidebarCommentId}
        editor={editor}
      />
      {/* Sidebar content */}
        {/* Inline editor removed (handled inline per card) */}
      
      {/* Audio Transcription removed per request */}
    </EditorShell>
  );
};
