import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../../../AuthContext';
import { Header } from '../../Header';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { useEditorCore } from '../hooks/useEditorCore';
import { Toolbar } from './toolbar/Toolbar';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { StatusIndicator } from './ui/StatusIndicator';
import { SinglePageView } from '../ViewModes';
import { FloatingCuesLayer } from './FloatingCuesLayer';
import { FloatingCommentsLayer } from './FloatingCommentsLayer';
import RulerOverlay from './RulerOverlay';
import { MessageSquareQuoteIcon } from '../icons';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorProps, ViewMode } from '../types';

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
  const [rehearsalMode, setRehearsalMode] = useState(false);
  const [rehearsalLinePosition, setRehearsalLinePosition] = useState<number>(0);
  const [rehearsalDocPos, setRehearsalDocPos] = useState<number | null>(null);
  const [rehearsalWordBox, setRehearsalWordBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [suppressRehearsalAutoScroll, setSuppressRehearsalAutoScroll] = useState(false);
  const [shouldCenterOnRehearsalChange, setShouldCenterOnRehearsalChange] = useState(false);
  const lastCenteredRehearsalPosRef = useRef<number | null>(null);
  // Explicit flag to center only when a change actually occurred
  const pendingCenterRef = useRef(false);
  // Prevent feedback loops when applying remote awareness updates
  const isApplyingRemoteRehearsalRef = useRef(false);
  // Track last seen remote positions per client to avoid repeated triggers
  const lastAwarenessPosRef = useRef<Map<number, number>>(new Map());
  const lastAwarenessRectRef = useRef<Map<number, string>>(new Map());
  const [editAllSpeakers, setEditAllSpeakers] = useState(false);
  const [currentSpeakerName, setCurrentSpeakerName] = useState<string | null>(null);
  const liveRenameBaseRef = useRef<string | null>(null);
  const isLiveRenamingRef = useRef<boolean>(false);
  const [rulerOverlayActive, setRulerOverlayActive] = useState(false);
  const [insertSubmenu, setInsertSubmenu] = useState<{open:boolean;x:number;y:number}>({ open: false, x: 0, y: 0 });
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  // Sidebar collections and UI state
  const [sidebarCues, setSidebarCues] = useState<Array<{ cueId: string; cueType: string; cueNumber: string; cueName?: string|null; y: number; x: number }>>([]);
  const [sidebarComments, setSidebarComments] = useState<Array<{ id: string; text: string }>>([]);
  const [cuesCollapsed, setCuesCollapsed] = useState(false);
  const [commentsCollapsed, setCommentsCollapsed] = useState(false);
  const [cueFilters, setCueFilters] = useState<Record<CueType, boolean>>({
    light: true,
    video: true,
    sound: true,
    props: true,
  });
  const [sidebarPanel, setSidebarPanel] = useState<
    | { type: 'cue'; cueId: string; cueType: string; cueNumber: string; cueName?: string | null; draftName: string }
    | { type: 'comment'; id: string; draft: string }
    | null
  >(null);
  // Compute sidebar data from current editor DOM
  useEffect(() => {
    if (!editor) return;
    const recompute = () => {
      const cues: Array<{ cueId: string; cueType: string; cueNumber: string; cueName?: string|null }> = [];
      const seen = new Set<string>();
      const container = document.querySelector('.singlePageContainer') as HTMLElement | null;
      const cRect = container ? container.getBoundingClientRect() : null;
      const cScrollTop = container ? (container.scrollTop || 0) : 0;
      const cScrollLeft = container ? ((container as any).scrollLeft || 0) : 0;
      document.querySelectorAll('.cue-connection[data-cue-id][data-cue-type]').forEach((el) => {
        const he = el as HTMLElement;
        const id = he.getAttribute('data-cue-id') || '';
        if (!id || seen.has(id)) return;
        seen.add(id);
        const r = he.getBoundingClientRect();
        const y = cRect ? (r.top - cRect.top) + cScrollTop : r.top;
        const x = cRect ? (r.left - cRect.left) + cScrollLeft : r.left;
        cues.push({
          cueId: id,
          cueType: he.getAttribute('data-cue-type') || 'props',
          cueNumber: he.getAttribute('data-cue-number') || '',
          cueName: he.getAttribute('data-cue-name') || '',
          y,
          x,
        });
      });
      setSidebarCues(cues);
      const comments: Array<{ id: string; text: string }> = [];
      const seenC = new Set<string>();
      document.querySelectorAll('.comment-annotation[data-comment-id]').forEach((el) => {
        const he = el as HTMLElement;
        const id = he.getAttribute('data-comment-id') || '';
        if (!id || seenC.has(id)) return;
        seenC.add(id);
        comments.push({ id, text: he.getAttribute('data-comment-text') || '' });
      });
      setSidebarComments(comments);
    };
    recompute();
    editor.on('update', recompute);
    editor.on('selectionUpdate', recompute);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      editor.off('update', recompute);
      editor.off('selectionUpdate', recompute);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [editor]);
  
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

  // Sync rehearsal line position with other users via awareness
  useEffect(() => {
    if (!provider || !provider.awareness) return;

    const handleAwarenessChange = () => {
      const states = provider.awareness.getStates();

      states.forEach((state, clientId) => {
        if (clientId === provider.awareness.clientID) return; // ignore local
        const remotePos = state?.rehearsalLinePosition;
        const hadRemotePos = typeof remotePos === 'number';
        if (hadRemotePos) {
          const lastForClient = lastAwarenessPosRef.current.get(clientId);
          if (!(typeof lastForClient === 'number' && Math.abs(lastForClient - remotePos) <= 0.5)) {
            lastAwarenessPosRef.current.set(clientId, remotePos);
            debugLog('[Rehearsal Sync] New position from', clientId, ':', remotePos);
            isApplyingRemoteRehearsalRef.current = true;
            setRehearsalLinePosition(remotePos);
            // Request a single center due to position change
            pendingCenterRef.current = true;
            setTimeout(() => { isApplyingRemoteRehearsalRef.current = false; }, 0);
          }
        }

        // Process word rectangle update independently (even if position unchanged)
        try {
          const advState: any = state;
          const rect = advState?.rehearsalWordRect;
          if (rect && typeof rect.left === 'number') {
            const key = JSON.stringify({ l: rect.left, t: rect.top, w: rect.width, h: rect.height });
            const lastKey = lastAwarenessRectRef.current.get(clientId);
            if (key !== lastKey) {
              lastAwarenessRectRef.current.set(clientId, key);
              setRehearsalWordBox({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
              // If we did not get a remotePos (some clients may only send rect), align line under the rect
              if (!hadRemotePos && typeof rect.top === 'number' && typeof rect.height === 'number') {
                setRehearsalLinePosition(rect.top + rect.height);
              }
            }
          } else if (typeof advState?.rehearsalDocPos === 'number' && editor) {
            // Fallback: compute rect from doc pos
            const pos = advState.rehearsalDocPos as number;
            setRehearsalDocPos(pos);
            const view: any = (editor as any).view;
            const containerElement = document.querySelector('.singlePageContainer') as HTMLElement | null;
            if (view && containerElement && typeof view.domAtPos === 'function') {
              let domInfo = view.domAtPos(pos);
              let node: any = domInfo.node;
              let offset: number = (domInfo.offset || 0) as number;
              if (node && node.nodeType !== Node.TEXT_NODE) {
                const child = node.childNodes?.[Math.min(offset, node.childNodes.length - 1)] || node.firstChild;
                if (child && child.nodeType === Node.TEXT_NODE) {
                  node = child;
                  offset = Math.max(0, Math.min((node as Text).data.length, 0));
                }
              }
              if (node && node.nodeType === Node.TEXT_NODE) {
                const textNode = node as Text;
                const data = textNode.data || '';
                const isWordChar = (ch: string) => /[\p{L}\p{N}'’_-]/u.test(ch);
                let start = Math.max(0, Math.min(offset, data.length));
                while (start > 0 && isWordChar(data.charAt(start - 1))) start--;
                let end = Math.max(0, Math.min(offset, data.length));
                while (end < data.length && isWordChar(data.charAt(end))) end++;
                if (end > start) {
                  const range = document.createRange();
                  range.setStart(textNode, start);
                  range.setEnd(textNode, end);
                  const rect = range.getBoundingClientRect();
                  const containerRect = containerElement.getBoundingClientRect();
                  const scrollTop = containerElement.scrollTop || 0;
                  const scrollLeft = containerElement.scrollLeft || 0;
                  const mapped = {
                    left: rect.left - containerRect.left + scrollLeft,
                    top: rect.top - containerRect.top + scrollTop,
                    width: rect.width,
                    height: rect.height,
                  };
                  const key2 = JSON.stringify({ l: mapped.left, t: mapped.top, w: mapped.width, h: mapped.height });
                  if (key2 !== lastAwarenessRectRef.current.get(clientId)) {
                    lastAwarenessRectRef.current.set(clientId, key2);
                  }
                  setRehearsalWordBox(mapped);
                  if (!hadRemotePos) setRehearsalLinePosition(mapped.top + mapped.height);
                }
              }
            }
          }
        } catch {}
      });
    };

    provider.awareness.on('change', handleAwarenessChange);
    return () => { provider.awareness.off('change', handleAwarenessChange); };
  }, [provider, debugLog, rehearsalMode, viewMode, rehearsalLinePosition]);

  // Initialize/broadcast rehearsal line position when changed locally (avoid rebroadcast on remote apply)
  useEffect(() => {
    if (!provider || !provider.awareness) return;
    if (isApplyingRemoteRehearsalRef.current) return; // skip rebroadcasting remote updates
    if (rehearsalLinePosition > 0) {
      provider.awareness.setLocalStateField('rehearsalLinePosition', rehearsalLinePosition);
    }
  }, [provider, rehearsalLinePosition]); // Run when provider becomes available or position changes

  // Smooth scroll to keep rehearsal line centered ONLY when explicitly requested
  useEffect(() => {
    debugLog('[Rehearsal Line State] Position:', rehearsalLinePosition, 'Mode:', rehearsalMode, 'View:', viewMode);
    
    if (suppressRehearsalAutoScroll) return;
    if (!pendingCenterRef.current) return;
    if (!rehearsalMode || viewMode !== 'single-page') return;

    // Only center if the position actually changed since last center
    const alreadyCentered = (
      lastCenteredRehearsalPosRef.current !== null &&
      Math.abs(lastCenteredRehearsalPosRef.current - rehearsalLinePosition) <= 0.5
    );
    if (alreadyCentered) {
      // Consume the request even if nothing to do to avoid stray future triggers
      pendingCenterRef.current = false;
      return;
    }

    // Find the container element
    const containerElement = document.querySelector('.singlePageContainer');
    if (!containerElement) {
      debugLog('[Rehearsal Scroll] ERROR: Container element not found!');
      return;
    }

    // Calculate the position to scroll to (line position minus half viewport height)
    const containerRect = containerElement.getBoundingClientRect();
    const absoluteLinePosition = containerRect.top + window.scrollY + rehearsalLinePosition;
    const targetScrollPosition = absoluteLinePosition - (window.innerHeight / 2);

    // Smooth scroll to center the line
    window.scrollTo({
      top: targetScrollPosition,
      behavior: 'smooth'
    });

    debugLog('[Rehearsal Scroll] Scrolling to center line at position:', rehearsalLinePosition);
    lastCenteredRehearsalPosRef.current = rehearsalLinePosition;
    // Consume the pending center request so subsequent clicks do not re-center
    pendingCenterRef.current = false;
  }, [rehearsalLinePosition, rehearsalMode, viewMode, suppressRehearsalAutoScroll, shouldCenterOnRehearsalChange, debugLog]);

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
        setViewMode(prev => prev === 'single-page' ? 'multiple-pages' : 'single-page');
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
          if (provider && (provider as any).awareness) {
            try {
              const awareness: any = (provider as any).awareness;
              const current = awareness.getLocalState?.() || {};
              const next = { ...current, rehearsalLinePosition: newPosition } as any;
              if (typeof jumpedDocPos === 'number') next.rehearsalDocPos = jumpedDocPos;
              if (localContextMenu.wordRect) next.rehearsalWordRect = localContextMenu.wordRect;
              debugLog('[Jump Action] Syncing via awareness (atomic):', next);
              awareness.setLocalState?.(next);
            } catch {}
          }
          
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
    <div className="editorContainer">
      {/* Header */}
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
      
      {/* Status indicator removed - now shown in header as sphere */}
      
      {/* Removed demo mode status indicator - development utility */}
      
      {/* Main editor content (multipage removed; always single page) */}
      {
        <SinglePageView 
          showRuler={false}
          pageNumber={pageNumber}
          pageCount={pageCount}
          onToggleRuler={() => setShowRuler(!showRuler)}
          onToggleViewMode={() => setViewMode(viewMode === 'single-page' ? 'multiple-pages' : 'single-page')}
          rehearsalMode={rehearsalMode}
          rehearsalLinePosition={rehearsalLinePosition}
          overlay={
            editor ? (
              // Floating cues overlay anchored to connected words
              <>
                {/* eslint-disable-next-line react/jsx-no-useless-fragment */}
                <FloatingCuesLayer
                  editor={editor}
                  onOpenCue={(payload) => {
                    setRightSidebarOpen(true);
                    setSidebarPanel({ type: 'cue', ...payload, draftName: payload.cueName || '' });
                  }}
                />
                {/* Ruler overlay */}
                <RulerOverlay active={rulerOverlayActive} onClose={() => setRulerOverlayActive(false)} />
                {/* Comments overlay */}
                <FloatingCommentsLayer
                  editor={editor}
                  onOpenComment={({ id, text }) => {
                    setRightSidebarOpen(true);
                    setSidebarPanel({ type: 'comment', id, draft: text });
                  }}
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
          {editor ? (
            <div 
              className="editor-content"
              onContextMenu={handleContextMenu}
              onClick={(e) => {
                // Close context menu on click
                setLocalContextMenu(prev => ({ ...prev, visible: false }));
                // When closing without choosing an action, do not recenter
                setSuppressRehearsalAutoScroll(false);
                setShouldCenterOnRehearsalChange(false);
                pendingCenterRef.current = false;
                
                // Handle editor click for context detection
                const target = e.target as HTMLElement;
                const speakerElement = target.closest('[data-type="speaker"]');
                const dialogueTextElement = target.closest('[data-type="dialogue-text"]');
                const dialogueBlockElement = target.closest('[data-type="dialogue-block"]');
                const cueBlockElement = target.closest('[data-type="cue-block"]');
                const sceneBlockElement = target.closest('[data-type="scene-block"]');
                
                
                // Remove any existing selection classes first
                // Preserve speaker selection if clicking inside the same dialogue block
                const previouslySelectedSpeaker = document.querySelector('[data-type="speaker"].speaker-selected') as HTMLElement | null;
                const prevSpeakerBlock = previouslySelectedSpeaker?.closest('[data-type="dialogue-block"]');
                const currentClickBlock = target.closest('[data-type="dialogue-block"]');
                if (!previouslySelectedSpeaker || !prevSpeakerBlock || prevSpeakerBlock !== currentClickBlock) {
                  document.querySelectorAll('[data-type="speaker"].speaker-selected').forEach(el => {
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
                  // Also clear the node attributes from the document
                  try {
                    if (editor) {
                      const { state, view } = editor as any;
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
                    }
                  } catch {}
                }
                document.querySelectorAll('[data-type="cue-block"].cue-selected').forEach(el => {
                  el.classList.remove('cue-selected');
                });
                document.querySelectorAll('[data-type="scene-block"].scene-selected').forEach(el => {
                  el.classList.remove('scene-selected');
                });
                
                if (speakerElement) {
                  // Clicked on speaker - show SPEAKER menu
                  debugLog('[Editor] Clicked on speaker element:', speakerElement);
                  
                  const speakerName = speakerElement.textContent?.trim() || '';
                  setCurrentSpeakerName(speakerName);
                  if (editAllSpeakers) liveRenameBaseRef.current = speakerName;
                  
                  // Persist selection by updating node attribute on the speaker node
                  try {
                    if (editor) {
                      const view: any = (editor as any).view;
                      const { state } = editor;
                      let targetPos: number | null = null;
                      state.doc.descendants((node, position) => {
                        if (node.type.name === 'speaker') {
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
                          state.doc.descendants((node, position) => {
                            if (node.type.name === 'speaker' && node.attrs.selected) {
                              tr = tr.setNodeMarkup(position, undefined, { ...node.attrs, selected: false });
                            }
                            return true;
                          });
                          tr = tr.setNodeMarkup(targetPos, undefined, { ...nodeAt.attrs, selected: true });
                          view.dispatch(tr);
                          // Place caret at end of speaker name
                          const end = targetPos + 1 + nodeAt.content.size;
                          try {
                            (editor as any).chain().setTextSelection(end).focus().run();
                          } catch {}
                        }
                      }
                    }
                  } catch {}
                  
                  // If editAllSpeakers is true, highlight all speakers with the same name
                  if (editAllSpeakers) {
                    document.querySelectorAll('[data-type="speaker"]').forEach(el => {
                      if (el.textContent?.trim() === speakerName) {
                        el.classList.add('speaker-selected');
                      }
                    });
                  }
                  
                  // Show speaker-select toolbar
                  showContextMenu(e.clientX, e.clientY, 'speaker-select');
                  // Prevent default toolbar switching
                  e.stopPropagation();
                } else if (dialogueTextElement && dialogueBlockElement) {
                  // Clicked inside dialogue text - show TEXT FORMATTING toolbar
                  debugLog('[Editor] Clicked on dialogue text element:', dialogueTextElement);
                  
                  // Find and highlight the speaker element within the same dialogue block
                  const speakerInBlock = dialogueBlockElement.querySelector('[data-type="speaker"]');
                  if (speakerInBlock) {
                    const speakerName = speakerInBlock.textContent?.trim() || '';
                    setCurrentSpeakerName(speakerName);
                    
                    // Do not switch speaker into editable mode for dialogue text click
                    
                    // If editAllSpeakers is true, highlight all speakers with the same name
                    if (editAllSpeakers) {
                      document.querySelectorAll('[data-type="speaker"]').forEach(el => {
                        if (el.textContent?.trim() === speakerName) {
                          el.classList.add('speaker-selected');
                        }
                      });
                    }
                  }
                  
                  showContextMenu(e.clientX, e.clientY, 'text-formatting');
                  e.stopPropagation(); // Prevent default toolbar from showing
                } else if (cueBlockElement) {
                  // Clicked on cue block - show cue-select context
                  debugLog('[Editor] Clicked on cue block element:', cueBlockElement);
                  
                  // Add selected class to clicked cue block
                  cueBlockElement.classList.add('cue-selected');
                  
                  showContextMenu(e.clientX, e.clientY, 'cue-select');
                  e.stopPropagation(); // Prevent default toolbar from showing
                } else if (sceneBlockElement) {
                  // Clicked on scene block - show scene-select context
                  debugLog('[Editor] Clicked on scene block element:', sceneBlockElement);
                  
                  // Add selected class to clicked scene block
                  sceneBlockElement.classList.add('scene-selected');
                  // Move ProseMirror selection inside the clicked scene block
                  try {
                    if (editor) {
                      const view: any = (editor as any).view;
                      const posInNode = view.posAtDOM(sceneBlockElement, 0);
                      if (typeof posInNode === 'number' && posInNode >= 0) {
                        // place cursor at start+1 (inside node content)
                        editor.chain().setTextSelection(Math.min(posInNode + 1, editor.state.doc.content.size - 1)).run();
                      }
                    }
                  } catch {}
                  
                  showContextMenu(e.clientX, e.clientY, 'scene-select');
                  e.stopPropagation(); // Prevent default toolbar from showing
                } else {
                  // Clicked elsewhere - hide any special context and clear speaker selection
                  // This allows the toolbar to show text-formatting when text is selected
                  hideContextMenu();
                  setEditAllSpeakers(false);
                  setCurrentSpeakerName(null);
                  // Clear any selected speaker node attribute
                  try {
                    if (editor) {
                      const { state, view } = editor as any;
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
                    }
                  } catch {}
                }
}}
            >
              {/* This is where the TipTap editor content will render */}
              <div ref={(node) => {
                if (node && editor && !node.contains(editor.options.element)) {
                  node.appendChild(editor.options.element);
                }
              }} />
            </div>
          ) : (
            <div className="editor-loading">
              <LoadingSpinner size="lg" />
              <div>
                <p>Initializing collaborative editor...</p>
                {ydoc && provider ? (
                  <p style={{ fontSize: '14px', opacity: 0.7 }}>
                    ✅ Collaboration ready - Creating editor...
                  </p>
                ) : (
                  <p style={{ fontSize: '14px', opacity: 0.7 }}>
                    🔄 Status: {connectionStatus} - Setting up real-time sync...
                  </p>
                )}
              </div>
            </div>
          )}
        </SinglePageView>
      }
      
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
              if (provider && (provider as any).awareness) {
                const awareness: any = (provider as any).awareness;
                const clientId = awareness.clientID;
                const states: Map<number, any> = awareness.getStates();
                let sharedPos: number | null = null;
                states.forEach((state: any, id: number) => {
                  if (id !== clientId && state && typeof state.rehearsalLinePosition === 'number' && state.rehearsalLinePosition > 0) {
                    if (sharedPos === null) sharedPos = state.rehearsalLinePosition;
                  }
                });
                if (sharedPos !== null) {
                  // Only act if position differs from current
                  if (Math.abs(sharedPos - rehearsalLinePosition) <= 0.5) {
                    // No change → don't scroll/center
                    return;
                  }
                  // Adopt shared position locally without rebroadcasting
                  isApplyingRemoteRehearsalRef.current = true;
                  setRehearsalLinePosition(sharedPos);
                  // If a precise doc pos is advertised, use it to compute Y locally
                  try {
                    const adv = Array.from(states.values()).find((s: any) => s && (s.rehearsalWordRect || typeof s.rehearsalDocPos === 'number'));
                    if (adv?.rehearsalWordRect) {
                      const r = adv.rehearsalWordRect;
                      if (typeof r.top === 'number') setRehearsalLinePosition(r.top + (r.height || 0));
                      setRehearsalWordBox({ left: r.left, top: r.top, width: r.width, height: r.height });
                    } else if (editor && typeof adv?.rehearsalDocPos === 'number') {
                      const pos = adv.rehearsalDocPos;
                      const view: any = (editor as any).view;
                      const coords = view.coordsAtPos(pos);
                      const containerElement = document.querySelector('.singlePageContainer') as HTMLElement | null;
                      if (coords && containerElement) {
                        const containerRect = containerElement.getBoundingClientRect();
                        const containerScrollTop = containerElement.scrollTop || 0;
                        const y = coords.top - containerRect.top + containerScrollTop;
                        setRehearsalLinePosition(y);
                        setRehearsalDocPos(pos);
                      }
                    }
                  } catch {}
                  // Release the remote-apply guard shortly after applying
                  setTimeout(() => { isApplyingRemoteRehearsalRef.current = false; }, 0);
                  // Request centering once
                  pendingCenterRef.current = true;
                } else {
                  // No shared position → start at beginning and publish 0
                  // Do not broadcast 0 to avoid resetting others; keep local default
                }
              }
            } catch {}
          }
        }}
      />
      {/* Right Sidebar */}
      <div className={`rightSidebar ${rightSidebarOpen ? 'open' : 'collapsed'}`}>
        <div
          className="rightSidebarToggle"
          role="button"
          aria-label={rightSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={rightSidebarOpen ? 'Collapse' : 'Expand'}
          onClick={() => setRightSidebarOpen(v => !v)}
        >
          {rightSidebarOpen ? '<' : '>'}
        </div>
        {/* Sidebar information sections */}
        {rightSidebarOpen && (
          <div className="rightSidebarInner">
            {/* Cues */}
            <div className="rs-section">
              <div className="rs-header">
                <span>Cues</span>
                <button onClick={() => setCuesCollapsed(v => !v)}>{cuesCollapsed ? '▸' : '▾'}</button>
              </div>
              {!cuesCollapsed && (
                <div className="rs-list">
                  {/* Cue type filter chips (emoji-only squares) */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    {(['light','video','sound','props'] as CueType[]).map(t => (
                      <button
                        key={t}
                        type="button"
                        className={`rs-chip ${cueFilters[t] ? 'active' : ''}`}
                        onClick={() => setCueFilters(prev => ({ ...prev, [t]: !prev[t] }))}
                        aria-pressed={cueFilters[t]}
                        title={t}
                      >
                        <span aria-hidden>{CUE_TYPE_ICONS[t]}</span>
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const filtered = sidebarCues.filter(c => cueFilters[c.cueType as CueType]).sort((a,b) => a.y - b.y);
                    const groups: Array<{ y:number; x:number; items: typeof filtered }> = [] as any;
                    const bandY = 6, bandX = 12;
                    filtered.forEach(c => {
                      let g = groups.find(gr => Math.abs(gr.y - c.y) <= bandY && Math.abs(gr.x - c.x) <= bandX);
                      if (!g) { g = { y: c.y, x: c.x, items: [] as any }; groups.push(g); }
                      (g.items as any).push(c);
                    });
                    return groups.map((g, gi) => (
                      <div key={`g-${gi}`} className="rs-group">
                        {g.items.map(c => (
                     <div
                        key={c.cueId}
                        className={`rs-card clickable`}
                        onClick={() => {
                          const el = document.querySelector('.cue-connection[data-cue-id="' + c.cueId + '"]');
                          if (el) {
                            (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
                            (el as HTMLElement).classList.add('hover-highlight');
                            setTimeout(() => (el as HTMLElement).classList.remove('hover-highlight'), 800);
                          }
                        }}
                      >
                        <div className="title"><span aria-hidden>{CUE_TYPE_ICONS[c.cueType as keyof typeof CUE_TYPE_ICONS] || '🎛️'}</span> {c.cueName || (c.cueType.toUpperCase() + ' Q' + c.cueNumber)}</div>
                        {c.cueName ? <div className="subtitle">{c.cueType.toUpperCase()} • Q{c.cueNumber}</div> : null}
                        <div className="actions">
                          <button className="rs-btn primary" onClick={(e) => { e.stopPropagation(); const el = document.querySelector('.cue-connection[data-cue-id="' + c.cueId + '"]'); if (el) { (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }); (el as HTMLElement).classList.add('hover-highlight'); setTimeout(() => (el as HTMLElement).classList.remove('hover-highlight'), 800); } }}>▶ Trigger</button>
                          <button className="rs-btn" onClick={(e) => { e.stopPropagation(); setSidebarPanel({ type: 'cue', cueId: c.cueId, cueType: c.cueType, cueNumber: c.cueNumber, cueName: c.cueName || '', draftName: c.cueName || '' }); }}>Edit</button>
                        </div>
                        {sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === c.cueId && (
                          <div style={{ marginTop: 10 }}>
                            <input value={sidebarPanel.draftName} onChange={(e) => setSidebarPanel(p => p && p.type === 'cue' ? { ...p, draftName: e.target.value } : p)} placeholder="Cue name" style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--color-border)' }} />
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <button className="rs-btn primary" onClick={(e) => { e.stopPropagation(); if (!editor) return; (editor as any).commands.updateCueById(c.cueId, { cueName: (sidebarPanel as any).draftName }); }}>Save</button>
                              <button className="rs-btn" onClick={(e) => { e.stopPropagation(); if (!editor) return; (editor as any).commands.startCueExtend?.(c.cueId); }}>Move Link</button>
                              <button className="rs-btn" style={{ color: '#dc2626', borderColor: '#7f1d1d' }} onClick={(e) => { e.stopPropagation(); if (!editor) return; (editor as any).commands.removeCueConnection(c.cueId); setSidebarPanel(null); }}>Delete</button>
                            </div>
                          </div>
                        )}
                      </div>
                        ))}
                      </div>
                    ));
                  })()}
                  {sidebarCues.length === 0 && <div style={{ opacity: 0.5, fontSize: 12 }}>No cues in this script yet.</div>}
                </div>
              )}
            </div>
            {/* Comments */}
            <div className="rs-section">
              <div className="rs-header">
                <span>Comments</span>
                <button onClick={() => setCommentsCollapsed(v => !v)}>{commentsCollapsed ? '▸' : '▾'}</button>
              </div>
              {!commentsCollapsed && (
                <div className="rs-list">
                  {sidebarComments.map(cm => (
                    <div key={cm.id} className="rs-card">
                      <div className="rs-comment">
                        <div className="rs-avatar">💬</div>
                        <div className="content">
                          <div className="name">Comment</div>
                          <div className="text">{cm.text || 'No text yet'}</div>
                          {(sidebarPanel && sidebarPanel.type === 'comment' && sidebarPanel.id === cm.id) ? (
                            <div style={{ marginTop: 8 }}>
                              <textarea value={(sidebarPanel as any).draft} onChange={(e) => setSidebarPanel(p => p && p.type === 'comment' ? { ...p, draft: e.target.value } : p)} style={{ width: '100%', minHeight: 90, padding: 8, borderRadius: 6, border: '1px solid var(--color-border)' }} />
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button className="rs-btn primary" onClick={() => { if (!editor) return; (editor as any).commands.updateCommentById(cm.id, { commentText: (sidebarPanel as any).draft }); }}>Save</button>
                                <button className="rs-btn" style={{ color: '#dc2626', borderColor: '#7f1d1d' }} onClick={() => { if (!editor) return; (editor as any).commands.removeCommentById(cm.id); setSidebarPanel(null); }}>Delete</button>
                              </div>
                            </div>
                          ) : (
                            <div className="actions" style={{ marginTop: 8 }}>
                              <button className="rs-btn" onClick={() => setSidebarPanel({ type: 'comment', id: cm.id, draft: cm.text })}>Edit</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {sidebarComments.length === 0 && <div style={{ opacity: 0.5, fontSize: 12 }}>No comments yet.</div>}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Sidebar content */}
        {rightSidebarOpen && sidebarPanel && (
          <div style={{ padding: '12px', color: 'var(--color-text)' }}>
            {sidebarPanel.type === 'cue' ? (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Cue</div>
                <div style={{ opacity: 0.8, marginBottom: 8 }}>Type: {sidebarPanel.cueType.toUpperCase()} • Q{sidebarPanel.cueNumber}</div>
                <input
                  value={sidebarPanel.draftName}
                  onChange={(e) => setSidebarPanel(p => p && p.type === 'cue' ? { ...p, draftName: e.target.value } : p)}
                  placeholder="Cue name"
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--color-border)' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => {
                    if (!editor || !sidebarPanel || sidebarPanel.type !== 'cue') return;
                    (editor as any).commands.updateCueById(sidebarPanel.cueId, { cueName: sidebarPanel.draftName });
                  }}>Save</button>
                  <button type="button" onClick={() => {
                    if (!editor || !sidebarPanel || sidebarPanel.type !== 'cue') return;
                    const el = document.querySelector(`.cue-connection[data-cue-id="${sidebarPanel.cueId}"]`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}>Jump</button>
                  <button type="button" onClick={() => {
                    if (!editor || !sidebarPanel || sidebarPanel.type !== 'cue') return;
                    (editor as any).commands.startCueExtend?.(sidebarPanel.cueId);
                  }}>Move Link</button>
                  <button type="button" style={{ color: '#dc2626' }} onClick={() => {
                    if (!editor || !sidebarPanel || sidebarPanel.type !== 'cue') return;
                    (editor as any).commands.removeCueConnection(sidebarPanel.cueId);
                    setSidebarPanel(null);
                  }}>Delete</button>
                </div>
              </div>
            ) : sidebarPanel.type === 'comment' ? (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Comment</div>
                <textarea
                  value={sidebarPanel.draft}
                  onChange={(e) => setSidebarPanel(p => p && p.type === 'comment' ? { ...p, draft: e.target.value } : p)}
                  placeholder="Write a comment..."
                  style={{ width: '100%', minHeight: 120, padding: 8, borderRadius: 6, border: '1px solid var(--color-border)' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => {
                    if (!editor || !sidebarPanel || sidebarPanel.type !== 'comment') return;
                    (editor as any).commands.updateCommentById(sidebarPanel.id, { commentText: sidebarPanel.draft });
                  }}>Save</button>
                  <button type="button" style={{ color: '#dc2626' }} onClick={() => {
                    if (!editor || !sidebarPanel || sidebarPanel.type !== 'comment') return;
                    (editor as any).commands.removeCommentById(sidebarPanel.id);
                    setSidebarPanel(null);
                  }}>Delete</button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
      
      {/* Audio Transcription removed per request */}
    </div>
  );
}; 
