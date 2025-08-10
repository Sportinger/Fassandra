/**
 * Refactored API - Using Generic ApiService
 * Demonstrates significant reduction in boilerplate code
 */

import { apiService } from './services/ApiService';
import { Script, ScriptWithBlocks, Edit, ScriptShare, ScriptShareWithUser, ShareScriptRequest, ScriptLayout, CreateScriptLayoutRequest, UpdateScriptLayoutRequest } from './types';
import { apiCache, CACHE_CONFIG, invalidateScriptCaches } from './utils/apiCache';
import { createDebouncedAPI, createThrottledAPI } from './utils/rateLimit';

// Set up the API service token (this would be called from AuthContext)
export const setApiToken = (token: string | null) => {
    apiService.setToken(token);
};

// --- Authentication --- //

export const login = async (email: string, password: string): Promise<any> => {
    // Check if we're in a Capacitor app
    const isCapacitor = (window as any).Capacitor !== undefined || 
                       (window.location.hostname === 'localhost' && window.location.protocol === 'https:');
    
    const headers: Record<string, string> = {};
    
    // Add mobile app header for Capacitor apps so backend returns JWT in response body
    // Commented out - mylayer.org CORS doesn't allow X-Mobile-App header
    // if (isCapacitor) {
    //     headers['X-Mobile-App'] = 'true';
    // }
    
    return apiService.request('/login', {
        method: 'POST',
        body: { email, password },
        headers,
        requireAuth: false, // Login doesn't require auth token
        validate: { email, password }
    });
};

export const register = async (email: string, username: string, password: string): Promise<any> => {
    return apiService.request('/register', {
        method: 'POST',
        body: { email, username, password },
        requireAuth: false, // Register doesn't require auth token
        validate: { email, username, password }
    });
};

export const getCurrentUser = async (): Promise<{ id: string; email: string; username: string; role: string; created_at: string }> => {
    return apiService.get('/api/me');
};

// --- Scripts --- //

export const getScripts = async (forceRefresh = false): Promise<Script[]> => {
    const response = await apiCache.cachedFetch(
        '/api/scripts',
        () => apiService.get<Script[]>('/api/scripts'),
        { ttl: CACHE_CONFIG.scripts.list, forceRefresh }
    );
    return Array.isArray(response) ? response : [];
};

export const createScript = async (title: string): Promise<Script> => {
    const result = await apiService.post<Script>('/api/scripts', { title }, { title });
    // Invalidate script list cache after creating
    invalidateScriptCaches();
    return result;
};

export const getScriptWithBlocks = async (scriptId: string, forceRefresh = false): Promise<ScriptWithBlocks> => {
    return apiCache.cachedFetch(
        `/api/scripts/${scriptId}`,
        () => apiService.get(`/api/scripts/${scriptId}`, { scriptId }),
        { ttl: CACHE_CONFIG.scripts.detail, forceRefresh }
    );
};

export const updateScript = async (scriptId: string, title: string): Promise<Script> => {
    const result = await apiService.patch<Script>(`/api/scripts/${scriptId}`, { title }, { scriptId, title });
    // Invalidate caches after update
    invalidateScriptCaches(scriptId);
    return result;
};

export const deleteScript = async (scriptId: string): Promise<void> => {
    await apiService.delete(`/api/scripts/${scriptId}`, { scriptId });
    // Invalidate caches after deletion
    invalidateScriptCaches();
};

// --- Blocks --- //

export const createBlock = async (scriptId: string, blockType: string, content: string): Promise<string> => {
    return apiService.post(`/api/scripts/${scriptId}/blocks`, 
        { block_type: blockType, content }, 
        { scriptId, blockType, content }
    );
};

export const updateBlock = async (blockId: string, content: string): Promise<void> => {
    return apiService.patch(`/api/blocks/${blockId}`, { content }, { blockId, content });
};

export const saveContentToServer = async (scriptId: string, htmlContent: string): Promise<void> => {
    return apiService.patch(`/api/scripts/${scriptId}/content`, 
        { content: htmlContent }, 
        { scriptId, htmlContent }
    );
};

export const getBlockHistory = async (blockId: string): Promise<Edit[]> => {
    return apiService.get(`/api/blocks/${blockId}/history`, { blockId });
};

// --- Script Sharing --- //

export const shareScript = async (scriptId: string, request: ShareScriptRequest): Promise<ScriptShare> => {
    return apiService.post(`/api/s/${scriptId}/share`, request, { 
        scriptId, 
        username: request.username, 
        permission: request.permission 
    });
};

export const getScriptShares = async (scriptId: string): Promise<ScriptShareWithUser[]> => {
    const response = await apiService.get<Array<[ScriptShare, string]>>(`/api/s/${scriptId}/shares`, { scriptId });
    return response.map(([share, username]) => ({ ...share, username }));
};

export const removeScriptShare = async (scriptId: string, shareId: string): Promise<void> => {
    return apiService.delete(`/api/s/${scriptId}/shares/${shareId}`, { scriptId, shareId });
};

export const toggleScriptPublic = async (scriptId: string): Promise<boolean> => {
    return apiService.patch(`/api/s/${scriptId}/public`, {}, { scriptId });
};

// --- Thumbnails --- //

export const generateAllThumbnails = async (): Promise<number> => {
    return apiService.post('/api/s/thumbnails/generate');
};

export const regenerateAllThumbnails = async (): Promise<number> => {
    return apiService.post('/api/s/thumbnails/regenerate');
};

// --- Script Layouts --- //

export const getScriptLayouts = async (scriptId: string): Promise<ScriptLayout[]> => {
    return apiService.get(`/api/scripts/${scriptId}/layouts`, { scriptId });
};

export const getDefaultScriptLayout = async (scriptId: string): Promise<ScriptLayout | null> => {
    return apiService.get(`/api/scripts/${scriptId}/layouts/default`, { scriptId });
};

export const createScriptLayout = async (scriptId: string, request: CreateScriptLayoutRequest): Promise<ScriptLayout> => {
    return apiService.post(`/api/scripts/${scriptId}/layouts`, request, { scriptId });
};

export const updateScriptLayout = async (scriptId: string, layoutId: string, request: UpdateScriptLayoutRequest): Promise<ScriptLayout> => {
    return apiService.patch(`/api/scripts/${scriptId}/layouts/${layoutId}`, request, { scriptId, layoutId });
};

export const deleteScriptLayout = async (scriptId: string, layoutId: string): Promise<void> => {
    return apiService.delete(`/api/scripts/${scriptId}/layouts/${layoutId}`, { scriptId, layoutId });
};

// --- Content Snapshots --- //

export const storeContentSnapshot = async (scriptId: string, content: string, format: string = 'html'): Promise<void> => {
    return apiService.post(`/api/scripts/${scriptId}/snapshot`, { content, format }, { scriptId, content });
};

export const getContentSnapshot = async (scriptId: string): Promise<{script_id: string, content: string, format: string, created_at: string | null}> => {
    return apiService.get(`/api/scripts/${scriptId}/snapshot`, { scriptId });
};

// --- Page Breaks --- //

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

export const getPageBreaks = async (scriptId: string): Promise<PageBreaksResponse> => {
    return apiService.get(`/api/scripts/${scriptId}/page-breaks`, { scriptId });
};

export const updatePageBreaks = async (scriptId: string, updates: PageBreakUpdate[]): Promise<{ success: boolean; message: string }> => {
    return apiService.patch(`/api/scripts/${scriptId}/page-breaks`, { updates }, { scriptId });
};

// --- Legacy compatibility --- //

export type ParsedScriptData = any; // TODO: Define proper type based on backend

export const createScriptFromParsed = async (parsedScriptData: ParsedScriptData): Promise<string> => {
    return apiService.post('/api/s/create_script_from_parsed', { parsed_script: parsedScriptData });
};

// Export the original ApiError for backward compatibility
export { ApiError } from './services/ApiService'; 