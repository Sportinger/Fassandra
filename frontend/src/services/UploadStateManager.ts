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
  private storageKey = 'fassandra_upload_state';

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
        // Reconstruct Maps from arrays (immutable snapshot)
        const uploads = new Map<string, PlaceholderScript>(parsed.uploads || []);
        const sessionIds = new Map<string, string>(parsed.sessionIds || []);
        this.state = { uploads, sessionIds };
        
        // Clean up completed uploads older than 5 minutes
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        for (const [id, upload] of this.state.uploads) {
          if (upload.uploadComplete && upload.uploadStartTime && new Date(upload.uploadStartTime).getTime() < fiveMinutesAgo) {
            const newUploads = new Map(this.state.uploads);
            const newSessionIds = new Map(this.state.sessionIds);
            newUploads.delete(id);
            newSessionIds.delete(id);
            this.state = { uploads: newUploads, sessionIds: newSessionIds };
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
    const newUploads = new Map(this.state.uploads);
    newUploads.set(placeholder.id, {
      ...placeholder,
      uploadStartTime: placeholder.uploadStartTime ?? Date.now(),
    });
    this.state = { uploads: newUploads, sessionIds: new Map(this.state.sessionIds) };
    this.saveState();
    this.notifyListeners();
  }

  setSessionId(uploadId: string, sessionId: string): void {
    const newSessionIds = new Map(this.state.sessionIds);
    newSessionIds.set(uploadId, sessionId);
    this.state = { uploads: new Map(this.state.uploads), sessionIds: newSessionIds };
    this.saveState();
    this.notifyListeners();
  }

  updateUpload(id: string, updates: Partial<PlaceholderScript>): void {
    const upload = this.state.uploads.get(id);
    if (!upload) return;
    const updated = { ...upload, ...updates };
    const newUploads = new Map(this.state.uploads);
    newUploads.set(id, updated);
    this.state = { uploads: newUploads, sessionIds: new Map(this.state.sessionIds) };
    this.saveState();
    this.notifyListeners();
  }

  appendLog(id: string, line: string): void {
    const upload = this.state.uploads.get(id);
    if (!upload) return;
    const logs = (upload.debugLogs ? [...upload.debugLogs] : []);
    logs.push(line);
    // Cap logs to last 200 lines to avoid unbounded growth
    const capped = logs.slice(Math.max(0, logs.length - 200));
    const updated: PlaceholderScript = { ...upload, debugLogs: capped, lastOutput: line };
    const newUploads = new Map(this.state.uploads);
    newUploads.set(id, updated);
    this.state = { uploads: newUploads, sessionIds: new Map(this.state.sessionIds) };
    this.saveState();
    this.notifyListeners();
  }

  removeUpload(id: string): void {
    const newUploads = new Map(this.state.uploads);
    const newSessionIds = new Map(this.state.sessionIds);
    newUploads.delete(id);
    newSessionIds.delete(id);
    this.state = { uploads: newUploads, sessionIds: newSessionIds };
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
    // Emit a fresh snapshot to guarantee React state updates
    const snapshot: UploadState = {
      uploads: new Map(this.state.uploads),
      sessionIds: new Map(this.state.sessionIds),
    };
    this.listeners.forEach(listener => listener(snapshot));
  }

  // Clear all uploads (useful for logout)
  clearAll(): void {
    this.state = { uploads: new Map(), sessionIds: new Map() };
    this.saveState();
    this.notifyListeners();
  }

  // Provide a safe snapshot of current state
  getState(): UploadState {
    return {
      uploads: new Map(this.state.uploads),
      sessionIds: new Map(this.state.sessionIds),
    };
  }
}

export default UploadStateManager.getInstance();
