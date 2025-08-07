/**
 * API Request Caching Layer
 * 
 * Implements intelligent caching for API requests to reduce
 * network overhead and improve performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  key?: string; // Custom cache key
  forceRefresh?: boolean; // Bypass cache
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Generate cache key from URL and params
   */
  private generateKey(url: string, params?: any): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${url}:${paramString}`;
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() < entry.expiresAt;
  }

  /**
   * Get cached data if available and valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (this.isValid(entry)) {
      return entry.data;
    }
    
    // Remove expired entry
    this.cache.delete(key);
    return null;
  }

  /**
   * Store data in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt
    });
  }

  /**
   * Clear specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all cache entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Wrap fetch request with caching
   */
  async cachedFetch<T>(
    url: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const key = options.key || this.generateKey(url);
    
    // Check if we should bypass cache
    if (options.forceRefresh) {
      this.invalidate(key);
    }
    
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Check if request is already pending (dedupe)
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending;
    }
    
    // Make the request
    const request = fetchFn()
      .then(data => {
        this.set(key, data, options.ttl);
        this.pendingRequests.delete(key);
        return data;
      })
      .catch(error => {
        this.pendingRequests.delete(key);
        throw error;
      });
    
    this.pendingRequests.set(key, request);
    return request;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let validCount = 0;
    let expiredCount = 0;
    let totalSize = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isValid(entry)) {
        validCount++;
      } else {
        expiredCount++;
      }
      totalSize += JSON.stringify(entry.data).length;
    }
    
    return {
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
      pendingRequests: this.pendingRequests.size,
      approximateSizeBytes: totalSize
    };
  }
}

// Global cache instance
export const apiCache = new APICache();

/**
 * Cache configuration for different endpoints
 */
export const CACHE_CONFIG = {
  scripts: {
    list: 30 * 1000, // 30 seconds for script list
    detail: 60 * 1000, // 1 minute for script details
    blocks: 5 * 60 * 1000, // 5 minutes for blocks
  },
  user: {
    profile: 5 * 60 * 1000, // 5 minutes for user profile
    shares: 60 * 1000, // 1 minute for shares
  },
  thumbnails: {
    url: 24 * 60 * 60 * 1000, // 24 hours for thumbnail URLs
  }
};

/**
 * Helper to invalidate related caches
 */
export function invalidateScriptCaches(scriptId?: string) {
  if (scriptId) {
    // Invalidate specific script
    apiCache.invalidatePattern(new RegExp(`/api/scripts/${scriptId}`));
  } else {
    // Invalidate all script caches
    apiCache.invalidatePattern(/\/api\/scripts/);
  }
}

/**
 * Expose cache stats to window in development
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__API_CACHE__ = {
    stats: () => apiCache.getStats(),
    clear: () => apiCache.clear(),
    invalidate: (key: string) => apiCache.invalidate(key),
    cache: apiCache
  };
}