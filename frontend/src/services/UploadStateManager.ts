import { PlaceholderScript } from '../types';

import logger from '../services/LoggingService';
export interface UploadState {
  uploads: Map<string, PlaceholderScript>;
  sessionIds: Map<string, string>; // Maps upload ID to session ID
}

class UploadStateManager {
  private static instance: UploadStateManager;
  private state: UploadState = {
    uploads: new Map(),
    sessionIds: new Map()
  };
  
  private listeners: Set<(state: UploadState) => void> = new Set();
  private storageKey = 'pessoa_upload_state';

  private constructor() {
    // Load state from localStorage on initialization
    this.loadState();
    
    // Save state to localStorage whenever it changes
    this.saveState = this.saveState.bind(this);
  }

  static getInstance(): UploadStateManager {
    if (!UploadStateManager.instance) {
      UploadStateManager.instance = new UploadStateManager();
    }
    return UploadStateManager.instance;
  }

  private loadState(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Reconstruct Maps from arrays
        this.state.uploads = new Map(parsed.uploads || []);
        this.state.sessionIds = new Map(parsed.sessionIds || []);
        
        // Clean up completed uploads older than 5 minutes
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        for (const [id, upload] of this.state.uploads) {
          if (upload.uploadComplete && upload.uploadStartTime && new Date(upload.uploadStartTime).getTime() < fiveMinutesAgo) {
            this.state.uploads.delete(id);
            this.state.sessionIds.delete(id);
          }
        }
        this.saveState();
      }
    } catch (error) {
      logger.error('UploadStateManager', '[UploadStateManager] Failed to load state:', error);
    }
  }

  private saveState(): void {
    try {
      const serializable = {
        uploads: Array.from(this.state.uploads.entries()),
        sessionIds: Array.from(this.state.sessionIds.entries())
      };
      localStorage.setItem(this.storageKey, JSON.stringify(serializable));
    } catch (error) {
      logger.error('UploadStateManager', '[UploadStateManager] Failed to save state:', error);
    }
  }

  addUpload(placeholder: PlaceholderScript): void {
    this.state.uploads.set(placeholder.id, placeholder);
    this.saveState();
    this.notifyListeners();
  }

  setSessionId(uploadId: string, sessionId: string): void {
    this.state.sessionIds.set(uploadId, sessionId);
    this.saveState();
    this.notifyListeners();
  }

  updateUpload(id: string, updates: Partial<PlaceholderScript>): void {
    const upload = this.state.uploads.get(id);
    if (upload) {
      this.state.uploads.set(id, { ...upload, ...updates });
      this.saveState();
      this.notifyListeners();
    }
  }

  removeUpload(id: string): void {
    this.state.uploads.delete(id);
    this.state.sessionIds.delete(id);
    this.saveState();
    this.notifyListeners();
  }

  getUpload(id: string): PlaceholderScript | undefined {
    return this.state.uploads.get(id);
  }

  getSessionId(uploadId: string): string | undefined {
    return this.state.sessionIds.get(uploadId);
  }

  getAllUploads(): PlaceholderScript[] {
    return Array.from(this.state.uploads.values());
  }

  getActiveUploads(): PlaceholderScript[] {
    return Array.from(this.state.uploads.values()).filter(u => !u.uploadComplete);
  }

  // Subscribe to state changes
  subscribe(listener: (state: UploadState) => void): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  // Clear all uploads (useful for logout)
  clearAll(): void {
    this.state.uploads.clear();
    this.state.sessionIds.clear();
    this.saveState();
    this.notifyListeners();
  }
}

export default UploadStateManager.getInstance();