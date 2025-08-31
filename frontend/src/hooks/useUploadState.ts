import { useEffect, useState } from 'react';
import UploadStateManager, { UploadState } from '../services/UploadStateManager';
import { PlaceholderScript } from '../types';

export function useUploadState() {
  const [state, setState] = useState<UploadState>(UploadStateManager.getState());

  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = UploadStateManager.subscribe((newState) => {
      // Always replace with a fresh snapshot to ensure rerender
      setState({
        uploads: new Map(newState.uploads),
        sessionIds: new Map(newState.sessionIds)
      });
    });

    // Get initial state from a snapshot
    setState(UploadStateManager.getState());

    return unsubscribe;
  }, []);

  return {
    uploads: Array.from(state.uploads.values()),
    activeUploads: Array.from(state.uploads.values()).filter(u => !u.uploadComplete),
    addUpload: (placeholder: PlaceholderScript) => UploadStateManager.addUpload(placeholder),
    updateUpload: (id: string, updates: Partial<PlaceholderScript>) => UploadStateManager.updateUpload(id, updates),
    removeUpload: (id: string) => UploadStateManager.removeUpload(id),
    setSessionId: (uploadId: string, sessionId: string) => UploadStateManager.setSessionId(uploadId, sessionId),
    getSessionId: (uploadId: string) => UploadStateManager.getSessionId(uploadId),
    clearAll: () => UploadStateManager.clearAll()
  };
}
