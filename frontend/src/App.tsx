import React, { useState, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { useAuth } from './AuthContext'
import { Login } from './components/Login'
import { Register } from './components/Register'
import { ScriptList, ScriptListRef } from './components/ScriptList' // Import ref type
import { Editor } from './components/editor'
import ScriptUploader from './components/ScriptUploader'
import { PlaceholderScript } from './types'
import { Header } from './components/Header';
import { Script } from './types'; // Import Script type

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
 * Checks if user is authenticated by looking directly at storage
 * @returns boolean indicating if user has a stored auth token
 */
function hasStoredAuth(): boolean {
  return !!(sessionStorage.getItem('authToken') || localStorage.getItem('authToken'));
}

/**
 * Parses the current URL path to determine the initial view and script ID.
 * @returns Object with view, scriptId, and scriptTitle
 */
function parseCurrentRoute(): { view: AppView; scriptId: string | null; scriptTitle: string | null } {
  const path = window.location.pathname;
  
  // Parse editor routes like /editor/123 or /editor/123/title
  const editorMatch = path.match(/^\/editor\/([^\/]+)(?:\/(.+))?/);
  if (editorMatch) {
    return {
      view: 'editor',
      scriptId: editorMatch[1],
      scriptTitle: editorMatch[2] ? decodeURIComponent(editorMatch[2]) : null
    };
  }
  
  // Scripts route
  if (path === '/scripts' || path === '/scripts/') {
    return { view: 'scripts', scriptId: null, scriptTitle: null };
  }
  
  // Root path - default to scripts if we have a token, auth if not
  if (path === '/' || path === '') {
    return { view: 'scripts', scriptId: null, scriptTitle: null };
  }
  
  // Unknown routes default to scripts
  return { view: 'scripts', scriptId: null, scriptTitle: null };
}

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
  
  // 🔧 FIXED: Initialize view state based on current URL and stored auth status
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const route = parseCurrentRoute();
    const isAuthenticated = hasStoredAuth();
    // If no stored token, always start with auth view regardless of URL
    return isAuthenticated ? route.view : 'auth';
  });
  
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(() => {
    const route = parseCurrentRoute();
    const isAuthenticated = hasStoredAuth();
    return isAuthenticated ? route.scriptId : null;
  });
  
  const [selectedScriptTitle, setSelectedScriptTitle] = useState<string | null>(() => {
    const route = parseCurrentRoute();
    const isAuthenticated = hasStoredAuth();
    return isAuthenticated ? route.scriptTitle : null;
  });
  
  const [showLogin, setShowLogin] = useState(true)
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // 🚀 FIXED: Use correct ScriptListRef type
  const scriptListRef = useRef<ScriptListRef>(null);

  // 🔧 NEW: Effect to handle URL-based route initialization on auth state change
  useEffect(() => {
    if (token) {
      // User is authenticated - check if we should restore URL-based route
      const route = parseCurrentRoute();
      
      if (currentView === 'auth') {
        // Just logged in - navigate to the intended route or scripts
        setCurrentView(route.view);
        setSelectedScriptId(route.scriptId);
        setSelectedScriptTitle(route.scriptTitle);
        
        // Update URL to match the intended destination
        if (route.view === 'editor' && route.scriptId) {
          const url = route.scriptTitle 
            ? `/editor/${route.scriptId}/${encodeURIComponent(route.scriptTitle)}`
            : `/editor/${route.scriptId}`;
          window.history.replaceState(
            { view: 'editor', scriptId: route.scriptId, scriptTitle: route.scriptTitle }, 
            '', 
            url
          );
        } else {
          // 🔧 FIXED: Redirect to /scripts/ after login, not base URL
          window.history.replaceState({ view: 'scripts' }, '', '/scripts/');
        }
      }
    } else {
      // User is not authenticated - force to auth view and clear state
      if (currentView !== 'auth') {
        setCurrentView('auth');
        setSelectedScriptId(null);
        setSelectedScriptTitle(null);
        window.history.replaceState({ view: 'auth' }, '', '/');
      }
    }
  }, [token]); // Only depend on token changes

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

  // 🚀 FIXED: Handle background upload start with correct type
  const handleBackgroundUploadStart = (placeholder: PlaceholderScript) => {
    console.log('[App] Background upload started for:', placeholder.title);
    
    // Close uploader modal immediately for better UX
    setIsUploaderOpen(false);
    
    // Pass the placeholder to ScriptList component
    if (scriptListRef.current) {
      scriptListRef.current.addUploadPlaceholder(placeholder);
      console.log('[App] ✅ Placeholder passed to ScriptList');
    } else {
      console.error('[App] ScriptList ref not available for background upload');
    }
    
    console.log('[App] ✅ Modal closed, upload continuing in background');
  };

  // Function to navigate back to scripts
  const handleNavigateToScripts = (skipHistoryUpdate = false) => {
    // This starts the typewriter animation by changing the target text
    setSelectedScriptTitle(null);
    
    // Update browser history only if not called from popstate
    if (!skipHistoryUpdate) {
      // 🔧 RESTORED: Use /scripts URL for normal navigation (user likes this)
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
        ref={scriptListRef}
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
            onBackgroundUploadStart={handleBackgroundUploadStart}
          />
        )}
      </main>
    </div>
  )
}

export default App