import logger from './LoggingService';

/**
 * Defines the possible view states of the application.
 */
export type AppView = 'auth' | 'scripts' | 'editor';

/**
 * Route information parsed from URL
 */
export interface RouteInfo {
  view: AppView;
  scriptId: string | null;
  scriptTitle: string | null;
}

/**
 * Browser history state structure
 */
export interface HistoryState {
  view: AppView;
  scriptId?: string | null;
  scriptTitle?: string | null;
}

/**
 * Service for managing application routing and browser history
 */
class RoutingService {
  private static instance: RoutingService;
  private listeners: Set<(route: RouteInfo) => void> = new Set();

  private constructor() {
    // Setup popstate listener once
    window.addEventListener('popstate', this.handlePopState.bind(this));
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RoutingService {
    if (!RoutingService.instance) {
      RoutingService.instance = new RoutingService();
    }
    return RoutingService.instance;
  }

  /**
   * Parse the current URL path to determine the view and parameters
   */
  public parseCurrentRoute(): RouteInfo {
    const path = window.location.pathname;
    
    // Parse editor routes like /editor/123 or /editor/123/title
    const editorMatch = path.match(/^\/editor\/([^/]+)(?:\/(.+))?/);
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
    
    // Root path or unknown routes default to scripts
    return { view: 'scripts', scriptId: null, scriptTitle: null };
  }

  /**
   * Navigate to the scripts list view
   */
  public navigateToScripts(): void {
    const state: HistoryState = { view: 'scripts' };
    window.history.pushState(state, '', '/scripts');
    this.notifyListeners();
  }

  /**
   * Navigate to the editor view for a specific script
   */
  public navigateToEditor(scriptId: string, scriptTitle?: string): void {
    const state: HistoryState = { 
      view: 'editor', 
      scriptId, 
      scriptTitle: scriptTitle || null 
    };
    
    const url = scriptTitle 
      ? `/editor/${scriptId}/${encodeURIComponent(scriptTitle)}`
      : `/editor/${scriptId}`;
    
    window.history.pushState(state, '', url);
    this.notifyListeners();
  }

  /**
   * Navigate to the authentication view
   */
  public navigateToAuth(): void {
    const state: HistoryState = { view: 'auth' };
    window.history.pushState(state, '', '/');
    this.notifyListeners();
  }

  /**
   * Replace current history state (doesn't add new entry)
   */
  public replaceState(route: RouteInfo): void {
    const state: HistoryState = {
      view: route.view,
      scriptId: route.scriptId,
      scriptTitle: route.scriptTitle
    };

    let url = '/';
    if (route.view === 'scripts') {
      url = '/scripts/';
    } else if (route.view === 'editor' && route.scriptId) {
      url = route.scriptTitle
        ? `/editor/${route.scriptId}/${encodeURIComponent(route.scriptTitle)}`
        : `/editor/${route.scriptId}`;
    }

    window.history.replaceState(state, '', url);
  }

  /**
   * Update only the script title in the current editor URL
   */
  public updateEditorTitle(scriptId: string, scriptTitle: string): void {
    const state: HistoryState = { 
      view: 'editor', 
      scriptId, 
      scriptTitle 
    };
    
    const url = `/editor/${scriptId}/${encodeURIComponent(scriptTitle)}`;
    window.history.replaceState(state, '', url);
  }

  /**
   * Subscribe to route changes
   */
  public subscribe(listener: (route: RouteInfo) => void): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Handle browser back/forward button events
   */
  private handlePopState(event: PopStateEvent): void {
    const state = event.state as HistoryState | null;
    
    let route: RouteInfo;
    if (state && state.view) {
      route = {
        view: state.view,
        scriptId: state.scriptId || null,
        scriptTitle: state.scriptTitle || null
      };
    } else {
      // No state means initial page load or direct URL navigation
      route = this.parseCurrentRoute();
    }

    logger.debug('RoutingService', 'Popstate event', { route });
    this.notifyListeners(route);
  }

  /**
   * Notify all listeners of route change
   */
  private notifyListeners(route?: RouteInfo): void {
    const currentRoute = route || this.parseCurrentRoute();
    this.listeners.forEach(listener => {
      try {
        listener(currentRoute);
      } catch (error) {
        logger.error('RoutingService', 'Error in route listener', error);
      }
    });
  }

  /**
   * Check if user should have access to current route
   */
  public isRouteAccessible(route: RouteInfo, isAuthenticated: boolean): boolean {
    // Auth page is always accessible
    if (route.view === 'auth') return true;
    
    // Other views require authentication
    return isAuthenticated;
  }

  /**
   * Get appropriate redirect route based on auth state
   */
  public getRedirectRoute(isAuthenticated: boolean, intendedRoute?: RouteInfo): RouteInfo {
    if (!isAuthenticated) {
      // Not authenticated - go to auth
      return { view: 'auth', scriptId: null, scriptTitle: null };
    }

    // Authenticated - go to intended route or scripts
    if (intendedRoute && intendedRoute.view !== 'auth') {
      return intendedRoute;
    }

    return { view: 'scripts', scriptId: null, scriptTitle: null };
  }
}

// Export singleton instance
export const routingService = RoutingService.getInstance();
