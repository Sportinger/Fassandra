/**
 * Common TypeScript Type Definitions
 * 
 * Centralized type definitions to replace 'any' types
 * and improve type safety across the application
 */

/**
 * Generic error type for catch blocks
 */
export interface AppError {
  message: string;
  code?: string;
  status?: number;
  stack?: string;
}

/**
 * API request body type - flexible for various request payloads
 */
export type RequestBody = Record<string, any> | any;

/**
 * API validation rules
 */
export type ValidationRules = Record<string, unknown>;

/**
 * WebSocket event data
 */
export type WebSocketEventData = string | ArrayBuffer | Blob | ArrayBufferView;

/**
 * WebSocket event callback
 */
export type WebSocketCallback = (data: WebSocketEventData) => void;

/**
 * Logging data type - permissive for various data types
 */
export type LogData = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined
  | Record<string, unknown>
  | Array<unknown>
  | Error
  | unknown; // Allow unknown for flexibility in logging

/**
 * User action details for logging
 */
export interface UserActionDetails {
  component?: string;
  action: string;
  target?: string;
  value?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Remote monitoring error entry
 */
export interface RemoteErrorEntry {
  timestamp: string;
  category: string;
  message: string;
  data?: LogData;
  userAgent: string;
  url: string;
  sessionId: string;
  stack?: string;
}

/**
 * Yjs update origin type
 */
export type YjsUpdateOrigin = 
  | { clientID: number }
  | { type: 'local' | 'remote' | 'undo' | 'redo' }
  | string
  | null;

/**
 * Type guard for Error objects
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard for AppError objects
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as AppError).message === 'string'
  );
}

/**
 * Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (isAppError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Safe error code extraction
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isAppError(error)) {
    return error.code;
  }
  return undefined;
}