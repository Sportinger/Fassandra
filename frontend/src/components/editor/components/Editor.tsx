import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { EditorProps, ViewMode } from '../types';
import { EditorContent } from './EditorContent';
import { EditorShell } from './EditorShell';
import { RightSidebar } from './RightSidebar';
import { useEditorPages } from '../hooks/useEditorPages';
import { useSpeakerSelection } from '../hooks/useSpeakerSelection';
import { useBorderlessSpeakerInteractions } from '../hooks/useBorderlessSpeakerInteractions';
import { useEditorContextMenu } from '../hooks/useEditorContextMenu';
import { EditorContextMenu } from './context-menu/EditorContextMenu';
import { highlightAndScroll, scrollSidebarItemIntoView } from '../utils/domHelpers';

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
  const { pageNumber, pageCount } = useEditorPages(editor);
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
  const {
    editAllSpeakers,
    setEditAllSpeakers,
    currentSpeakerName,
    setCurrentSpeakerName,
    liveRenameBaseRef,
  } = useSpeakerSelection(editor);
  const {
    contextMenu: localContextMenu,
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
  const [rulerOverlayActive, setRulerOverlayActive] = useState(false);
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

  const editorHasSelection = Boolean(editor?.state?.selection && !editor.state.selection.empty);

  const handleCueOpen = useCallback((payload: { cueId: string }) => {
    highlightAndScroll(`.cue-connection[data-cue-id="${payload.cueId}"]`, 'hover-highlight');
    setRightSidebarOpen(true);
    setSidebarTab('cues');
    setCuesCollapsed(false);
    setActiveSidebarCueId(payload.cueId);
    setSidebarPanel(null);
    scrollSidebarItemIntoView(`.rightSidebar [data-cue-id="${payload.cueId}"]`);
  }, [setRightSidebarOpen, setCuesCollapsed, setActiveSidebarCueId, setSidebarPanel]);

  const handleCommentOpen = useCallback(({ id }: { id: string; text: string }) => {
    highlightAndScroll(`.comment-annotation[data-comment-id="${id}"]`, 'connected-highlight');
    setRightSidebarOpen(true);
    setSidebarTab('comments');
    setCommentsCollapsed(false);
    setActiveSidebarCommentId(id);
    setSidebarPanel(null);
    scrollSidebarItemIntoView(`.rightSidebar [data-comment-id="${id}"]`);
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

  // Debug ruler state
  useEffect(() => {
    debugLog('[Editor] showRuler state changed:', showRuler);
  }, [showRuler, debugLog]);
  
  // Debug view mode changes
  useEffect(() => {
    debugLog('[Editor] viewMode changed to:', viewMode);
  }, [viewMode, debugLog]);


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
            closeContextMenu={closeContextMenu}
            debugLog={debugLog}
            editAllSpeakers={editAllSpeakers}
            setEditAllSpeakers={setEditAllSpeakers}
            setCurrentSpeakerName={setCurrentSpeakerName}
            liveRenameBaseRef={liveRenameBaseRef}
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
                <RulerOverlay active={rulerOverlayActive} onClose={() => setRulerOverlayActive(false)} />
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
            closeContextMenu={closeContextMenu}
            debugLog={debugLog}
            editAllSpeakers={editAllSpeakers}
            setEditAllSpeakers={setEditAllSpeakers}
            setCurrentSpeakerName={setCurrentSpeakerName}
            liveRenameBaseRef={liveRenameBaseRef}
            hideContextMenu={hideContextMenu}
            showContextMenu={showContextMenu}
          />
        </SinglePageView>
      )}

      <EditorContextMenu
        menu={localContextMenu}
        insertMenu={insertSubmenu}
        rehearsalMode={rehearsalMode}
        viewMode={viewMode}
        editorHasSelection={editorHasSelection}
        onAction={handleContextMenuAction}
        onInsertOpen={openInsertSubmenu}
        onInsertClose={closeInsertSubmenu}
      />

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
