import { logDebugInfo } from '../utils/debug';
import { getCSRFToken } from '../utils/csrf';
import { RequestBody, ValidationRules } from '../types/common';
import logger from '../services/LoggingService';
/**
 * Generic API Service
 * Eliminates boilerplate code and provides type-safe API calls
 */

/**
 * API Error class for handling HTTP errors
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public statusText: string,
        public body?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Request options interface
 */
interface RequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: RequestBody;
    headers?: Record<string, string>;
    requireAuth?: boolean;
    validate?: ValidationRules;
}

/**
 * Generic API Service Class
 * Handles authentication, validation, and common patterns
 */
export class ApiService {
    private baseUrl: string;
    private token: string | null = null;

    constructor(baseUrl?: string) {
        // Check if we're in a Capacitor app context
        const isCapacitorApp = typeof window !== 'undefined' && (
            window.location.protocol === 'capacitor:' || 
            window.location.protocol === 'ionic:' ||
            (window as any).Capacitor !== undefined
        );
        
        if (isCapacitorApp) {
            // In Capacitor app, always use the configured backend URL
            const envBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
                (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
                'https://mylayer.org'; // Fallback to production URL
            
            // Handle quoted empty strings and clean up
            const cleanEnvUrl = envBaseUrl.replace(/^["']|["']$/g, '').trim();
            
            // Never use empty string for Capacitor - must have a real backend URL
            this.baseUrl = baseUrl || (cleanEnvUrl !== '' ? cleanEnvUrl : 'https://mylayer.org');
            
            logger.debug('ApiService', '[ApiService] 📱 Capacitor app detected - using backend:', this.baseUrl);
        } else {
            // In browser, use relative URLs (empty string) or configured URL
            const envBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
                (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
                '';
            
            // Handle quoted empty strings and clean up
            const cleanEnvUrl = envBaseUrl.replace(/^["']|["']$/g, '').trim();
            
            this.baseUrl = baseUrl || (cleanEnvUrl !== '' ? cleanEnvUrl : '');
            
            logger.debug('ApiService', '[ApiService] 🌐 Browser context - base URL:', JSON.stringify(this.baseUrl));
        }
        
        // Debug logging
        logger.debug('ApiService', '[ApiService] Base URL set to:', JSON.stringify(this.baseUrl));
    }

    /**
     * Set authentication token
     */
    setToken(token: string | null) {
        this.token = token;
    }

    /**
     * Validate required parameters
     */
    private validateParams(params: Record<string, any>): void {
        for (const [key, value] of Object.entries(params)) {
            if (!value) {
                const fieldName = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                throw new ApiError(`${fieldName} is required`, 400, 'Bad Request');
            }
        }
    }

    /**
     * Build request headers
     */
    private async buildHeaders(options: RequestOptions, path: string): Promise<Record<string, string>> {
        const headers: Record<string, string> = { ...options.headers };

        // Note: Authentication is now handled via httpOnly cookies
        // Don't send Bearer token for cookie-based auth (token is just a flag)
        // Only send actual JWT tokens, not placeholder values
        if (this.token && this.token !== 'authenticated' && options.requireAuth !== false) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        // Add CSRF token for state-changing requests (but not for auth endpoints)
        const isAuthEndpoint = path === '/login' || path === '/register';
        if (!isAuthEndpoint && options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
            try {
                const csrfToken = await getCSRFToken();
                headers['X-CSRF-Token'] = csrfToken;
            } catch (error) {
                logger.warn('ApiService', 'Failed to get CSRF token:', error);
                // Continue without CSRF token if it fails
            }
        }

        // Add content-type for requests with body
        if (options.body && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        return headers;
    }

    /**
     * Generic API request method
     */
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
        // Validate required parameters
        if (options.validate) {
            this.validateParams(options.validate);
        }

        const url = `${this.baseUrl}${path}`;
        const method = options.method || 'GET';
        
        logDebugInfo('API', `Requesting: ${method} ${url}`);

        try {
            const response = await fetch(url, {
                method,
                headers: await this.buildHeaders(options, path),
                body: options.body ? JSON.stringify(options.body) : undefined,
                credentials: 'include', // Include cookies in requests for httpOnly cookie support
            });

            logDebugInfo('API', `Response: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                let errorBody = 'Unknown error';
                try {
                    errorBody = await response.text();
                } catch (e) {
                    logger.warn('ApiService', 'Failed to read error response body:', e);
                }
                
                throw new ApiError(
                    `API Error: ${response.status} ${response.statusText}`,
                    response.status,
                    response.statusText,
                    errorBody
                );
            }

            // Handle NO_CONTENT responses
            if (response.status === 204) {
                return undefined as T;
            }

            const contentType = response.headers.get('content-type');
            
            // Handle JSON responses
            if (contentType?.includes('application/json')) {
                const data = await response.json() as T;
                return data;
            }
            
            // Handle text responses
            if (contentType?.includes('text/plain')) {
                const text = await response.text();
                try {
                    return JSON.parse(text) as T;
                } catch {
                    return text as T;
                }
            }

            throw new ApiError(
                `Unexpected content type: ${contentType}`,
                response.status,
                response.statusText
            );

        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(
                `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                0,
                'Network Error'
            );
        }
    }

    /**
     * Convenience methods for common HTTP verbs
     */
    async get<T>(path: string, validate?: ValidationRules): Promise<T> {
        return this.request<T>(path, { method: 'GET', validate });
    }

    async post<T>(path: string, body?: RequestBody, validate?: ValidationRules): Promise<T> {
        return this.request<T>(path, { method: 'POST', body, validate });
    }

    async patch<T>(path: string, body?: RequestBody, validate?: ValidationRules): Promise<T> {
        return this.request<T>(path, { method: 'PATCH', body, validate });
    }

    async put<T>(path: string, body?: RequestBody, validate?: ValidationRules): Promise<T> {
        return this.request<T>(path, { method: 'PUT', body, validate });
    }

    async delete<T>(path: string, validate?: ValidationRules): Promise<T> {
        return this.request<T>(path, { method: 'DELETE', validate });
    }
}

// Export a singleton instance that uses environment variables or relative URLs
export const apiService = new ApiService(); 