import * as Y from 'yjs';

/**
 * Singleton manager for Yjs documents
 * Ensures documents persist across WebSocket reconnections
 * Prevents counter regression issues by maintaining stable document instances
 */
class YjsDocumentManager {
  private static instance: YjsDocumentManager;
  private documents: Map<string, Y.Doc> = new Map();
  private refCounts: Map<string, number> = new Map();

  private constructor() {
    console.log('[YjsDocumentManager] Initialized singleton instance');
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
  getDocument(scriptId: string): Y.Doc {
    if (!this.documents.has(scriptId)) {
      console.log(`[YjsDocumentManager] Creating new document for script: ${scriptId}`);
      const doc = new Y.Doc();
      
      // Initialize default fragment for Tiptap
      doc.transact(() => {
        doc.getXmlFragment('default');
      }, 'initializeDefaultFragment');

      // Add debug logging
      doc.on('update', (update: Uint8Array, origin: any) => {
        const state = Y.encodeStateVector(doc);
        console.log(`[YjsDocumentManager] Document ${scriptId} updated:`, {
          updateSize: update.length,
          origin: origin?.constructor?.name || origin || 'unknown',
          stateVectorSize: state.length,
          clientID: doc.clientID,
          // Log the counter to track regression issues
          updateCounter: doc.store.clients.get(doc.clientID)?.clock || 0
        });
      });

      this.documents.set(scriptId, doc);
      this.refCounts.set(scriptId, 0);
    }

    // Increment reference count
    const currentCount = this.refCounts.get(scriptId) || 0;
    this.refCounts.set(scriptId, currentCount + 1);
    
    console.log(`[YjsDocumentManager] Document ${scriptId} accessed, ref count: ${currentCount + 1}`);
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
    console.log(`[YjsDocumentManager] Releasing document ${scriptId}, ref count: ${count} -> ${newCount}`);

    if (newCount <= 0) {
      // Only destroy if no more references
      const doc = this.documents.get(scriptId);
      if (doc) {
        console.log(`[YjsDocumentManager] Destroying document ${scriptId} (no more references)`);
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
      console.warn(`[YjsDocumentManager] Force destroying document ${scriptId}`);
      doc.destroy();
      this.documents.delete(scriptId);
      this.refCounts.delete(scriptId);
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
    console.warn('[YjsDocumentManager] Clearing all documents');
    this.documents.forEach(doc => doc.destroy());
    this.documents.clear();
    this.refCounts.clear();
  }
}

// Export singleton instance
export const yjsDocumentManager = YjsDocumentManager.getInstance();