import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Editor } from '@tiptap/react';
import type { WebsocketProvider } from 'y-websocket';

import type { ViewMode, ToolbarContext } from '../types';
import { useEditorPages } from '../hooks/useEditorPages';
import { useSpeakerSelection } from '../hooks/useSpeakerSelection';
import { useEditorContextMenu } from '../hooks/useEditorContextMenu';
import {
  useSidebarData,
  type SidebarComment,
  type SidebarCue,
  type SidebarPanelState,
  type SidebarScene,
  type SidebarTab,
} from '../hooks/useSidebarData';
import { useRehearsalMode } from '../hooks/useRehearsalMode';
import { useBorderlessSpeakerInteractions } from '../hooks/useBorderlessSpeakerInteractions';
import { highlightAndScroll, scrollSidebarItemIntoView } from '../utils/domHelpers';
import type { CueType } from '../../../types/cue';
import type {
  CloseContextMenu,
  ContextMenuAction,
  ContextMenuState,
  InsertSubmenuState,
} from '../components/context-menu/contextMenuTypes';

interface EditorLayoutValue {
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  toggleViewMode: () => void;
  showRuler: boolean;
  setShowRuler: React.Dispatch<React.SetStateAction<boolean>>;
  pageNumber: number;
  pageCount: number;
  showCues: boolean;
  setShowCues: React.Dispatch<React.SetStateAction<boolean>>;
  showStruckDialogue: boolean;
  setShowStruckDialogue: React.Dispatch<React.SetStateAction<boolean>>;
  rulerOverlayActive: boolean;
  setRulerOverlayActive: React.Dispatch<React.SetStateAction<boolean>>;
  rightSidebarOpen: boolean;
  setRightSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

interface EditorRehearsalValue {
  rehearsalMode: boolean;
  setRehearsalMode: (value: boolean) => void;
  rehearsalLinePosition: number;
  setRehearsalLinePosition: (value: number) => void;
  rehearsalDocPos: number | null;
  setRehearsalDocPos: (value: number | null) => void;
  rehearsalWordBox: { left: number; top: number; width: number; height: number } | null;
  setRehearsalWordBox: (
    box: { left: number; top: number; width: number; height: number } | null
  ) => void;
  suppressRehearsalAutoScroll: boolean;
  setSuppressRehearsalAutoScroll: (value: boolean) => void;
  setShouldCenterOnRehearsalChange: (value: boolean) => void;
  pendingCenterRef: React.MutableRefObject<boolean>;
  isApplyingRemoteRehearsalRef: React.MutableRefObject<boolean>;
  autoFollowActive: boolean;
  startAutoFollow: () => Promise<void> | void;
  stopAutoFollow: () => Promise<void> | void;
  lastAsrText: string | null;
  adoptRemotePosition: () => boolean;
}

interface EditorSpeakerValue {
  editAllSpeakers: boolean;
  setEditAllSpeakers: React.Dispatch<React.SetStateAction<boolean>>;
  currentSpeakerName: string | null;
  setCurrentSpeakerName: React.Dispatch<React.SetStateAction<string | null>>;
  liveRenameBaseRef: React.MutableRefObject<string | null>;
  availableSpeakers: string[];
}

interface EditorContextMenuValue {
  contextMenu: ContextMenuState;
  insertSubmenu: InsertSubmenuState;
  handleContextMenu: (event: React.MouseEvent) => void;
  handleContextMenuAction: (action: ContextMenuAction) => void;
  openInsertSubmenu: (rect: DOMRect) => void;
  closeInsertSubmenu: () => void;
  closeContextMenu: CloseContextMenu;
  hideContextMenu: () => void;
  showContextMenu: (x: number, y: number, context: ToolbarContext) => void;
  editorHasSelection: boolean;
}

interface EditorSidebarValue {
  sidebarTab: SidebarTab;
  setSidebarTab: React.Dispatch<React.SetStateAction<SidebarTab>>;
  sidebarScenes: SidebarScene[];
  activeSidebarSceneId: string | null;
  setActiveSidebarSceneId: React.Dispatch<React.SetStateAction<string | null>>;
  sidebarPanel: SidebarPanelState;
  setSidebarPanel: React.Dispatch<React.SetStateAction<SidebarPanelState>>;
  cuesCollapsed: boolean;
  setCuesCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarCues: SidebarCue[];
  cueFilters: Record<CueType, boolean>;
  setCueFilters: React.Dispatch<React.SetStateAction<Record<CueType, boolean>>>;
  activeSidebarCueId: string | null;
  setActiveSidebarCueId: React.Dispatch<React.SetStateAction<string | null>>;
  expandedCueId: string | null;
  setExpandedCueId: React.Dispatch<React.SetStateAction<string | null>>;
  cueDescriptions: Record<string, string>;
  setCueDescriptions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  commentsCollapsed: boolean;
  setCommentsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarComments: SidebarComment[];
  activeSidebarCommentId: string | null;
  setActiveSidebarCommentId: React.Dispatch<React.SetStateAction<string | null>>;
  handleCueOpen: (payload: { cueId: string }) => void;
  handleCommentOpen: (payload: { id: string; text: string }) => void;
}

interface EditorUiProviderProps {
  editor: Editor | null;
  provider: WebsocketProvider | null;
  scriptId: string;
  token: string | null;
  availableSpeakers: string[];
  debugLog: (...args: any[]) => void;
  showContextMenu: (x: number, y: number, context: ToolbarContext) => void;
  hideContextMenu: () => void;
  isYjsSynced: boolean;
  children: React.ReactNode;
}

const EditorLayoutContext = createContext<EditorLayoutValue | undefined>(undefined);
const EditorRehearsalContext = createContext<EditorRehearsalValue | undefined>(undefined);
const EditorSpeakerContext = createContext<EditorSpeakerValue | undefined>(undefined);
const EditorContextMenuContext = createContext<EditorContextMenuValue | undefined>(undefined);
const EditorSidebarContext = createContext<EditorSidebarValue | undefined>(undefined);

export const EditorUiProvider: React.FC<EditorUiProviderProps> = ({
  editor,
  provider,
  scriptId,
  token,
  availableSpeakers,
  debugLog,
  showContextMenu,
  hideContextMenu,
  isYjsSynced,
  children,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('single-page');
  const [showRuler, setShowRuler] = useState(false);
  const [rulerOverlayActive, setRulerOverlayActive] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [showCues, setShowCues] = useState(true);
  const [showStruckDialogue, setShowStruckDialogue] = useState(true);

  const { pageNumber, pageCount } = useEditorPages(editor);

  useEffect(() => {
    const classList = document.body.classList;
    if (showCues) {
      classList.remove('hide-cues');
    } else {
      classList.add('hide-cues');
    }
    return () => classList.remove('hide-cues');
  }, [showCues]);

  useEffect(() => {
    const classList = document.body.classList;
    if (showStruckDialogue) {
      classList.remove('hide-struck-dialogue');
    } else {
      classList.add('hide-struck-dialogue');
    }
    return () => classList.remove('hide-struck-dialogue');
  }, [showStruckDialogue]);

  const rehearsal = useRehearsalMode({
    editor,
    provider,
    scriptId,
    token,
    viewMode,
    debugLog,
  });

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
  } = rehearsal;

  const {
    editAllSpeakers,
    setEditAllSpeakers,
    currentSpeakerName,
    setCurrentSpeakerName,
    liveRenameBaseRef,
  } = useSpeakerSelection(editor);

  const {
    contextMenu,
    insertSubmenu,
    handleContextMenu,
    handleContextMenuAction,
    openInsertSubmenu,
    closeInsertSubmenu,
    closeContextMenu,
  } = useEditorContextMenu({
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
  });

  useBorderlessSpeakerInteractions({
    editor,
    viewMode,
    setCurrentSpeakerName,
    showContextMenu,
  });

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

  const editorHasSelection = Boolean(editor?.state?.selection && !editor.state.selection.empty);

  const handleCueOpen = useCallback(
    (payload: { cueId: string }) => {
      highlightAndScroll(`.cue-connection[data-cue-id="${payload.cueId}"]`, 'hover-highlight');
      setRightSidebarOpen(true);
      setSidebarTab('cues');
      setCuesCollapsed(false);
      setActiveSidebarCueId(payload.cueId);
      setSidebarPanel(null);
      scrollSidebarItemIntoView(`.rightSidebar [data-cue-id="${payload.cueId}"]`);
    },
    [setActiveSidebarCueId, setCuesCollapsed, setRightSidebarOpen, setSidebarPanel, setSidebarTab],
  );

  const handleCommentOpen = useCallback(
    ({ id }: { id: string; text: string }) => {
      highlightAndScroll(`.comment-annotation[data-comment-id="${id}"]`, 'connected-highlight');
      setRightSidebarOpen(true);
      setSidebarTab('comments');
      setCommentsCollapsed(false);
      setActiveSidebarCommentId(id);
      setSidebarPanel(null);
      scrollSidebarItemIntoView(`.rightSidebar [data-comment-id="${id}"]`);
    },
    [setActiveSidebarCommentId, setCommentsCollapsed, setRightSidebarOpen, setSidebarPanel, setSidebarTab],
  );

  useEffect(() => {
    if (!expandedCueId) return undefined;

    const handleDocClick = (event: MouseEvent) => {
      const card = document.querySelector(`.rightSidebar [data-cue-id="${expandedCueId}"]`);
      const target = event.target as Node | null;
      if (!card || !target) return;

      if (sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === expandedCueId) {
        return;
      }

      if (!card.contains(target)) {
        setExpandedCueId(null);
      }
    };

    document.addEventListener('click', handleDocClick, true);
    return () => document.removeEventListener('click', handleDocClick, true);
  }, [expandedCueId, sidebarPanel, setExpandedCueId]);

  useEffect(() => {
    debugLog('[Editor] showRuler state changed:', showRuler);
  }, [debugLog, showRuler]);

  useEffect(() => {
    debugLog('[Editor] viewMode changed to:', viewMode);
  }, [debugLog, viewMode]);

  useEffect(() => {
    if (!editor) return;

    const timer = window.setTimeout(() => {
      try {
        const container = document.querySelector('.singlePageContainer') as HTMLElement | null;
        if (container) {
          container.scrollTop = 0;
        }
        window.scrollTo({ top: 0, behavior: 'auto' });
      } catch {
        /* no-op */
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [editor, scriptId, isYjsSynced]);

  useEffect(() => {
    const handler = () => setRulerOverlayActive(prev => !prev);
    window.addEventListener('fassandra:toggle-ruler-overlay', handler as EventListener);
    return () => {
      window.removeEventListener('fassandra:toggle-ruler-overlay', handler as EventListener);
    };
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => (prev === 'single-page' ? 'borderless' : 'single-page'));
  }, []);

  const layoutValue = useMemo<EditorLayoutValue>(
    () => ({
      viewMode,
      setViewMode,
      toggleViewMode,
      showRuler,
      setShowRuler,
      pageNumber,
      pageCount,
      showCues,
      setShowCues,
      showStruckDialogue,
      setShowStruckDialogue,
      rulerOverlayActive,
      setRulerOverlayActive,
      rightSidebarOpen,
      setRightSidebarOpen,
    }),
    [
      viewMode,
      toggleViewMode,
      showRuler,
      pageNumber,
      pageCount,
      showCues,
      showStruckDialogue,
      rulerOverlayActive,
      rightSidebarOpen,
    ],
  );

  const rehearsalValue = useMemo<EditorRehearsalValue>(
    () => ({
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
      startAutoFollow,
      stopAutoFollow,
      lastAsrText,
      adoptRemotePosition,
    }),
    [
      rehearsalMode,
      setRehearsalMode,
      rehearsalLinePosition,
      setRehearsalLinePosition,
      rehearsalDocPos,
      rehearsalWordBox,
      suppressRehearsalAutoScroll,
      setShouldCenterOnRehearsalChange,
      pendingCenterRef,
      isApplyingRemoteRehearsalRef,
      autoFollowActive,
      startAutoFollow,
      stopAutoFollow,
      lastAsrText,
      adoptRemotePosition,
    ],
  );

  const speakerValue = useMemo<EditorSpeakerValue>(
    () => ({
      editAllSpeakers,
      setEditAllSpeakers,
      currentSpeakerName,
      setCurrentSpeakerName,
      liveRenameBaseRef,
      availableSpeakers,
    }),
    [
      editAllSpeakers,
      setEditAllSpeakers,
      currentSpeakerName,
      setCurrentSpeakerName,
      liveRenameBaseRef,
      availableSpeakers,
    ],
  );

  const contextMenuValue = useMemo<EditorContextMenuValue>(
    () => ({
      contextMenu,
      insertSubmenu,
      handleContextMenu,
      handleContextMenuAction,
      openInsertSubmenu,
      closeInsertSubmenu,
      closeContextMenu,
      hideContextMenu,
      showContextMenu,
      editorHasSelection,
    }),
    [
      contextMenu,
      insertSubmenu,
      handleContextMenu,
      handleContextMenuAction,
      openInsertSubmenu,
      closeInsertSubmenu,
      closeContextMenu,
      hideContextMenu,
      showContextMenu,
      editorHasSelection,
    ],
  );

  const sidebarValue = useMemo<EditorSidebarValue>(
    () => ({
      sidebarTab,
      setSidebarTab,
      sidebarScenes,
      activeSidebarSceneId,
      setActiveSidebarSceneId,
      sidebarPanel,
      setSidebarPanel,
      cuesCollapsed,
      setCuesCollapsed,
      sidebarCues,
      cueFilters,
      setCueFilters,
      activeSidebarCueId,
      setActiveSidebarCueId,
      expandedCueId,
      setExpandedCueId,
      cueDescriptions,
      setCueDescriptions,
      commentsCollapsed,
      setCommentsCollapsed,
      sidebarComments,
      activeSidebarCommentId,
      setActiveSidebarCommentId,
      handleCueOpen,
      handleCommentOpen,
    }),
    [
      sidebarTab,
      setSidebarTab,
      sidebarScenes,
      activeSidebarSceneId,
      setActiveSidebarSceneId,
      sidebarPanel,
      setSidebarPanel,
      cuesCollapsed,
      setCuesCollapsed,
      sidebarCues,
      cueFilters,
      setCueFilters,
      activeSidebarCueId,
      setActiveSidebarCueId,
      expandedCueId,
      setExpandedCueId,
      cueDescriptions,
      setCueDescriptions,
      commentsCollapsed,
      setCommentsCollapsed,
      sidebarComments,
      activeSidebarCommentId,
      setActiveSidebarCommentId,
      handleCueOpen,
      handleCommentOpen,
    ],
  );

  return (
    <EditorLayoutContext.Provider value={layoutValue}>
      <EditorRehearsalContext.Provider value={rehearsalValue}>
        <EditorSpeakerContext.Provider value={speakerValue}>
          <EditorContextMenuContext.Provider value={contextMenuValue}>
            <EditorSidebarContext.Provider value={sidebarValue}>
              {children}
            </EditorSidebarContext.Provider>
          </EditorContextMenuContext.Provider>
        </EditorSpeakerContext.Provider>
      </EditorRehearsalContext.Provider>
    </EditorLayoutContext.Provider>
  );
};

export const useEditorLayout = (): EditorLayoutValue => {
  const context = useContext(EditorLayoutContext);
  if (!context) {
    throw new Error('useEditorLayout must be used within an EditorUiProvider');
  }
  return context;
};

export const useEditorRehearsal = (): EditorRehearsalValue => {
  const context = useContext(EditorRehearsalContext);
  if (!context) {
    throw new Error('useEditorRehearsal must be used within an EditorUiProvider');
  }
  return context;
};

export const useEditorSpeakers = (): EditorSpeakerValue => {
  const context = useContext(EditorSpeakerContext);
  if (!context) {
    throw new Error('useEditorSpeakers must be used within an EditorUiProvider');
  }
  return context;
};

export const useEditorContextMenuState = (): EditorContextMenuValue => {
  const context = useContext(EditorContextMenuContext);
  if (!context) {
    throw new Error('useEditorContextMenuState must be used within an EditorUiProvider');
  }
  return context;
};

export const useEditorSidebar = (): EditorSidebarValue => {
  const context = useContext(EditorSidebarContext);
  if (!context) {
    throw new Error('useEditorSidebar must be used within an EditorUiProvider');
  }
  return context;
};
