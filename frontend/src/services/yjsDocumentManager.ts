import * as Y from 'yjs';
import { logDebugInfo } from '../utils/debug';

import logger from '../services/LoggingService';
/**
 * Singleton manager for Yjs documents
 * Ensures documents persist across WebSocket reconnections
 * Prevents counter regression issues by maintaining stable document instances
 */
class YjsDocumentManager {
  private static instance: YjsDocumentManager;
  private documents: Map<string, Y.Doc> = new Map();
  private refCounts: Map<string, number> = new Map();
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  private maxIdleTime: number = 30000; // 30 seconds of idle time before cleanup

  private constructor() {
    if (import.meta.env.DEV) {
      logDebugInfo('YjsDocumentManager', 'Initialized singleton instance');
    }
    
    // Set up periodic cleanup check
    this.startPeriodicCleanup();
  }
  
  /**
   * Start periodic cleanup of idle documents
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupIdleDocuments();
    }, 60000); // Check every minute
  }
  
  /**
   * Clean up documents with zero references
   */
  private cleanupIdleDocuments(): void {
    const now = Date.now();
    this.refCounts.forEach((count, scriptId) => {
      if (count === 0) {
        const doc = this.documents.get(scriptId);
        if (doc) {
          logger.debug('yjsDocumentManager', `Cleaning up idle document: ${scriptId}`);
          this.forceDestroyDocument(scriptId);
        }
      }
    });
  }

  static getInstance(): YjsDocumentManager {
    if (!YjsDocumentManager.instance) {
      YjsDocumentManager.instance = new YjsDocumentManager();
    }
    return YjsDocumentManager.instance;
  }

  /**
   * Get or create a document for a script
   * Increments reference count to track active users
   */
  getDocument(scriptId: string, forceNew: boolean = false): Y.Doc {
    // If forcing new document, mark the old one for cleanup but don't destroy immediately
    if (forceNew && this.documents.has(scriptId)) {
      if (import.meta.env.DEV) {
        logDebugInfo('YjsDocumentManager', `Force creating new document for script: ${scriptId}, marking old one for cleanup`);
      }
      const oldDoc = this.documents.get(scriptId);
      
      // Schedule cleanup after a delay to allow provider to disconnect properly
      if (oldDoc) {
        setTimeout(() => {
          if (import.meta.env.DEV) {
            logDebugInfo('YjsDocumentManager', `Delayed cleanup of old document for script: ${scriptId}`);
          }
          // Only destroy if it's still the same document (not replaced)
          if (this.documents.get(scriptId) === oldDoc) {
            oldDoc.destroy();
          }
        }, 500); // Give provider 500ms to cleanup
      }
      
      // Remove from maps immediately to force new document creation
      this.documents.delete(scriptId);
      this.refCounts.delete(scriptId);
      // Clear the stored client ID to get a fresh one
      sessionStorage.removeItem(`yjs-client-id-${scriptId}`);
    }
    
    if (!this.documents.has(scriptId)) {
      if (import.meta.env.DEV) {
        logDebugInfo('YjsDocumentManager', `Creating new document for script: ${scriptId}`);
      }
      const doc = new Y.Doc();
      
      // Generate a stable client ID based on user session to prevent conflicts
      // This helps ensure consistent state across reconnections
      const storedClientId = sessionStorage.getItem(`yjs-client-id-${scriptId}`);
      if (storedClientId) {
        (doc as any).clientID = parseInt(storedClientId, 10);
        if (import.meta.env.DEV) {
          logDebugInfo('YjsDocumentManager', `Restored client ID: ${storedClientId} for script: ${scriptId}`);
        }
      } else {
        const newClientId = doc.clientID.toString();
        sessionStorage.setItem(`yjs-client-id-${scriptId}`, newClientId);
        if (import.meta.env.DEV) {
          logDebugInfo('YjsDocumentManager', `Stored new client ID: ${newClientId} for script: ${scriptId}`);
        }
      }
      
      // Initialize default fragment for Tiptap
      doc.transact(() => {
        doc.getXmlFragment('default');
      }, 'initializeDefaultFragment');

      // Add debug logging with error handling
      doc.on('update', (update: Uint8Array, origin: any) => {
        try {
          const state = Y.encodeStateVector(doc);
          if (import.meta.env.DEV) {
            logDebugInfo('YjsDocumentManager', `Document ${scriptId} updated: ${JSON.stringify({
              updateSize: update.length,
              origin: origin?.constructor?.name || origin || 'unknown',
              stateVectorSize: state.length,
              clientID: doc.clientID,
              updateCounter: (doc.store.clients.get(doc.clientID) as any)?.clock || 0
            })}`);
          }
        } catch (error) {
          logger.error('yjsDocumentManager', `[YjsDocumentManager] Error processing update for ${scriptId}:`, error);
        }
      });

      this.documents.set(scriptId, doc);
      this.refCounts.set(scriptId, 0);
    }

    // Increment reference count
    const currentCount = this.refCounts.get(scriptId) || 0;
    this.refCounts.set(scriptId, currentCount + 1);
    
    if (import.meta.env.DEV) {
      logDebugInfo('YjsDocumentManager', `Document ${scriptId} accessed, ref count: ${currentCount + 1}`);
    }
    return this.documents.get(scriptId)!;
  }

  /**
   * Release a document reference
   * Only destroys when reference count reaches 0
   */
  releaseDocument(scriptId: string): void {
    const count = this.refCounts.get(scriptId);
    if (!count) return;

    const newCount = count - 1;
    if (import.meta.env.DEV) {
      logDebugInfo('YjsDocumentManager', `Releasing document ${scriptId}, ref count: ${count} -> ${newCount}`);
    }

    if (newCount <= 0) {
      // Only destroy if no more references
      const doc = this.documents.get(scriptId);
      if (doc) {
        if (import.meta.env.DEV) {
          logDebugInfo('YjsDocumentManager', `Destroying document ${scriptId} (no more references)`);
        }
        doc.destroy();
        this.documents.delete(scriptId);
        this.refCounts.delete(scriptId);
      }
    } else {
      this.refCounts.set(scriptId, newCount);
    }
  }

  /**
   * Force destroy a document regardless of reference count
   * Use with caution - only for cleanup scenarios
   */
  forceDestroyDocument(scriptId: string): void {
    const doc = this.documents.get(scriptId);
    if (doc) {
      logger.warn('yjsDocumentManager', `[YjsDocumentManager] Force destroying document ${scriptId}`);
      
      // Clear any pending cleanup timers
      const timer = this.cleanupTimers.get(scriptId);
      if (timer) {
        clearTimeout(timer);
        this.cleanupTimers.delete(scriptId);
      }
      
      // Remove all event listeners before destroying
      doc.off('update', () => {});
      doc.off('destroy', () => {});
      
      doc.destroy();
      this.documents.delete(scriptId);
      this.refCounts.delete(scriptId);
      
      // Clear stored client ID
      sessionStorage.removeItem(`yjs-client-id-${scriptId}`);
    }
  }

  /**
   * Check if a document exists
   */
  hasDocument(scriptId: string): boolean {
    return this.documents.has(scriptId);
  }

  /**
   * Get document info for debugging
   */
  getDocumentInfo(scriptId: string): { exists: boolean; refCount: number; clientID?: number } {
    const doc = this.documents.get(scriptId);
    return {
      exists: !!doc,
      refCount: this.refCounts.get(scriptId) || 0,
      clientID: doc?.clientID
    };
  }

  /**
   * Get all active documents (for debugging)
   */
  getAllDocuments(): Map<string, { doc: Y.Doc; refCount: number }> {
    const result = new Map();
    this.documents.forEach((doc, scriptId) => {
      result.set(scriptId, {
        doc,
        refCount: this.refCounts.get(scriptId) || 0
      });
    });
    return result;
  }

  /**
   * Clear all documents (for testing/logout scenarios)
   */
  clearAll(): void {
    logger.warn('yjsDocumentManager', '[YjsDocumentManager] Clearing all documents');
    
    // Clear all cleanup timers first
    this.cleanupTimers.forEach(timer => clearTimeout(timer));
    this.cleanupTimers.clear();
    
    // Clear stored client IDs and destroy documents
    this.documents.forEach((doc, scriptId) => {
      sessionStorage.removeItem(`yjs-client-id-${scriptId}`);
      
      // Remove all event listeners before destroying
      doc.off('update', () => {});
      doc.off('destroy', () => {});
      
      doc.destroy();
    });
    
    this.documents.clear();
    this.refCounts.clear();
  }
}

// Export singleton instance
export const yjsDocumentManager = YjsDocumentManager.getInstance();