import React, { useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../../../AuthContext';
import { useEditorCore } from '../hooks/useEditorCore';
import { EditorUiProvider } from '../contexts/EditorUiContext';
import { EditorView } from './EditorView';
import { LoadingSpinner } from './ui/LoadingSpinner';
import type { EditorProps } from '../types';

export const Editor: React.FC<EditorProps> = ({
  scriptId,
  initialTitle,
  onNavigateBack,
}) => {
  const { token, user, tokenReady } = useAuth();

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
    savingStatus,
    lastSaved,
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
      <EditorView
        editor={editor}
        provider={provider}
        ydoc={ydoc}
        connectionStatus={connectionStatus}
        initialTitle={initialTitle}
        onNavigateBack={handleAnimatedNavigation}
        activeUserCount={activeUserCount}
        toolbarContext={toolbarContext}
        debugLog={debugLog}
        savingStatus={savingStatus}
        lastSaved={lastSaved}
      />
    </EditorUiProvider>
  );
};
