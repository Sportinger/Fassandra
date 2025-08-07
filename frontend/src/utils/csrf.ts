import logger from '../services/LoggingService';

/**
 * CSRF Token Management
 * Handles fetching and caching CSRF tokens for secure requests
 */

let csrfToken: string | null = null;

/**
 * Fetches a CSRF token from the backend
 * The backend should set this as a cookie and return it in the response
 */
export async function fetchCSRFToken(): Promise<string> {
    try {
        const response = await fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'include', // Include cookies
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch CSRF token: ${response.status}`);
        }

        const data = await response.json();
        csrfToken = data.token;
        return csrfToken;
    } catch (error) {
        logger.error('csrf', 'Error fetching CSRF token:', error);
        throw error;
    }
}

/**
 * Gets the current CSRF token, fetching it if necessary
 */
export async function getCSRFToken(): Promise<string> {
    if (!csrfToken) {
        return await fetchCSRFToken();
    }
    return csrfToken;
}

/**
 * Clears the cached CSRF token
 */
export function clearCSRFToken(): void {
    csrfToken = null;
}