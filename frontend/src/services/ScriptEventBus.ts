type ScriptUpdateListener = (scriptId: string) => void;

class ScriptEventBus {
  private listeners: Map<string, Set<ScriptUpdateListener>> = new Map();

  // Subscribe to updates for a specific script
  subscribe(scriptId: string, listener: ScriptUpdateListener): () => void {
    if (!this.listeners.has(scriptId)) {
      this.listeners.set(scriptId, new Set());
    }
    this.listeners.get(scriptId)!.add(listener);

    // Return unsubscribe function
    return () => {
      const scriptListeners = this.listeners.get(scriptId);
      if (scriptListeners) {
        scriptListeners.delete(listener);
        if (scriptListeners.size === 0) {
          this.listeners.delete(scriptId);
        }
      }
    };
  }

  // Emit an update event for a specific script
  emit(scriptId: string): void {
    const scriptListeners = this.listeners.get(scriptId);
    if (scriptListeners) {
      scriptListeners.forEach(listener => listener(scriptId));
    }
  }

  // Clear all listeners (useful for cleanup)
  clear(): void {
    this.listeners.clear();
  }
}

// Export singleton instance
export const scriptEventBus = new ScriptEventBus();