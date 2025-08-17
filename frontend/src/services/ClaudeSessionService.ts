import logger from '../services/LoggingService';

export interface SessionStatus {
  id: string;
  status: string;
  progress: number;
  pdf_filename: string;
  started_at: string;
  script_id?: string;
  error?: string;
}

export interface SessionUpdate {
  type: 'initial' | 'status' | 'output' | 'page_progress' | 'complete' | 'failed';
  session?: {
    id: string;
    status: string;
    progress: number;
    pdf_filename: string;
    started_at: string;
  };
  status?: string;
  progress?: number;
  line?: string;
  script_id?: string;
  error?: string;
  // Page progress fields
  current_page?: number;
  total_pages?: number;
  message?: string;
}

export class ClaudeSessionService {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private token: string;
  private onUpdate: (update: SessionUpdate) => void;
  private onComplete: (scriptId: string) => void;
  private onError: (error: string) => void;

  constructor(
    sessionId: string,
    token: string,
    onUpdate: (update: SessionUpdate) => void,
    onComplete: (scriptId: string) => void,
    onError: (error: string) => void
  ) {
    this.sessionId = sessionId;
    this.token = token;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.onError = onError;
  }

  connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Pass token as query parameter for WebSocket authentication
    const wsUrl = `${protocol}//${host}/api/s/session/${this.sessionId}/ws?token=${encodeURIComponent(this.token)}`;

    logger.debug('ClaudeSessionService', '[ClaudeSession] Connecting to WebSocket:', wsUrl);

    // WebSocket authentication happens through the token query parameter
    // since WebSocket doesn't support custom headers
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      logger.debug('ClaudeSessionService', '[ClaudeSession] WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const update: SessionUpdate = JSON.parse(event.data);
        logger.debug('ClaudeSessionService', '[ClaudeSession] Received update:', update);

        this.onUpdate(update);

        if (update.type === 'complete' && update.script_id) {
          this.onComplete(update.script_id);
          this.disconnect();
        } else if (update.type === 'failed' && update.error) {
          this.onError(update.error);
          this.disconnect();
        }
      } catch (error) {
        logger.error('ClaudeSessionService', '[ClaudeSession] Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      logger.error('ClaudeSessionService', '[ClaudeSession] WebSocket error:', error);
      this.onError('WebSocket connection error');
    };

    this.ws.onclose = () => {
      logger.debug('ClaudeSessionService', '[ClaudeSession] WebSocket disconnected');
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async cancelSession(): Promise<void> {
    try {
      const response = await fetch(`/api/s/session/${this.sessionId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel session: ${response.statusText}`);
      }

      logger.debug('ClaudeSessionService', '[ClaudeSession] Session cancelled successfully');
    } catch (error) {
      logger.error('ClaudeSessionService', '[ClaudeSession] Failed to cancel session:', error);
      throw error;
    }
  }

  static async getSessionStatus(sessionId: string, token: string): Promise<SessionStatus> {
    const response = await fetch(`/api/s/session/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get session status: ${response.statusText}`);
    }

    return response.json();
  }
}