import React, { useEffect, useRef, Profiler } from 'react';
import type { JSX } from 'react';
import { useAuth } from './AuthContext'
import { onRenderCallback } from './utils/profiling'
import { Login } from './components/Login'
import { Register } from './components/Register'
// Use the new refactored ScriptList
import { ScriptList, ScriptListRef } from './components/scripts/ScriptList'
import { Editor } from './components/editor'
import ScriptUploader from './components/ScriptUploader'
import { PlaceholderScript } from './types'
import { Header } from './components/Header';
import { getScriptWithBlocks } from './api';
import { YjsDocumentProvider } from './contexts/YjsDocumentContext';
import { logDebugInfo } from './utils/debug';
import ErrorBoundary from './components/ErrorBoundary';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import logger from './services/LoggingService';
import { useRouting } from './hooks/useRouting';
import { useUIState } from './hooks/useUIState';

import './App.css'
// import './styles/ErrorBoundary.css'
// import './styles/ErrorFallbacks.css'


/**
 * Main application component.
 *
 * Manages routing between authentication, script listing, and editor views.
 * Handles conditional rendering based on authentication state and selected script.
 * Supports URL-based routing with proper authentication checks.
 *
 * @component
 * @returns {JSX.Element} The rendered application
 */
function App(): JSX.Element {
  const { token } = useAuth()
  const {
    currentView,
    selectedScriptId,
    selectedScriptTitle,
    navigateToScripts,
    navigateToEditor,
    updateEditorTitle
  } = useRouting();
  const {
    isUploaderOpen,
    showLogin,
    refreshTrigger,
    openUploader,
    closeUploader,
    setShowLogin,
    triggerRefresh
  } = useUIState();
  
  // 🚀 FIXED: Use correct ScriptListRef type
  const scriptListRef = useRef<ScriptListRef>(null);
  
  // Fetch script title when refreshing editor page without title in URL
  useEffect(() => {
    if (currentView === 'editor' && selectedScriptId && !selectedScriptTitle && token) {
      // Fetch script details to get the title
      getScriptWithBlocks(selectedScriptId)
        .then(scriptData => {
          if (scriptData && scriptData.script && scriptData.script.title) {
            updateEditorTitle(selectedScriptId, scriptData.script.title);
          }
        })
        .catch(error => {
          logger.error('App', '[App] Failed to fetch script title:', error);
          // Set a fallback title if fetch fails
          updateEditorTitle(selectedScriptId, 'Untitled Script');
        });
    }
  }, [currentView, selectedScriptId, selectedScriptTitle, token, updateEditorTitle]);

  // Callback function to navigate after script creation
  const handleScriptCreated = (newScriptId: string) => {
    closeUploader(); // Close modal on success
    navigateToEditor(newScriptId, 'New Script');
  };

  // 🚀 FIXED: Handle background upload start with correct type
  const handleBackgroundUploadStart = (placeholder: PlaceholderScript) => {
    if (import.meta.env.DEV) {
      logDebugInfo('App', `Background upload started for: ${placeholder.title}`);
    }
    
    // Close uploader modal immediately for better UX
    closeUploader();
    
    // Pass the placeholder to ScriptList component
    if (scriptListRef.current) {
      scriptListRef.current.addUploadPlaceholder(placeholder);
      if (import.meta.env.DEV) {
        logDebugInfo('App', 'Placeholder passed to ScriptList');
      }
    } else {
      logger.error('App', '[App] ScriptList ref not available for background upload');
    }
    
    if (import.meta.env.DEV) {
      logDebugInfo('App', 'Modal closed, upload continuing in background');
    }
  };

  // Function to navigate back to scripts
  const handleNavigateToScripts = () => {
    navigateToScripts();
  };

  // Browser back/forward is now handled by the routing service

  // Function to start breadcrumb animation immediately
  const handleScriptClickStart = (_scriptTitle: string) => {
    // This will be handled by navigateToEditor
  };

  // Function to navigate to editor with history management
  const handleNavigateToEditor = (scriptId: string, scriptTitle: string) => {
    navigateToEditor(scriptId, scriptTitle);
  };

  // Function to handle thumbnail refresh
  const handleThumbnailsRefreshed = () => {
    // Trigger a refresh in the ScriptList component
    triggerRefresh();
  };

  // Determine view based on auth state
  let viewComponent
  if (!token) {
    // Show Login or Register if not authenticated
    viewComponent = (
      <RouteErrorBoundary routeName="Authentication">
        {showLogin ? (
          <>
            <Login />
            <button onClick={() => setShowLogin(false)}>Go to Register</button>
          </>
        ) : (
          <>
            <Register />
            <button onClick={() => setShowLogin(true)}>Go to Login</button>
          </>
        )}
      </RouteErrorBoundary>
    )
  } else if (currentView === 'scripts') {
    // Show Script List if logged in and viewing scripts
    viewComponent = (
      <RouteErrorBoundary routeName="Script List">
        <Profiler id="ScriptList" onRender={onRenderCallback}>
          <ScriptList
            ref={scriptListRef}
            onSelectScript={handleNavigateToEditor}
            onUploadClick={openUploader}
            onScriptClickStart={handleScriptClickStart}
            refreshTrigger={refreshTrigger}
          />
        </Profiler>
      </RouteErrorBoundary>
    );
  } else if (currentView === 'editor' && selectedScriptId) {
    // Show Editor view if script is selected
    viewComponent = (
      <RouteErrorBoundary routeName="Editor">
        <div>
          <Profiler id="Editor" onRender={onRenderCallback}>
            <Editor
              scriptId={selectedScriptId}
              initialTitle={selectedScriptTitle || undefined}
              onNavigateBack={handleNavigateToScripts}
            />
          </Profiler>
        </div>
      </RouteErrorBoundary>
    );
  } else {
    // Loading state - routing is being initialized
    viewComponent = <p>Loading...</p>
  }

  return (
    <ErrorBoundary 
      level="page" 
      onError={(error, errorInfo) => {
        logger.error('App', 'Global error boundary caught an error', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack
        });
      }}
      showDetails={import.meta.env.DEV}
    >
      <YjsDocumentProvider>
        <div className="App">
          {token && (
            <ErrorBoundary level="section" isolate={true}>
              <Profiler id="Header" onRender={onRenderCallback}>
                <Header 
                  currentView={currentView === 'auth' ? 'scripts' : currentView}
                  scriptTitle={selectedScriptTitle || undefined}
                  onNavigateToScripts={handleNavigateToScripts}
                  onThumbnailsRefreshed={handleThumbnailsRefreshed}
                />
              </Profiler>
            </ErrorBoundary>
          )}

          <main className="appContent">
            {viewComponent}
            
            {token && isUploaderOpen && (
              <ErrorBoundary level="component" isolate={true}>
                <ScriptUploader 
                  onScriptCreated={handleScriptCreated} 
                  onClose={closeUploader}
                  onBackgroundUploadStart={handleBackgroundUploadStart}
                />
              </ErrorBoundary>
            )}
          </main>
        </div>
      </YjsDocumentProvider>
    </ErrorBoundary>
  )
}

export default App