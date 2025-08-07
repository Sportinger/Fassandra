import { useState, useEffect, useCallback } from 'react';
import { routingService, RouteInfo, AppView } from '../services/RoutingService';
import { useAuth } from '../AuthContext';
import logger from '../services/LoggingService';

/**
 * Custom hook for managing application routing
 */
export function useRouting() {
  const { token } = useAuth();
  const isAuthenticated = !!token;

  // Initialize state from current URL
  const [currentRoute, setCurrentRoute] = useState<RouteInfo>(() => {
    const route = routingService.parseCurrentRoute();
    
    // Check if user has access to this route
    if (!routingService.isRouteAccessible(route, isAuthenticated)) {
      const redirectRoute = routingService.getRedirectRoute(isAuthenticated);
      routingService.replaceState(redirectRoute);
      return redirectRoute;
    }
    
    return route;
  });

  // Subscribe to route changes
  useEffect(() => {
    const unsubscribe = routingService.subscribe((newRoute) => {
      // Check access before applying route
      if (!routingService.isRouteAccessible(newRoute, isAuthenticated)) {
        const redirectRoute = routingService.getRedirectRoute(isAuthenticated);
        routingService.replaceState(redirectRoute);
        setCurrentRoute(redirectRoute);
      } else {
        setCurrentRoute(newRoute);
      }
    });

    return unsubscribe;
  }, [isAuthenticated]);

  // Handle authentication state changes
  useEffect(() => {
    const route = routingService.parseCurrentRoute();
    
    if (!isAuthenticated && route.view !== 'auth') {
      // User logged out - redirect to auth
      logger.debug('useRouting', 'User logged out, redirecting to auth');
      routingService.navigateToAuth();
      setCurrentRoute({ view: 'auth', scriptId: null, scriptTitle: null });
    } else if (isAuthenticated && currentRoute.view === 'auth') {
      // User just logged in - redirect to intended route or scripts
      const intendedRoute = routingService.parseCurrentRoute();
      const redirectRoute = routingService.getRedirectRoute(true, intendedRoute);
      
      logger.debug('useRouting', 'User logged in, redirecting', { redirectRoute });
      
      if (redirectRoute.view === 'editor' && redirectRoute.scriptId) {
        routingService.navigateToEditor(redirectRoute.scriptId, redirectRoute.scriptTitle || undefined);
      } else {
        routingService.navigateToScripts();
      }
      setCurrentRoute(redirectRoute);
    }
  }, [isAuthenticated]);

  // Navigation functions
  const navigateToScripts = useCallback(() => {
    routingService.navigateToScripts();
    setCurrentRoute({ view: 'scripts', scriptId: null, scriptTitle: null });
  }, []);

  const navigateToEditor = useCallback((scriptId: string, scriptTitle?: string) => {
    routingService.navigateToEditor(scriptId, scriptTitle);
    setCurrentRoute({ 
      view: 'editor', 
      scriptId, 
      scriptTitle: scriptTitle || null 
    });
  }, []);

  const updateEditorTitle = useCallback((scriptId: string, scriptTitle: string) => {
    routingService.updateEditorTitle(scriptId, scriptTitle);
    setCurrentRoute(prev => ({
      ...prev,
      scriptTitle
    }));
  }, []);

  return {
    currentView: currentRoute.view,
    selectedScriptId: currentRoute.scriptId,
    selectedScriptTitle: currentRoute.scriptTitle,
    navigateToScripts,
    navigateToEditor,
    updateEditorTitle,
    isAuthenticated
  };
}