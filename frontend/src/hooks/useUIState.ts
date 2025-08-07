import { useState, useEffect, useCallback } from 'react';
import { uiStore, UIState } from '../stores/UIStore';

/**
 * Custom hook for managing UI state
 */
export function useUIState() {
  const [state, setState] = useState<UIState>(uiStore.getState());

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = uiStore.subscribe(setState);
    return unsubscribe;
  }, []);

  // Action methods
  const openUploader = useCallback(() => {
    uiStore.openUploader();
  }, []);

  const closeUploader = useCallback(() => {
    uiStore.closeUploader();
  }, []);

  const setShowLogin = useCallback((show: boolean) => {
    uiStore.setShowLogin(show);
  }, []);

  const triggerRefresh = useCallback(() => {
    uiStore.triggerRefresh();
  }, []);

  return {
    isUploaderOpen: state.isUploaderOpen,
    showLogin: state.showLogin,
    refreshTrigger: state.refreshTrigger,
    openUploader,
    closeUploader,
    setShowLogin,
    triggerRefresh
  };
}