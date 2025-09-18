import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../AuthContext';
import { useEditorCore } from '../hooks/useEditorCore';
import { EditorUiProvider } from '../contexts/EditorUiContext';
import { LoadingSpinner } from './ui/LoadingSpinner';
import type { EditorProps } from '../types';
import { Header } from '../../Header';
import { EditorShell } from './EditorShell';
import { WorkspaceTabs } from './workspace/WorkspaceTabs';
import { WorkspaceContainer } from './workspace/WorkspaceContainer';
import type { WorkspaceMode } from './workspace/types';

import '../styles/responsive.css';

export const Editor: React.FC<EditorProps> = ({
  scriptId,
  initialTitle,
  onNavigateBack,
}) => {
  const { token, user, tokenReady } = useAuth();
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('editor');

  const debugLog = useMemo(() => {
    return process.env.NODE_ENV === 'development' ? console.log : () => {};
  }, []);

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

  const handleAnimatedNavigation = useCallback(() => {
    const pageElement = document.querySelector('.dinA4Page');
    if (pageElement) {
      pageElement.classList.add('exiting');
    }

    setTimeout(() => {
      onNavigateBack();
    }, 100);
  }, [onNavigateBack]);

  useEffect(() => {
    const handlePopState = (_event: PopStateEvent) => {
      handleAnimatedNavigation();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleAnimatedNavigation]);

  if (!token || !user || !tokenReady) {
    return (
      <div className="editorContainer">
        <LoadingSpinner size="lg" />
        <p>Authenticating...</p>
      </div>
    );
  }

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

  const headerNode = (
    <Header
      currentView="editor"
      scriptTitle={initialTitle}
      onNavigateToScripts={handleAnimatedNavigation}
      layouts={[]}
      currentLayout={null}
      onLayoutChange={() => {}}
      onCreateNewLayout={async () => {}}
      onSaveLayout={async () => {}}
      activeUserCount={activeUserCount}
      connectionStatus={connectionStatus}
    />
  );

  return (
    <EditorUiProvider
      editor={editor}
      provider={provider}
      scriptId={scriptId}
      token={token}
      availableSpeakers={availableSpeakers}
      debugLog={debugLog}
      showContextMenu={showContextMenu}
      hideContextMenu={hideContextMenu}
      isYjsSynced={isYjsSynced}
    >
      <EditorShell header={headerNode}>
        <WorkspaceTabs mode={workspaceMode} onChange={setWorkspaceMode} />
        <WorkspaceContainer
          mode={workspaceMode}
          editor={editor}
          provider={provider}
          ydoc={ydoc}
          connectionStatus={connectionStatus}
          toolbarContext={toolbarContext}
          debugLog={debugLog}
        />
      </EditorShell>
    </EditorUiProvider>
  );
};
