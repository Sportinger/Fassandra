import React, { useCallback, useEffect, useState } from 'react';
import type { Editor as TipTapEditor } from '@tiptap/react';
import type { WebsocketProvider } from 'y-websocket';
import type * as Y from 'yjs';

import { Header } from '../../Header';
import { EditorShell } from './EditorShell';
import { BorderlessView, SinglePageView } from '../ViewModes';
import { FloatingCuesLayer } from './FloatingCuesLayer';
import { CueConnectors } from './CueConnectors';
import { FloatingCommentsLayer } from './FloatingCommentsLayer';
import { useToolbarKeyboard } from './toolbar/hooks/useToolbarKeyboard';
import RulerOverlay from './RulerOverlay';
import { EditorContent } from './EditorContent';
import { EditorContextMenu } from './context-menu/EditorContextMenu';
import { Toolbar } from './toolbar/Toolbar';
import { RightSidebar } from './RightSidebar';
import { SavingIndicator } from './ui/SavingIndicator';
import { AIFormatModal } from './AIFormatModal';
import {
  useEditorLayout,
  useEditorRehearsal,
  useEditorSidebar,
  useEditorContextMenuState,
  useEditorSpeakers,
} from '../contexts/EditorUiContext';
import type { ConnectionStatus, ToolbarContext } from '../types';

import '../styles/variables.css';
import '../styles/responsive.css';
import '../styles/toolbar.css';
import '../styles/cue-blocks.css';
import '../styles/scene-blocks.css';
import '../styles/search.css';
import '../styles/cue-connections.css';
import '../styles/rehearsal-line.css';
import '../styles/floating-cues.css';
import '../styles/ruler-overlay.css';
import '../styles/comments.css';
import '../styles/print.css';
import '../styles/right-sidebar.css';

interface EditorViewProps {
  editor: TipTapEditor | null;
  provider: WebsocketProvider | null;
  ydoc: Y.Doc | null;
  connectionStatus: ConnectionStatus;
  initialTitle: string | undefined;
  onNavigateBack: () => void;
  activeUserCount: number;
  toolbarContext: ToolbarContext;
  debugLog: (...args: any[]) => void;
  savingStatus?: 'saved' | 'saving' | 'error';
  lastSaved?: Date | null;
  scriptId?: string;
}

export const EditorView: React.FC<EditorViewProps> = ({
  editor,
  provider,
  ydoc,
  connectionStatus,
  initialTitle,
  onNavigateBack,
  activeUserCount,
  toolbarContext,
  debugLog,
  savingStatus = 'saved',
  lastSaved = null,
  scriptId,
}) => {
  const {
    viewMode,
    setViewMode,
    toggleViewMode,
    showRuler,
    setShowRuler,
    showCues,
    rulerOverlayActive,
    setRulerOverlayActive,
    rightSidebarOpen,
    setRightSidebarOpen,
  } = useEditorLayout();

  const { windowWidth } = useToolbarKeyboard(editor);
  const isMobile = windowWidth <= 767;

  // AI Format modal state
  const [aiFormatModalOpen, setAiFormatModalOpen] = useState(false);

  // Listen for AI format button click event
  useEffect(() => {
    const handleOpenAIFormatModal = () => {
      setAiFormatModalOpen(true);
    };
    window.addEventListener('fassandra:open-ai-format-modal', handleOpenAIFormatModal);
    return () => {
      window.removeEventListener('fassandra:open-ai-format-modal', handleOpenAIFormatModal);
    };
  }, []);

  const handleCloseAIFormatModal = useCallback(() => {
    setAiFormatModalOpen(false);
  }, []);

  const { rehearsalMode, rehearsalLinePosition, rehearsalWordBox } = useEditorRehearsal();

  const {
    editAllSpeakers,
    setEditAllSpeakers,
    setCurrentSpeakerName,
    liveRenameBaseRef,
  } = useEditorSpeakers();

  const {
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
  } = useEditorContextMenuState();

  const {
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
  } = useEditorSidebar();

  const handleOutsideClick = () => {
    try {
      if (editor) {
        const { state } = editor;
        const { selection } = state;
        if (selection && !selection.empty) {
          const pos = selection.head;
          editor.chain().setTextSelection(pos).run();
        }
        editor.commands.blur();
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
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    hideContextMenu();
    setEditAllSpeakers(false);
    setCurrentSpeakerName(null);
  };

  return (
    <EditorShell
      header={(
        <Header
          currentView="editor"
          scriptTitle={initialTitle}
          onNavigateToScripts={onNavigateBack}
          layouts={[]}
          currentLayout={null}
          onLayoutChange={() => {}}
          onCreateNewLayout={async () => {}}
          onSaveLayout={async () => {}}
          activeUserCount={activeUserCount}
          connectionStatus={connectionStatus}
          savingIndicator={<SavingIndicator status={savingStatus} lastSaved={lastSaved} />}
        />
      )}
    >
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
                {showCues && (
                  <>
                    {isMobile ? (
                      <FloatingCuesLayer editor={editor} onOpenCue={handleCueOpen} />
                    ) : (
                      <CueConnectors editor={editor} expandedCueId={expandedCueId} />
                    )}
                  </>
                )}
                <FloatingCommentsLayer editor={editor} onOpenComment={handleCommentOpen} />
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
          onToggleRuler={() => setShowRuler(!showRuler)}
          onToggleViewMode={toggleViewMode}
          rehearsalMode={rehearsalMode}
          rehearsalLinePosition={rehearsalLinePosition}
          overlay={
            editor ? (
              <>
                {showCues && (
                  <>
                    {isMobile ? (
                      <FloatingCuesLayer editor={editor} onOpenCue={handleCueOpen} />
                    ) : (
                      <CueConnectors editor={editor} expandedCueId={expandedCueId} />
                    )}
                  </>
                )}
                <RulerOverlay active={rulerOverlayActive} onClose={() => setRulerOverlayActive(false)} />
                <FloatingCommentsLayer editor={editor} onOpenComment={handleCommentOpen} />
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
          onOutsideClick={handleOutsideClick}
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
        menu={contextMenu}
        insertMenu={insertSubmenu}
        rehearsalMode={rehearsalMode}
        viewMode={viewMode}
        editorHasSelection={editorHasSelection}
        onAction={handleContextMenuAction}
        onInsertOpen={openInsertSubmenu}
        onInsertClose={closeInsertSubmenu}
      />

      <Toolbar
        editor={editor}
        context={toolbarContext}
      />

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

      <AIFormatModal
        editor={editor}
        isOpen={aiFormatModalOpen}
        onClose={handleCloseAIFormatModal}
        scriptId={scriptId}
      />
    </EditorShell>
  );
};
