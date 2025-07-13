import { Script, ScriptWithBlocks, /* Block, */ Edit, User, ScriptShare, ScriptShareWithUser, ShareScriptRequest, ScriptLayout, CreateScriptLayoutRequest, UpdateScriptLayoutRequest } from './types';
import { logDebugInfo } from './utils/debug';

/**
 * The base URL for the backend API, set via Vite's environment variable or defaults to localhost.
 * Falls back to process.env.VITE_API_BASE_URL for Jest tests.
 * @type {string}
 */
const API_BASE_URL: string =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE_URL)
      ? process.env.VITE_API_BASE_URL
      : '';

if (
  typeof import.meta !== 'undefined' && import.meta.env && !import.meta.env.VITE_API_BASE_URL
) {
  console.log('VITE_API_BASE_URL not set. Using relative URLs for API requests.');
}

/**
 * Custom error class for API errors.
 * @extends Error
 * @property {number} status - HTTP status code.
 * @property {string} statusText - HTTP status text.
 * @property {string} [body] - Optional error response body.
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
 * Helper function to perform fetch requests and parse JSON responses.
 * Throws ApiError on HTTP or network errors.
 *
 * @template T
 * @param {string} path - API endpoint path (relative to API_BASE_URL).
 * @param {RequestInit} [options] - Fetch options.
 * @returns {Promise<T>} - Parsed response data.
 * @throws {ApiError} - On HTTP or network error.
 */
async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    
    logDebugInfo('API', `Requesting: ${options.method || 'GET'} ${url}`);
    
    try {
        const response = await fetch(url, options);
        
        logDebugInfo('API', `Response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            let errorBody = 'Unknown error';
            try {
                errorBody = await response.text();
            } catch (e) {
                console.warn('Failed to read error response body:', e);
                logDebugInfo('API', `Failed to read error body: ${e}`);
            }
            
            logDebugInfo('API', `Error body: ${errorBody}`);
            
            throw new ApiError(
                `API Error: ${response.status} ${response.statusText}`,
                response.status,
                response.statusText,
                errorBody
            );
        }

        // Handle NO_CONTENT responses
        if (response.status === 204) {
            logDebugInfo('API', 'No content response');
            return undefined as T;
        }

        const contentType = response.headers.get('content-type');
        logDebugInfo('API', `Content-Type: ${contentType}`);
        
        // Handle JSON responses
        if (contentType?.includes('application/json')) {
            const data = await response.json() as T;
            logDebugInfo('API', `JSON response received (${JSON.stringify(data).length} chars)`);
            return data;
        }
        
        // Handle text responses
        if (contentType?.includes('text/plain')) {
            const text = await response.text();
            try {
                const data = JSON.parse(text) as T;
                logDebugInfo('API', `Text/JSON response parsed (${text.length} chars)`);
                return data;
            } catch {
                logDebugInfo('API', `Text response (${text.length} chars)`);
                return text as T;
            }
        }

        throw new ApiError(
            `Unexpected content type: ${contentType}`,
            response.status,
            response.statusText
        );

    } catch (error) {
        logDebugInfo('API', `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
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

// --- Authentication --- //

/**
 * Authenticates a user and returns a JWT token.
 * @param {string} email - User's email address.
 * @param {string} password - User's password.
 * @returns {Promise<string>} - JWT token on success.
 * @throws {ApiError} - On missing parameters or authentication failure.
 */
export async function login(email: string, password: string): Promise<string> {
    if (!email || !password) {
        throw new ApiError('Email and password are required', 400, 'Bad Request');
    }
    return fetchApi<string>('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
}

/**
 * Registers a new user and returns a JWT token.
 * @param {string} email - User's email address.
 * @param {string} username - Desired username.
 * @param {string} password - Desired password.
 * @returns {Promise<string>} - JWT token on success.
 * @throws {ApiError} - On missing parameters or registration failure.
 */
export async function register(email: string, username: string, password: string): Promise<string> {
    if (!email || !username || !password) {
        throw new ApiError('Email, username, and password are required', 400, 'Bad Request');
    }
    return fetchApi<string>('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
    });
}

// --- Scripts --- //

// Define the expected structure for the /api/scripts response
interface ScriptsApiResponse {
    "0": Script[]; // Backend might be wrapping the array like this { "0": [...] }
}

/**
 * Fetches all scripts for the authenticated user.
 * @param {string} token - Authentication token.
 * @returns {Promise<Script[]>} - Array of scripts.
 * @throws {ApiError} - On missing token or fetch failure.
 */
export async function getScripts(token: string): Promise<Script[]> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    
    const response = await fetchApi<Script[]>('/api/scripts', {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!Array.isArray(response)) {
        console.error('Unexpected format for scripts response:', response);
        return [];
    }
    
    return response;
}

/**
 * Creates a new script for the authenticated user.
 * @param {string} token - Authentication token.
 * @param {string} title - Title of the new script.
 * @returns {Promise<Script>} - The new script object.
 * @throws {ApiError} - On missing parameters or creation failure.
 */
export async function createScript(token: string, title: string): Promise<Script> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!title) {
        throw new ApiError('Script title is required', 400, 'Bad Request');
    }
    return fetchApi<Script>('/api/scripts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title }),
    });
}

/**
 * Fetches a script and its blocks by script ID.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - The script's ID.
 * @returns {Promise<ScriptWithBlocks>} - The script and its blocks.
 * @throws {ApiError} - On missing parameters or fetch failure.
 */
export async function getScriptWithBlocks(token: string, scriptId: string): Promise<ScriptWithBlocks> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId) {
        throw new ApiError('Script ID is required', 400, 'Bad Request');
    }
    
    return fetchApi<ScriptWithBlocks>(`/api/scripts/${scriptId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
}

/**
 * Updates a script's title for the authenticated user.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script to update.
 * @param {string} title - New title for the script.
 * @returns {Promise<Script>} - The updated script object.
 * @throws {ApiError} - On missing parameters or update failure.
 */
export async function updateScript(token: string, scriptId: string, title: string): Promise<Script> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId) {
        throw new ApiError('Script ID is required', 400, 'Bad Request');
    }
    if (!title) {
        throw new ApiError('Script title is required', 400, 'Bad Request');
    }
    return fetchApi<Script>(`/api/scripts/${scriptId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title }),
    });
}

/**
 * Deletes a script by ID.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script to delete.
 * @returns {Promise<void>} - Resolves on success.
 * @throws {ApiError} - On missing parameters or deletion failure.
 */
export async function deleteScript(token: string, scriptId: string): Promise<void> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId) {
        throw new ApiError('Script ID is required', 400, 'Bad Request');
    }
    
    await fetchApi<void>(`/api/scripts/${scriptId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
}

// --- Blocks --- //

/**
 * Creates a new block for a script.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - The script's ID.
 * @param {string} blockType - The type of the block (e.g., 'text').
 * @param {string} content - The content of the block.
 * @returns {Promise<string>} - The new block's ID.
 * @throws {ApiError} - On missing parameters or creation failure.
 */
export async function createBlock(token: string, scriptId: string, blockType: string, content: string): Promise<string> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId || !blockType || !content) {
        throw new ApiError('Script ID, block type, and content are required', 400, 'Bad Request');
    }
    
    return fetchApi<string>(`/api/scripts/${scriptId}/blocks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ block_type: blockType, content }),
    });
}

/**
 * Updates the content of a block.
 * @param {string} token - Authentication token.
 * @param {string} blockId - The block's ID.
 * @param {string} content - The new content for the block.
 * @returns {Promise<void>} - Resolves on success.
 * @throws {ApiError} - On missing parameters or update failure.
 */
export async function updateBlock(token: string, blockId: string, content: string): Promise<void> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!blockId || !content) {
        throw new ApiError('Block ID and content are required', 400, 'Bad Request');
    }
    
    await fetchApi<void>(`/api/blocks/${blockId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
    });
}

/**
 * Saves the entire script content from TipTap editor to the database.
 * This provides persistence for collaborative edits by converting HTML to structured blocks.
 * 
 * @param {string} token - Authentication token.
 * @param {string} scriptId - The script's ID.
 * @param {string} htmlContent - HTML content from TipTap editor.
 * @returns {Promise<void>} - Resolves on success.
 * @throws {ApiError} - On missing parameters or save failure.
 */
export async function saveContentToServer(token: string, scriptId: string, htmlContent: string): Promise<void> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId) {
        throw new ApiError('Script ID is required', 400, 'Bad Request');
    }
    if (!htmlContent) {
        throw new ApiError('Content is required', 400, 'Bad Request');
    }
    
    logDebugInfo('API', `Saving script content: ${scriptId} (${htmlContent.length} chars)`);
    
    await fetchApi<void>(`/api/scripts/${scriptId}/content`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: htmlContent }),
    });
    
    logDebugInfo('API', `Successfully saved script content for ${scriptId}`);
}

/**
 * Fetches the edit history for a block.
 * @param {string} token - Authentication token.
 * @param {string} blockId - The block's ID.
 * @returns {Promise<Edit[]>} - Array of edits.
 * @throws {ApiError} - On missing parameters or fetch failure.
 */
export async function getBlockHistory(token: string, blockId: string): Promise<Edit[]> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!blockId) {
        throw new ApiError('Block ID is required', 400, 'Bad Request');
    }
    
    return fetchApi<Edit[]>(`/api/blocks/${blockId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
}

// Define a type for the parsed script data received from the /upload endpoint
// This should match the backend's analysis::structs::Script structure
// Using 'any' for now, but ideally define this properly based on backend/src/analysis/structs.rs
export type ParsedScriptData = any; 

/**
 * Creates a new script in the database from previously parsed data.
 * 
 * @param {string} token - Authentication token.
 * @param {ParsedScriptData} parsedScriptData - The parsed script data.
 * @returns {Promise<string>} - The UUID of the newly created script.
 * @throws {ApiError} - On network or API error.
 */
export async function createScriptFromParsed(token: string, parsedScriptData: ParsedScriptData): Promise<string> {
    
    // --- DEBUGGING REMOVED ---
    // console.log("Data being sent to /create_script_from_parsed:", JSON.stringify(parsedScriptData));
    // --- END DEBUGGING REMOVED ---

    // Update the path to use underscore
    return fetchApi<string>('/api/s/create_script_from_parsed', { 
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        // --- DEBUGGING REMOVED: Restore original body ---
        body: JSON.stringify({ parsed_script: parsedScriptData }),
        // body: JSON.stringify({ test: "dummy" }), 
        // --- END DEBUGGING REMOVED ---
    });
}

// --- Script Sharing --- //

/**
 * Shares a script with another user.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script to share.
 * @param {ShareScriptRequest} request - Share request with username and permission.
 * @returns {Promise<ScriptShare>} - The created share entry.
 * @throws {ApiError} - On missing parameters or sharing failure.
 */
export async function shareScript(token: string, scriptId: string, request: ShareScriptRequest): Promise<ScriptShare> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId) {
        throw new ApiError('Script ID is required', 400, 'Bad Request');
    }
    if (!request.username || !request.permission) {
        throw new ApiError('Username and permission are required', 400, 'Bad Request');
    }
    
    return fetchApi<ScriptShare>(`/api/s/${scriptId}/share`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
    });
}

/**
 * Gets all shares for a script.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script.
 * @returns {Promise<ScriptShareWithUser[]>} - Array of shares with usernames.
 * @throws {ApiError} - On missing parameters or fetch failure.
 */
export async function getScriptShares(token: string, scriptId: string): Promise<ScriptShareWithUser[]> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId) {
        throw new ApiError('Script ID is required', 400, 'Bad Request');
    }
    
    const response = await fetchApi<Array<[ScriptShare, string]>>(`/api/s/${scriptId}/shares`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    
    // Transform the tuple response into ScriptShareWithUser objects
    return response.map(([share, username]) => ({
        ...share,
        username,
    }));
}

/**
 * Removes a script share.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script.
 * @param {string} shareId - ID of the share to remove.
 * @returns {Promise<void>} - Resolves on success.
 * @throws {ApiError} - On missing parameters or deletion failure.
 */
export async function removeScriptShare(token: string, scriptId: string, shareId: string): Promise<void> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId || !shareId) {
        throw new ApiError('Script ID and Share ID are required', 400, 'Bad Request');
    }
    
    await fetchApi<void>(`/api/s/${scriptId}/shares/${shareId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
}

/**
 * Toggles a script's public status.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script.
 * @returns {Promise<boolean>} - The new public status.
 * @throws {ApiError} - On missing parameters or update failure.
 */
export async function toggleScriptPublic(token: string, scriptId: string): Promise<boolean> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId) {
        throw new ApiError('Script ID is required', 400, 'Bad Request');
    }
    
    return fetchApi<boolean>(`/api/s/${scriptId}/public`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
    });
}

/**
 * Generates thumbnails for all scripts that don't have one.
 * @param {string} token - Authentication token.
 * @returns {Promise<number>} - Number of thumbnails generated.
 * @throws {ApiError} - On missing token or API failure.
 */
export async function generateAllThumbnails(token: string): Promise<number> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    
    return fetchApi<number>('/api/s/thumbnails/generate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
    });
}

/**
 * Regenerates thumbnails for ALL scripts (forces refresh).
 * @param {string} token - Authentication token.
 * @returns {Promise<number>} - Number of thumbnails regenerated.
 * @throws {ApiError} - On missing token or API failure.
 */
export async function regenerateAllThumbnails(token: string): Promise<number> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    
    return fetchApi<number>('/api/s/thumbnails/regenerate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
    });
}

// === Script Layout Management === //

/**
 * Gets all layouts for a script.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script.
 * @returns {Promise<ScriptLayout[]>} - Array of layouts.
 * @throws {ApiError} - On missing parameters or fetch failure.
 */
export async function getScriptLayouts(token: string, scriptId: string): Promise<ScriptLayout[]> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId) {
        throw new ApiError('Script ID is required', 400, 'Bad Request');
    }
    
    return fetchApi<ScriptLayout[]>(`/api/scripts/${scriptId}/layouts`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
}

/**
 * Gets the default layout for a script.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script.
 * @returns {Promise<ScriptLayout|null>} - The default layout or null.
 * @throws {ApiError} - On missing parameters or fetch failure.
 */
export async function getDefaultScriptLayout(token: string, scriptId: string): Promise<ScriptLayout | null> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId) {
        throw new ApiError('Script ID is required', 400, 'Bad Request');
    }
    
    return fetchApi<ScriptLayout | null>(`/api/scripts/${scriptId}/layouts/default`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
}

/**
 * Creates a new layout for a script.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script.
 * @param {CreateScriptLayoutRequest} request - Layout creation request.
 * @returns {Promise<ScriptLayout>} - The created layout.
 * @throws {ApiError} - On missing parameters or creation failure.
 */
export async function createScriptLayout(token: string, scriptId: string, request: CreateScriptLayoutRequest): Promise<ScriptLayout> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId) {
        throw new ApiError('Script ID is required', 400, 'Bad Request');
    }
    if (!request.name || !request.layout_config) {
        throw new ApiError('Name and layout config are required', 400, 'Bad Request');
    }
    
    return fetchApi<ScriptLayout>(`/api/scripts/${scriptId}/layouts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
    });
}

/**
 * Updates an existing script layout.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script.
 * @param {string} layoutId - ID of the layout to update.
 * @param {UpdateScriptLayoutRequest} request - Layout update request.
 * @returns {Promise<ScriptLayout>} - The updated layout.
 * @throws {ApiError} - On missing parameters or update failure.
 */
export async function updateScriptLayout(token: string, scriptId: string, layoutId: string, request: UpdateScriptLayoutRequest): Promise<ScriptLayout> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId || !layoutId) {
        throw new ApiError('Script ID and Layout ID are required', 400, 'Bad Request');
    }
    
    return fetchApi<ScriptLayout>(`/api/scripts/${scriptId}/layouts/${layoutId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
    });
}

/**
 * Deletes a script layout.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script.
 * @param {string} layoutId - ID of the layout to delete.
 * @returns {Promise<void>} - Resolves on success.
 * @throws {ApiError} - On missing parameters or deletion failure.
 */
export async function deleteScriptLayout(token: string, scriptId: string, layoutId: string): Promise<void> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId || !layoutId) {
        throw new ApiError('Script ID and Layout ID are required', 400, 'Bad Request');
    }
    
    await fetchApi<void>(`/api/scripts/${scriptId}/layouts/${layoutId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
} 

/**
 * Stores a content snapshot for a script.
 * @param {string} token - Authentication token.
 * @param {string} scriptId - ID of the script.
 * @param {string} content - HTML content to store.
 * @param {string} format - Content format (default: 'html').
 * @returns {Promise<void>} - Resolves on success.
 * @throws {ApiError} - On missing parameters or storage failure.
 */
export async function storeContentSnapshot(token: string, scriptId: string, content: string, format: string = 'html'): Promise<void> {
    if (!token) {
        throw new ApiError('Authentication token is required', 401, 'Unauthorized');
    }
    if (!scriptId) {
        throw new ApiError('Script ID is required', 400, 'Bad Request');
    }
    if (!content) {
        throw new ApiError('Content is required', 400, 'Bad Request');
    }
    
    await fetchApi<void>(`/api/scripts/${scriptId}/snapshot`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content, format }),
    });
} 

// ============================================================================
// PAGE BREAK API
// ============================================================================

export interface PageBreakInfo {
  block_id: string;
  block_type: string;
  content_preview: string;
  page_number: number;
  block_order: number;
}

export interface PageBreaksResponse {
  script_id: string;
  blocks: PageBreakInfo[];
}

export interface PageBreakUpdate {
  block_id: string;
  page_number: number;
}

/**
 * Gets page break information for a script
 */
export const getPageBreaks = async (scriptId: string, token: string): Promise<PageBreaksResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/scripts/${scriptId}/page-breaks`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get page breaks' }));
    throw new Error(error.error || 'Failed to get page breaks');
  }

  return response.json();
};

/**
 * Updates page break information for a script
 */
export const updatePageBreaks = async (
  scriptId: string, 
  updates: PageBreakUpdate[], 
  token: string
): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/scripts/${scriptId}/page-breaks`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ blocks: updates }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update page breaks' }));
    throw new Error(error.error || 'Failed to update page breaks');
  }

  return response.json();
}; 