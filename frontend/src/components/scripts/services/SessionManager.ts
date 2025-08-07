import { ClaudeSessionService } from '../../../services/ClaudeSessionService';
import logger from '../../../services/LoggingService';

/**
 * Manages Claude session services to prevent memory leaks.
 * Ensures proper cleanup of WebSocket connections and event listeners.
 */
export class SessionManager {
  private sessions: Map<string, ClaudeSessionService>;
  private cleanupTimers: Map<string, NodeJS.Timeout>;

  constructor() {
    this.sessions = new Map();
    this.cleanupTimers = new Map();
  }

  /**
   * Track a new session
   */
  track(scriptId: string, sessionService: ClaudeSessionService): void {
    // Clean up any existing session for this script
    this.dispose(scriptId);
    
    // Store the new session
    this.sessions.set(scriptId, sessionService);
    
    // Set up auto-cleanup after 5 minutes of inactivity
    const timer = setTimeout(() => {
      logger.debug('SessionManager', `Auto-cleaning session for script: ${scriptId}`);
      this.dispose(scriptId);
    }, 5 * 60 * 1000);
    
    this.cleanupTimers.set(scriptId, timer);
  }

  /**
   * Get a tracked session
   */
  get(scriptId: string): ClaudeSessionService | undefined {
    return this.sessions.get(scriptId);
  }

  /**
   * Dispose of a specific session
   */
  dispose(scriptId: string): void {
    const session = this.sessions.get(scriptId);
    if (session) {
      try {
        // Call cleanup method if it exists
        if (typeof (session as any).cleanup === 'function') {
          (session as any).cleanup();
        }
        
        // Close WebSocket if it exists
        if ((session as any).ws) {
          (session as any).ws.close();
        }
        
        logger.debug('SessionManager', `Disposed session for script: ${scriptId}`);
      } catch (error) {
        logger.error('SessionManager', `Error disposing session for ${scriptId}:`, error);
      } finally {
        this.sessions.delete(scriptId);
      }
    }
    
    // Clear the cleanup timer
    const timer = this.cleanupTimers.get(scriptId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(scriptId);
    }
  }

  /**
   * Dispose of all tracked sessions
   */
  disposeAll(): void {
    logger.debug('SessionManager', `Disposing all ${this.sessions.size} sessions`);
    
    // Clear all sessions
    for (const scriptId of this.sessions.keys()) {
      this.dispose(scriptId);
    }
    
    // Clear all timers
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    
    this.sessions.clear();
    this.cleanupTimers.clear();
  }

  /**
   * Get the number of active sessions
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Check if a session exists for a script
   */
  hasSession(scriptId: string): boolean {
    return this.sessions.has(scriptId);
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Clean up on window unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    sessionManager.disposeAll();
  });
}