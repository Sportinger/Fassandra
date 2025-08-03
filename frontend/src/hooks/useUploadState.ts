import { useEffect, useState } from 'react';
import UploadStateManager, { UploadState } from '../services/UploadStateManager';
import { PlaceholderScript } from '../types';

export function useUploadState() {
  const [state, setState] = useState<UploadState>({
    uploads: UploadStateManager['state'].uploads,
    sessionIds: UploadStateManager['state'].sessionIds
  });

  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = UploadStateManager.subscribe((newState) => {
      setState(newState);
    });

    // Get initial state
    setState({
      uploads: UploadStateManager['state'].uploads,
      sessionIds: UploadStateManager['state'].sessionIds
    });

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