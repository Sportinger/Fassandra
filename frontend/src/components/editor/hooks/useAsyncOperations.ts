import { useState, useCallback, useRef, useEffect } from 'react';
import type { SavingStatus } from '../components/ui/SavingIndicator';

interface AsyncOperation {
  id: string;
  fn: () => void | Promise<void>;
  priority: 'high' | 'low';
  timestamp: number;
}

interface UseAsyncOperationsReturn {
  savingStatus: SavingStatus;
  lastSaved: Date | null;
  scheduleOperation: (fn: () => void | Promise<void>, priority?: 'high' | 'low') => void;
  setSaving: () => void;
  setSaved: () => void;
  setError: () => void;
}

/**
 * Hook to manage async operations queue and saving state
 * All heavy operations are deferred to idle time to keep UI responsive
 */
export const useAsyncOperations = (): UseAsyncOperationsReturn => {
  const [savingStatus, setSavingStatus] = useState<SavingStatus>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const operationQueue = useRef<AsyncOperation[]>([]);
  const isProcessing = useRef(false);
  const savingTimerRef = useRef<number | null>(null);

  // Process operations queue using requestIdleCallback for low-priority tasks
  const processQueue = useCallback(async () => {
    if (isProcessing.current || operationQueue.current.length === 0) return;

    isProcessing.current = true;

    // Sort by priority and timestamp
    operationQueue.current.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === 'high' ? -1 : 1;
      }
      return a.timestamp - b.timestamp;
    });

    const operation = operationQueue.current.shift();
    if (!operation) {
      isProcessing.current = false;
      return;
    }

    try {
      if (operation.priority === 'low') {
        // Use requestIdleCallback for low-priority operations
        if ('requestIdleCallback' in window) {
          await new Promise<void>((resolve) => {
            requestIdleCallback(async () => {
              await operation.fn();
              resolve();
            }, { timeout: 2000 });
          });
        } else {
          // Fallback for browsers without requestIdleCallback
          await new Promise<void>((resolve) => {
            setTimeout(async () => {
              await operation.fn();
              resolve();
            }, 16); // ~1 frame
          });
        }
      } else {
        // High-priority operations run immediately but async
        await Promise.resolve(operation.fn());
      }
    } catch (error) {
      console.error('[AsyncOperations] Error processing operation:', error);
      setSavingStatus('error');
    }

    isProcessing.current = false;

    // Continue processing queue
    if (operationQueue.current.length > 0) {
      processQueue();
    }
  }, []);

  // Schedule an operation to be executed asynchronously
  const scheduleOperation = useCallback(
    (fn: () => void | Promise<void>, priority: 'high' | 'low' = 'low') => {
      const operation: AsyncOperation = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fn,
        priority,
        timestamp: Date.now(),
      };

      operationQueue.current.push(operation);

      // Trigger processing
      processQueue();
    },
    [processQueue]
  );

  const setSaving = useCallback(() => {
    setSavingStatus('saving');

    // Clear any existing timer
    if (savingTimerRef.current) {
      clearTimeout(savingTimerRef.current);
    }
  }, []);

  const setSaved = useCallback(() => {
    setSavingStatus('saved');
    setLastSaved(new Date());

    // Clear any existing timer
    if (savingTimerRef.current) {
      clearTimeout(savingTimerRef.current);
    }
  }, []);

  const setError = useCallback(() => {
    setSavingStatus('error');

    // Auto-clear error after 5 seconds
    if (savingTimerRef.current) {
      clearTimeout(savingTimerRef.current);
    }

    savingTimerRef.current = window.setTimeout(() => {
      setSavingStatus('saved');
    }, 5000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (savingTimerRef.current) {
        clearTimeout(savingTimerRef.current);
      }
      operationQueue.current = [];
    };
  }, []);

  return {
    savingStatus,
    lastSaved,
    scheduleOperation,
    setSaving,
    setSaved,
    setError,
  };
};
