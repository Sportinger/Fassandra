import logger from '../services/LoggingService';

/**
 * UI state interface
 */
export interface UIState {
  isUploaderOpen: boolean;
  showLogin: boolean;
  refreshTrigger: number;
}

/**
 * Store for managing UI-related state
 */
class UIStore {
  private static instance: UIStore;
  private state: UIState = {
    isUploaderOpen: false,
    showLogin: true,
    refreshTrigger: 0
  };
  private listeners: Set<(state: UIState) => void> = new Set();

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): UIStore {
    if (!UIStore.instance) {
      UIStore.instance = new UIStore();
    }
    return UIStore.instance;
  }

  /**
   * Get current state
   */
  public getState(): UIState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(listener: (state: UIState) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.getState());
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        logger.error('UIStore', 'Error in state listener', error);
      }
    });
  }

  /**
   * Open the script uploader modal
   */
  public openUploader(): void {
    this.state.isUploaderOpen = true;
    this.notifyListeners();
  }

  /**
   * Close the script uploader modal
   */
  public closeUploader(): void {
    this.state.isUploaderOpen = false;
    this.notifyListeners();
  }

  /**
   * Toggle between login and register views
   */
  public setShowLogin(show: boolean): void {
    this.state.showLogin = show;
    this.notifyListeners();
  }

  /**
   * Trigger a refresh of the script list
   */
  public triggerRefresh(): void {
    this.state.refreshTrigger++;
    this.notifyListeners();
  }

  /**
   * Reset UI state
   */
  public reset(): void {
    this.state = {
      isUploaderOpen: false,
      showLogin: true,
      refreshTrigger: 0
    };
    this.notifyListeners();
  }
}

// Export singleton instance
export const uiStore = UIStore.getInstance();