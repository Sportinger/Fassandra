// Console forwarding system for mobile debugging
// Captures console logs and sends them to backend for analysis

interface ConsoleLogEntry {
  timestamp: string;
  level: 'log' | 'error' | 'warn' | 'info' | 'debug';
  message: string;
  user_agent: string;
  url: string;
  script_id?: string;
  user_id?: string;
}

class ConsoleForwarder {
  private logs: ConsoleLogEntry[] = [];
  private maxLogs = 50;
  private sendInterval = 5000; // Send logs every 5 seconds
  private intervalId: NodeJS.Timeout | null = null;
  private isEnabled = false;
  private originalConsole: any = {};

  constructor() {
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };
  }

  enable(scriptId?: string, userId?: string) {
    if (this.isEnabled) return;
    
    this.isEnabled = true;
    console.log('[Console Forwarder] Enabling for mobile debugging...');
    
    // Override console methods
    this.overrideConsole(scriptId, userId);
    
    // Start periodic sending
    this.intervalId = setInterval(() => {
      this.sendLogs();
    }, this.sendInterval);
    
    // Send initial detection log
    this.addLog('info', `Console forwarder enabled - Mobile: ${this.isMobile()}, Browser: ${this.getBrowserInfo()}`);
  }

  disable() {
    if (!this.isEnabled) return;
    
    this.isEnabled = false;
    console.log('[Console Forwarder] Disabling...');
    
    // Restore original console methods
    Object.assign(console, this.originalConsole);
    
    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Send remaining logs
    this.sendLogs();
  }

  private overrideConsole(scriptId?: string, userId?: string) {
    const levels: Array<'log' | 'error' | 'warn' | 'info' | 'debug'> = ['log', 'error', 'warn', 'info', 'debug'];
    
    levels.forEach(level => {
      (console as any)[level] = (...args: any[]) => {
        // Call original console method
        this.originalConsole[level](...args);
        
        // Capture for forwarding
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        this.addLog(level, message, scriptId, userId);
      };
    });
  }

  private addLog(level: 'log' | 'error' | 'warn' | 'info' | 'debug', message: string, scriptId?: string, userId?: string) {
    const logEntry: ConsoleLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      user_agent: navigator.userAgent,
      url: window.location.href,
      script_id: scriptId,
      user_id: userId,
    };

    this.logs.push(logEntry);
    
    // Keep only the latest logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private async sendLogs() {
    if (this.logs.length === 0) return;
    
    const logsToSend = [...this.logs];
    this.logs = [];
    
    try {
      const response = await fetch('/api/debug/console-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          device_info: {
            user_agent: navigator.userAgent,
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            browser_type: this.getBrowserInfo(),
            is_mobile: this.isMobile(),
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,
            url: window.location.href,
          }
        }),
      });
      
      if (!response.ok) {
        this.originalConsole.error(`Failed to send console logs: ${response.status}`);
      } else {
        this.originalConsole.log(`[Console Forwarder] Successfully sent ${logsToSend.length} log entries`);
      }
    } catch (error) {
      this.originalConsole.error('Error sending console logs:', error);
      // Put logs back if sending failed
      this.logs.unshift(...logsToSend);
    }
  }

  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent) ||
           /Mobi|Android/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768);
  }

  private getBrowserInfo(): string {
    const ua = navigator.userAgent;
    if (/Chrome/.test(ua) && /Brave/.test(ua)) return 'Brave';
    if (/Chrome/.test(ua) && !/Edg/.test(ua)) return 'Chrome';
    if (/Firefox/.test(ua)) return 'Firefox';
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'Safari';
    if (/Edg/.test(ua)) return 'Edge';
    return 'Unknown';
  }

  // Manual log sending for immediate debugging
  async sendNow() {
    await this.sendLogs();
  }

  // Get current logs without sending
  getCurrentLogs(): ConsoleLogEntry[] {
    return [...this.logs];
  }
}

// Global instance
const consoleForwarder = new ConsoleForwarder();

// Auto-enable for mobile devices
if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent)) {
  console.log('[Console Forwarder] Mobile device detected, enabling console forwarding...');
  consoleForwarder.enable();
}

// Export for manual control
export { consoleForwarder, ConsoleForwarder };

// Make available globally for mobile console access
(window as any).consoleForwarder = consoleForwarder;

console.log('[Console Forwarder] Loaded. Use window.consoleForwarder.enable() to start debugging.'); 