import React, { useState, useEffect } from 'react';
import type { JSX } from 'react';
import { useAuth } from './AuthContext'
import { Login } from './components/Login'
import { Register } from './components/Register'
import { ScriptList } from './components/ScriptList'
import { Editor } from './components/editor'
import ScriptUploader from './components/ScriptUploader'
import { Header } from './components/Header';

import './App.css'

/**
 * Props for the main application component.
 */
interface AppProps {
  // No props expected for the root App component
}

/**
 * Defines the possible view states of the application.
 */
type AppView = 'auth' | 'scripts' | 'editor';

/**
 * Main application component.
 *
 * Manages routing between authentication, script listing, and editor views.
 * Handles conditional rendering based on authentication state and selected script.
 *
 * @component
 * @returns {JSX.Element} The rendered application
 */
function App(): JSX.Element {
  const { token } = useAuth()
  const [currentView, setCurrentView] = useState<AppView>('scripts')
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null)
  const [selectedScriptTitle, setSelectedScriptTitle] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(true)
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // const [count, setCount] = useState(0) // Removed unused count state

  // Effect to handle view transition after login/logout
  useEffect(() => {
    // If we just received a token (logged in) and are still on the auth view,
    // switch to the scripts view.
    if (token && currentView === 'auth') {
      setCurrentView('scripts');
      // Set initial browser history state
      window.history.replaceState({ view: 'scripts' }, '', '/scripts');
    }
    // If the token disappears (logged out) while in editor or scripts view,
    // force back to auth view.
    else if (!token && (currentView === 'editor' || currentView === 'scripts')) {
      setCurrentView('auth');
      setSelectedScriptId(null); // Clear selected script on logout
      setSelectedScriptTitle(null); // Clear selected script title on logout
      window.history.replaceState({ view: 'auth' }, '', '/');
    }
  }, [token, currentView]); // Depend on token and currentView

  // Callback function to navigate after script creation
  const handleScriptCreated = (newScriptId: string) => {
    setSelectedScriptId(newScriptId);
    setCurrentView('editor');
    setIsUploaderOpen(false); // Close modal on success
    
    // Update browser history for new script
    window.history.pushState(
      { view: 'editor', scriptId: newScriptId, scriptTitle: 'New Script' }, 
      '', 
      `/editor/${newScriptId}`
    );
  };

  // Function to navigate back to scripts
  const handleNavigateToScripts = (skipHistoryUpdate = false) => {
    // This starts the typewriter animation by changing the target text
    setSelectedScriptTitle(null);
    
    // Update browser history only if not called from popstate
    if (!skipHistoryUpdate) {
      window.history.pushState({ view: 'scripts' }, '', '/scripts');
    }
    
    // By delaying the view change, we allow the CSS transitions to catch the class changes.
    requestAnimationFrame(() => {
      setCurrentView('scripts');
      setSelectedScriptId(null);
    });
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      
      if (!token) {
        // If not logged in, stay on auth page
        return;
      }
      
      if (state?.view === 'scripts' || !state) {
        // Go back to scripts view with animation if currently in editor
        if (currentView === 'editor') {
          handleNavigateToScripts(true); // Skip history update since we're responding to popstate
        } else {
          // Direct navigation if not coming from editor
          setCurrentView('scripts');
          setSelectedScriptId(null);
          setSelectedScriptTitle(null);
        }
      } else if (state?.view === 'editor' && state?.scriptId) {
        // Go to editor view with specific script
        setCurrentView('editor');
        setSelectedScriptId(state.scriptId);
        setSelectedScriptTitle(state.scriptTitle || null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [token, currentView, handleNavigateToScripts]);

  // Function to start breadcrumb animation immediately
  const handleScriptClickStart = (scriptTitle: string) => {
    setSelectedScriptTitle(scriptTitle);
    setCurrentView('editor');
  };

  // Function to navigate to editor with history management
  const handleNavigateToEditor = (scriptId: string, scriptTitle: string) => {
    setSelectedScriptId(scriptId);
    setSelectedScriptTitle(scriptTitle);
    setCurrentView('editor');
    
    // Update browser history
    window.history.pushState(
      { view: 'editor', scriptId, scriptTitle }, 
      '', 
      `/editor/${scriptId}`
    );
  };

  // Function to handle thumbnail refresh
  const handleThumbnailsRefreshed = () => {
    // Trigger a refresh in the ScriptList component
    setRefreshTrigger(prev => prev + 1);
  };

  // Determine view based on auth state
  let viewComponent
  if (!token) {
    // Show Login or Register if not authenticated
    if (currentView !== 'auth') setCurrentView('auth')
    viewComponent = showLogin ? (
      <>
        <Login />
        <button onClick={() => setShowLogin(false)}>Go to Register</button>
      </>
    ) : (
      <>
        <Register />
        <button onClick={() => setShowLogin(true)}>Go to Login</button>
      </>
    )
  } else if (currentView === 'scripts' || !selectedScriptId) {
    // Show Script List if logged in and no script selected (or explicitly viewing list)
    if (selectedScriptId) setSelectedScriptId(null);
    viewComponent = (
      <ScriptList
        onSelectScript={handleNavigateToEditor}
        onUploadClick={() => setIsUploaderOpen(true)}
        onScriptClickStart={handleScriptClickStart}
        refreshTrigger={refreshTrigger}
      />
    );
  } else if (currentView === 'editor' && selectedScriptId) {
    // Show Editor view if script is selected
    viewComponent = (
      <div>
        <Editor
          scriptId={selectedScriptId}
          initialTitle={selectedScriptTitle || undefined}
          onNavigateBack={handleNavigateToScripts}
        />
      </div>
    );
  } else {
    // Default to script list if logged in but state is inconsistent
    if (token) {
        // This state should be transient, e.g., right after login before useEffect runs.
        // We force the view to the script list.
        setCurrentView('scripts');
        if (selectedScriptId) {
            setSelectedScriptId(null);
        }
    } else {
        // This case should ideally not be hit if !token is handled above,
        // but as a safeguard, we force the auth view.
        setCurrentView('auth');
    }
    viewComponent = <p>Loading...</p>
  }

  return (
    <div className="App">
      {token && (
        <Header 
          currentView={currentView === 'auth' ? 'scripts' : currentView}
          scriptTitle={selectedScriptTitle || undefined}
          onNavigateToScripts={handleNavigateToScripts}
          onThumbnailsRefreshed={handleThumbnailsRefreshed}
        />
      )}

      <main className="appContent">
        {viewComponent}
        
        {token && isUploaderOpen && (
          <ScriptUploader 
            onScriptCreated={handleScriptCreated} 
            onClose={() => setIsUploaderOpen(false)} 
          />
        )}
      </main>
    </div>
  )
}

export default App