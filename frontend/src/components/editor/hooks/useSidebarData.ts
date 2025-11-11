import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { Editor } from '@tiptap/react';
import type { CueType } from '../../../types/cue';

export type SidebarScene = {
  id: string;
  sceneNumber: string;
  sceneName: string;
  y: number;
  index: number;
};

export type SidebarCue = {
  cueId: string;
  cueType: string;
  cueNumber: string;
  cueName?: string | null;
  y: number;
  x: number;
  text?: string;
};

export type SidebarComment = {
  id: string;
  text: string;
};

export type SidebarPanelState =
  | { type: 'cue'; cueId: string; cueType: string; cueNumber: string; cueName?: string | null; draftName: string }
  | { type: 'comment'; id: string; draft: string }
  | null;

export type SidebarTab = 'scenes' | 'cues' | 'comments';

const DEFAULT_CUE_FILTERS: Record<CueType, boolean> = {
  light: true,
  video: true,
  sound: true,
  props: true,
  technik: true,
  einruf: true,
};

interface UseSidebarDataReturn {
  sidebarScenes: SidebarScene[];
  sidebarCues: SidebarCue[];
  sidebarComments: SidebarComment[];
  sidebarTab: SidebarTab;
  setSidebarTab: Dispatch<SetStateAction<SidebarTab>>;
  cuesCollapsed: boolean;
  setCuesCollapsed: Dispatch<SetStateAction<boolean>>;
  commentsCollapsed: boolean;
  setCommentsCollapsed: Dispatch<SetStateAction<boolean>>;
  cueFilters: Record<CueType, boolean>;
  setCueFilters: Dispatch<SetStateAction<Record<CueType, boolean>>>;
  activeSidebarSceneId: string | null;
  setActiveSidebarSceneId: Dispatch<SetStateAction<string | null>>;
  activeSidebarCueId: string | null;
  setActiveSidebarCueId: Dispatch<SetStateAction<string | null>>;
  expandedCueId: string | null;
  setExpandedCueId: Dispatch<SetStateAction<string | null>>;
  activeSidebarCommentId: string | null;
  setActiveSidebarCommentId: Dispatch<SetStateAction<string | null>>;
  cueDescriptions: Record<string, string>;
  setCueDescriptions: Dispatch<SetStateAction<Record<string, string>>>;
  sidebarPanel: SidebarPanelState;
  setSidebarPanel: Dispatch<SetStateAction<SidebarPanelState>>;
}

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

// Throttle helper function
function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  let previous = 0;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(this, args);
    } else if (!timeout) {
      timeout = window.setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func.apply(this, args);
      }, remaining);
    }
  };
}

export const useSidebarData = (editor: Editor | null): UseSidebarDataReturn => {
  const [sidebarScenes, setSidebarScenes] = useState<SidebarScene[]>([]);
  const [sidebarCues, setSidebarCues] = useState<SidebarCue[]>([]);
  const [sidebarComments, setSidebarComments] = useState<SidebarComment[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('cues');
  const [cuesCollapsed, setCuesCollapsed] = useState(false);
  const [commentsCollapsed, setCommentsCollapsed] = useState(false);
  const [cueFilters, setCueFilters] = useState<Record<CueType, boolean>>(DEFAULT_CUE_FILTERS);
  const [activeSidebarSceneId, setActiveSidebarSceneId] = useState<string | null>(null);
  const [activeSidebarCueId, setActiveSidebarCueId] = useState<string | null>(null);
  const [expandedCueId, setExpandedCueId] = useState<string | null>(null);
  const [activeSidebarCommentId, setActiveSidebarCommentId] = useState<string | null>(null);
  const [cueDescriptions, setCueDescriptions] = useState<Record<string, string>>({});
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanelState>(null);

  const recompute = useCallback(() => {
    if (!isBrowser) return;

    // 🔧 PERFORMANCE: Use scoped queries from editor container instead of document
    const editorContainer = document.querySelector('.ProseMirror') as HTMLElement | null;
    if (!editorContainer) return;

    const container = document.querySelector('.singlePageContainer') as HTMLElement | null;
    const cRect = container ? container.getBoundingClientRect() : null;
    const cScrollTop = container ? (container.scrollTop || 0) : 0;
    const cScrollLeft = container ? ((container as any).scrollLeft || 0) : 0;

    const scenes: SidebarScene[] = [];
    // 🔧 PERFORMANCE: Query only within editor container
    const sceneElements = editorContainer.querySelectorAll('[data-type="scene-block"]');
    sceneElements.forEach((el, index) => {
      const he = el as HTMLElement;
      const rect = he.getBoundingClientRect();
      const y = cRect ? (rect.top - cRect.top) + cScrollTop : rect.top;
      const sceneNumber = he.getAttribute('data-scene-number') || `${index + 1}`;
      const sceneName = he.getAttribute('data-scene-name') || (he.textContent || '').trim() || `Scene ${sceneNumber}`;
      scenes.push({
        id: `${sceneNumber}-${index}`,
        sceneNumber,
        sceneName,
        y,
        index,
      });
    });

    const cues: SidebarCue[] = [];
    const seenCueIds = new Set<string>();

    // 🔧 PERFORMANCE: Query only within editor container
    const cueBlocks = editorContainer.querySelectorAll('[data-type="cue-block"]');

    cueBlocks.forEach((el) => {
      const he = el as HTMLElement;
      // Generate a temporary ID if the cue block doesn't have one yet (for backward compatibility)
      let id = he.getAttribute('data-cue-id');
      const cueType = he.getAttribute('data-cue-type') || 'light';
      const cueNumber = he.getAttribute('data-cue-number') || '';

      if (!id) {
        // For legacy cues without IDs, generate a stable ID based on type and number
        id = `legacy-${cueType}-${cueNumber}`;
      }

      if (seenCueIds.has(id)) {
        return;
      }
      seenCueIds.add(id);

      const r = he.getBoundingClientRect();
      const y = cRect ? (r.top - cRect.top) + cScrollTop : r.top;
      const x = cRect ? (r.left - cRect.left) + cScrollLeft : r.left;

      // 🔧 PERFORMANCE: Use scoped query for cue connection
      let connectedText = '';
      const connectionEl = editorContainer.querySelector(`.cue-connection[data-cue-type="${cueType}"][data-cue-number="${cueNumber}"]`) as HTMLElement;
      if (connectionEl) {
        connectedText = (connectionEl.textContent || '').trim();
      }

      cues.push({
        cueId: id,
        cueType,
        cueNumber,
        cueName: he.getAttribute('data-cue-name') || '',
        text: connectedText,
        y,
        x,
      });
    });

    const comments: SidebarComment[] = [];
    const seenCommentIds = new Set<string>();
    // 🔧 PERFORMANCE: Query only within editor container
    editorContainer.querySelectorAll('.comment-annotation[data-comment-id]').forEach((el) => {
      const he = el as HTMLElement;
      const id = he.getAttribute('data-comment-id') || '';
      if (!id || seenCommentIds.has(id)) return;
      seenCommentIds.add(id);
      comments.push({ id, text: he.getAttribute('data-comment-text') || '' });
    });

    setSidebarScenes(scenes);
    setSidebarCues(cues);
    setSidebarComments(comments);
  }, []);

  // Create throttled version of recompute for performance
  const throttledRecompute = useCallback(
    throttle(recompute, 250), // Throttle to max 4 times per second
    [recompute]
  );

  // 🔧 CRITICAL PERFORMANCE FIX: Heavy debounce for sidebar recompute
  // querySelectorAll for all cue-blocks is VERY expensive - only run after typing stops
  const debouncedRecompute = useCallback(() => {
    let debounceTimer: number | null = null;
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      // Wait 800ms after last update before running expensive querySelectorAll
      debounceTimer = window.setTimeout(() => {
        recompute();
        debounceTimer = null;
      }, 800);
    };
  }, [recompute])();

  const scheduleAsyncRecompute = debouncedRecompute;

  useEffect(() => {
    if (!editor || !isBrowser) return undefined;

    // Initial computation
    recompute();

    const anyEditor = editor as any;

    // Use async scheduled recompute for zero-latency typing
    // This ensures UI updates happen during browser idle time
    anyEditor.on?.('update', scheduleAsyncRecompute);
    anyEditor.on?.('selectionUpdate', throttledRecompute); // Keep throttled for selection
    window.addEventListener('resize', throttledRecompute);
    window.addEventListener('scroll', throttledRecompute, true);

    return () => {
      anyEditor.off?.('update', scheduleAsyncRecompute);
      anyEditor.off?.('selectionUpdate', throttledRecompute);
      window.removeEventListener('resize', throttledRecompute);
      window.removeEventListener('scroll', throttledRecompute, true);
    };
  }, [editor, recompute, throttledRecompute, scheduleAsyncRecompute]);

  const memoizedCueFilters = useMemo(() => cueFilters, [cueFilters]);

  return {
    sidebarScenes,
    sidebarCues,
    sidebarComments,
    sidebarTab,
    setSidebarTab,
    cuesCollapsed,
    setCuesCollapsed,
    commentsCollapsed,
    setCommentsCollapsed,
    cueFilters: memoizedCueFilters,
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
  };
};
