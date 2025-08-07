/**
 * Centralized Logging Service
 * Handles all logging with environment-based filtering
 * Replaces direct console.log usage throughout the application
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

interface LogEntry {
  level: LogLevel;
  timestamp: Date;
  category: string;
  message: string;
  data?: any;
}

class LoggingService {
  private logLevel: LogLevel;
  private isDevelopment: boolean;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;

  constructor() {
    // Determine environment
    this.isDevelopment = import.meta.env.MODE === 'development' || 
                         import.meta.env.DEV === true ||
                         window.location.hostname === 'localhost';
    
    // Set log level based on environment
    const envLogLevel = import.meta.env.VITE_LOG_LEVEL?.toUpperCase();
    if (envLogLevel && LogLevel[envLogLevel as keyof typeof LogLevel] !== undefined) {
      this.logLevel = LogLevel[envLogLevel as keyof typeof LogLevel];
    } else {
      this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(entry: LogEntry): string {
    const time = entry.timestamp.toISOString().split('T')[1].split('.')[0];
    const levelStr = LogLevel[entry.level];
    return `[${time}] [${levelStr}] [${entry.category}] ${entry.message}`;
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  private log(level: LogLevel, category: string, message: string, data?: any): void {
    const entry: LogEntry = {
      level,
      timestamp: new Date(),
      category,
      message,
      data
    };

    this.addToBuffer(entry);

    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(entry);

    switch (level) {
      case LogLevel.DEBUG:
        if (data !== undefined) {
          console.debug(formattedMessage, data);
        } else {
          console.debug(formattedMessage);
        }
        break;
      case LogLevel.INFO:
        if (data !== undefined) {
          console.info(formattedMessage, data);
        } else {
          console.info(formattedMessage);
        }
        break;
      case LogLevel.WARN:
        if (data !== undefined) {
          console.warn(formattedMessage, data);
        } else {
          console.warn(formattedMessage);
        }
        break;
      case LogLevel.ERROR:
        if (data !== undefined) {
          console.error(formattedMessage, data);
        } else {
          console.error(formattedMessage);
        }
        
        // In production, send errors to monitoring service
        if (!this.isDevelopment && window.location.hostname !== 'localhost') {
          this.sendToMonitoring(entry);
        }
        break;
    }
  }

  /**
   * Send error logs to monitoring service (e.g., Sentry, DataDog)
   */
  private sendToMonitoring(entry: LogEntry): void {
    // This would integrate with your monitoring service
    // For now, we'll just store critical errors
    try {
      const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      errors.push({
        timestamp: entry.timestamp.toISOString(),
        category: entry.category,
        message: entry.message,
        data: entry.data
      });
      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50);
      }
      localStorage.setItem('app_errors', JSON.stringify(errors));
    } catch (e) {
      // Fail silently if localStorage is not available
    }
  }

  // Public logging methods
  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  /**
   * Get recent log entries (useful for debugging)
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear the log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Set the log level dynamically
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

// Create singleton instance
const logger = new LoggingService();

// Export singleton instance and convenience functions
export default logger;

// Convenience exports for easy migration from console.log
export const logDebug = (category: string, message: string, data?: any) => 
  logger.debug(category, message, data);

export const logInfo = (category: string, message: string, data?: any) => 
  logger.info(category, message, data);

export const logWarn = (category: string, message: string, data?: any) => 
  logger.warn(category, message, data);

export const logError = (category: string, message: string, data?: any) => 
  logger.error(category, message, data);