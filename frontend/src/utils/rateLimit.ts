/**
 * Rate Limiting Utilities
 * 
 * Provides debounce and throttle functions to optimize
 * API calls and reduce unnecessary network requests
 */

/**
 * Debounce function - delays execution until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: any = null;
  let lastCallTime: number | null = null;
  
  const { leading = false, trailing = true } = options;

  const invokeFunc = () => {
    if (lastArgs && lastThis) {
      func.apply(lastThis, lastArgs);
      lastArgs = null;
      lastThis = null;
    }
  };

  return function debounced(this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const isFirstCall = !lastCallTime;
    
    lastArgs = args;
    lastThis = this;
    lastCallTime = now;

    if (timeout) {
      clearTimeout(timeout);
    }

    if (isFirstCall && leading) {
      invokeFunc();
    }

    timeout = setTimeout(() => {
      timeout = null;
      lastCallTime = null;
      
      if (trailing && lastArgs) {
        invokeFunc();
      }
    }, wait);
  };
}

/**
 * Throttle function - ensures function is called at most once
 * every wait milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: any = null;
  let lastCallTime = 0;
  
  const { leading = true, trailing = true } = options;

  const invokeFunc = (time: number) => {
    if (lastArgs && lastThis) {
      func.apply(lastThis, lastArgs);
      lastCallTime = time;
      lastArgs = null;
      lastThis = null;
    }
  };

  return function throttled(this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = wait - (now - lastCallTime);
    
    lastArgs = args;
    lastThis = this;

    if (remaining <= 0 || remaining > wait) {
      // First call or wait period has passed
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      
      if (leading) {
        invokeFunc(now);
      }
    } else if (!timeout && trailing) {
      // Set timeout for trailing call
      timeout = setTimeout(() => {
        timeout = null;
        invokeFunc(Date.now());
      }, remaining);
    }
  };
}

/**
 * Create a debounced API call wrapper
 */
export function createDebouncedAPI<T extends (...args: any[]) => Promise<any>>(
  apiCall: T,
  delay = 300
): T {
  const pending = new Map<string, Promise<any>>();
  
  const debouncedFn = debounce(
    async (...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      
      // If there's a pending promise for these args, return it
      if (pending.has(key)) {
        return pending.get(key);
      }
      
      // Create new promise and store it
      const promise = apiCall(...args)
        .finally(() => {
          // Clean up after completion
          pending.delete(key);
        });
      
      pending.set(key, promise);
      return promise;
    },
    delay,
    { leading: false, trailing: true }
  );
  
  return debouncedFn as unknown as T;
}

/**
 * Create a throttled API call wrapper
 */
export function createThrottledAPI<T extends (...args: any[]) => Promise<any>>(
  apiCall: T,
  interval = 1000
): T {
  return throttle(apiCall, interval, { 
    leading: true, 
    trailing: false 
  }) as unknown as T;
}

/**
 * Batch multiple API calls into a single request
 */
export class BatchedAPICall<TArgs, TResult> {
  private batch: Array<{ args: TArgs; resolve: (value: TResult) => void; reject: (error: any) => void }> = [];
  private timeout: NodeJS.Timeout | null = null;
  
  constructor(
    private batchProcessor: (batch: TArgs[]) => Promise<TResult[]>,
    private delay = 50,
    private maxBatchSize = 10
  ) {}
  
  add(args: TArgs): Promise<TResult> {
    return new Promise((resolve, reject) => {
      this.batch.push({ args, resolve, reject });
      
      if (this.batch.length >= this.maxBatchSize) {
        this.flush();
      } else {
        this.scheduleFlush();
      }
    });
  }
  
  private scheduleFlush() {
    if (this.timeout) return;
    
    this.timeout = setTimeout(() => {
      this.flush();
    }, this.delay);
  }
  
  private async flush() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.batch.length === 0) return;
    
    const currentBatch = [...this.batch];
    this.batch = [];
    
    try {
      const results = await this.batchProcessor(currentBatch.map(b => b.args));
      
      currentBatch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      currentBatch.forEach(item => {
        item.reject(error);
      });
    }
  }
}

/**
 * Rate limiter for API endpoints
 */
export class RateLimiter {
  private requests: number[] = [];
  
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}
  
  canMakeRequest(): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => time > windowStart);
    
    return this.requests.length < this.maxRequests;
  }
  
  recordRequest(): void {
    this.requests.push(Date.now());
  }
  
  async waitForSlot(): Promise<void> {
    while (!this.canMakeRequest()) {
      // Wait for 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.recordRequest();
  }
}