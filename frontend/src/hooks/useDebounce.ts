/**
 * Debounce Hook
 * 
 * React hook for debouncing values and functions
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { debounce } from '../utils/rateLimit';

/**
 * Hook to debounce a value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook to create a debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const callbackRef = useRef(callback);
  
  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create debounced function
  const debouncedCallback = useCallback(
    debounce((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, delay),
    [delay, ...deps]
  );

  return debouncedCallback as T;
}

/**
 * Hook for debounced search
 */
export function useDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T>,
  delay = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const debouncedQuery = useDebounce(query, delay);
  
  useEffect(() => {
    if (!debouncedQuery) {
      setResults(null);
      return;
    }
    
    let cancelled = false;
    
    const performSearch = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const searchResults = await searchFn(debouncedQuery);
        
        if (!cancelled) {
          setResults(searchResults);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Search failed'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    performSearch();
    
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchFn]);
  
  return {
    query,
    setQuery,
    results,
    loading,
    error,
    debouncedQuery
  };
}