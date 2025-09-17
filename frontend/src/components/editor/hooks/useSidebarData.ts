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
    const container = document.querySelector('.singlePageContainer') as HTMLElement | null;
    const cRect = container ? container.getBoundingClientRect() : null;
    const cScrollTop = container ? (container.scrollTop || 0) : 0;
    const cScrollLeft = container ? ((container as any).scrollLeft || 0) : 0;

    const scenes: SidebarScene[] = [];
    document.querySelectorAll('[data-type="scene-block"]').forEach((el, index) => {
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
    document.querySelectorAll('.cue-connection[data-cue-id][data-cue-type]').forEach((el) => {
      const he = el as HTMLElement;
      const id = he.getAttribute('data-cue-id') || '';
      if (!id || seenCueIds.has(id)) return;
      seenCueIds.add(id);
      const r = he.getBoundingClientRect();
      const y = cRect ? (r.top - cRect.top) + cScrollTop : r.top;
      const x = cRect ? (r.left - cRect.left) + cScrollLeft : r.left;
      cues.push({
        cueId: id,
        cueType: he.getAttribute('data-cue-type') || 'props',
        cueNumber: he.getAttribute('data-cue-number') || '',
        cueName: he.getAttribute('data-cue-name') || '',
        text: (he.textContent || '').trim(),
        y,
        x,
      });
    });

    const comments: SidebarComment[] = [];
    const seenCommentIds = new Set<string>();
    document.querySelectorAll('.comment-annotation[data-comment-id]').forEach((el) => {
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

  useEffect(() => {
    if (!editor || !isBrowser) return undefined;
    recompute();
    const anyEditor = editor as any;
    anyEditor.on?.('update', recompute);
    anyEditor.on?.('selectionUpdate', recompute);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);

    return () => {
      anyEditor.off?.('update', recompute);
      anyEditor.off?.('selectionUpdate', recompute);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [editor, recompute]);

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
