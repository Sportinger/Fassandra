/**
 * Generic API Service
 * Eliminates boilerplate code and provides type-safe API calls
 */

import { logDebugInfo } from '../utils/debug';

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
    body?: any;
    headers?: Record<string, string>;
    requireAuth?: boolean;
    validate?: Record<string, any>;
}

/**
 * Generic API Service Class
 * Handles authentication, validation, and common patterns
 */
export class ApiService {
    private baseUrl: string;
    private token: string | null = null;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || 
            (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
            (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
            '';
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
    private buildHeaders(options: RequestOptions): Record<string, string> {
        const headers: Record<string, string> = { ...options.headers };

        // Add auth header if required
        if (options.requireAuth !== false) {
            if (!this.token) {
                throw new ApiError('Authentication token is required', 401, 'Unauthorized');
            }
            headers['Authorization'] = `Bearer ${this.token}`;
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
                headers: this.buildHeaders(options),
                body: options.body ? JSON.stringify(options.body) : undefined,
            });

            logDebugInfo('API', `Response: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                let errorBody = 'Unknown error';
                try {
                    errorBody = await response.text();
                } catch (e) {
                    console.warn('Failed to read error response body:', e);
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
    async get<T>(path: string, validate?: Record<string, any>): Promise<T> {
        return this.request<T>(path, { method: 'GET', validate });
    }

    async post<T>(path: string, body?: any, validate?: Record<string, any>): Promise<T> {
        return this.request<T>(path, { method: 'POST', body, validate });
    }

    async patch<T>(path: string, body?: any, validate?: Record<string, any>): Promise<T> {
        return this.request<T>(path, { method: 'PATCH', body, validate });
    }

    async put<T>(path: string, body?: any, validate?: Record<string, any>): Promise<T> {
        return this.request<T>(path, { method: 'PUT', body, validate });
    }

    async delete<T>(path: string, validate?: Record<string, any>): Promise<T> {
        return this.request<T>(path, { method: 'DELETE', validate });
    }
}

// Export a singleton instance
export const apiService = new ApiService(); 