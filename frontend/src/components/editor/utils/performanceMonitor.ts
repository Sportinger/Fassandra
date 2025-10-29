/**
 * Performance monitoring utility for editor
 * Helps identify bottlenecks during typing
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();
  private enabled: boolean = true;

  constructor() {
    // Only enable in development
    this.enabled = import.meta.env.DEV;
  }

  start(name: string): void {
    if (!this.enabled) return;
    this.timers.set(name, performance.now());
  }

  end(name: string): number {
    if (!this.enabled) return 0;

    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`[PerformanceMonitor] No start time for: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    this.metrics.push({
      name,
      duration,
      timestamp: Date.now(),
    });

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }

    // Warn about slow operations
    if (duration > 16) {
      console.warn(`[PerformanceMonitor] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getAverageFor(name: string): number {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    const sum = filtered.reduce((acc, m) => acc + m.duration, 0);
    return sum / filtered.length;
  }

  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  report(): void {
    if (!this.enabled || this.metrics.length === 0) return;

    const grouped = new Map<string, number[]>();
    this.metrics.forEach(metric => {
      if (!grouped.has(metric.name)) {
        grouped.set(metric.name, []);
      }
      grouped.get(metric.name)!.push(metric.duration);
    });

    console.group('[PerformanceMonitor] Report');
    grouped.forEach((durations, name) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const max = Math.max(...durations);
      const min = Math.min(...durations);
      console.log(`${name}: avg=${avg.toFixed(2)}ms, max=${max.toFixed(2)}ms, min=${min.toFixed(2)}ms, count=${durations.length}`);
    });
    console.groupEnd();
  }
}

export const perfMonitor = new PerformanceMonitor();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).perfMonitor = perfMonitor;
}
