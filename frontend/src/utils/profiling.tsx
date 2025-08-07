/**
 * React DevTools Profiling Configuration
 * 
 * This module sets up profiling capabilities for React DevTools
 * to help identify performance bottlenecks in development
 */

import React, { Profiler, ProfilerOnRenderCallback } from 'react';

// Only enable profiling in development
const isDevelopment = import.meta.env.DEV;

/**
 * Performance metrics storage
 */
interface PerformanceMetric {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  interactions: Set<any>;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 100;

  addMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow renders in development
    if (isDevelopment && metric.actualDuration > 16) {
      console.warn(`[Performance] Slow render detected in ${metric.id}:`, {
        duration: `${metric.actualDuration.toFixed(2)}ms`,
        phase: metric.phase,
        timestamp: new Date(metric.timestamp).toISOString()
      });
    }
  }

  getMetrics() {
    return this.metrics;
  }

  getAverageRenderTime(componentId: string) {
    const componentMetrics = this.metrics.filter(m => m.id === componentId);
    if (componentMetrics.length === 0) return 0;
    
    const total = componentMetrics.reduce((sum, m) => sum + m.actualDuration, 0);
    return total / componentMetrics.length;
  }

  getSlowestComponents(limit = 5) {
    const componentMap = new Map<string, number[]>();
    
    this.metrics.forEach(metric => {
      if (!componentMap.has(metric.id)) {
        componentMap.set(metric.id, []);
      }
      componentMap.get(metric.id)!.push(metric.actualDuration);
    });

    const averages = Array.from(componentMap.entries()).map(([id, durations]) => ({
      id,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      renderCount: durations.length
    }));

    return averages
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, limit);
  }

  clear() {
    this.metrics = [];
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Profiler callback for React DevTools
 * This function is called after each render
 */
export const onRenderCallback: ProfilerOnRenderCallback = (
  id: string, // Component name
  phase: "mount" | "update" | "nested-update", // "mount" or "update" or "nested-update"
  actualDuration: number, // Time spent rendering
  baseDuration: number, // Estimated time to render without memoization
  startTime: number, // When React began rendering
  commitTime: number, // When React committed the update
) => {
  if (!isDevelopment) return;

  performanceMonitor.addMetric({
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
    interactions: new Set(),
    timestamp: Date.now()
  });
};

/**
 * HOC to wrap components with Profiler in development
 */
export function withProfiler<P extends object>(
  Component: React.ComponentType<P>,
  id: string
): React.ComponentType<P> {
  if (!isDevelopment) {
    return Component;
  }

  return (props: P) => (
    <Profiler id={id} onRender={onRenderCallback}>
      <Component {...props} />
    </Profiler>
  );
}

/**
 * Hook to get performance metrics for a component
 */
export function usePerformanceMetrics(componentId: string) {
  if (!isDevelopment) {
    return {
      averageRenderTime: 0,
      metrics: []
    };
  }

  return {
    averageRenderTime: performanceMonitor.getAverageRenderTime(componentId),
    metrics: performanceMonitor.getMetrics().filter(m => m.id === componentId)
  };
}

/**
 * Expose performance data to window for debugging
 */
if (isDevelopment && typeof window !== 'undefined') {
  (window as any).__REACT_PERFORMANCE__ = {
    getMetrics: () => performanceMonitor.getMetrics(),
    getSlowestComponents: (limit?: number) => performanceMonitor.getSlowestComponents(limit),
    clear: () => performanceMonitor.clear(),
    getAverageRenderTime: (id: string) => performanceMonitor.getAverageRenderTime(id)
  };

  console.log('[Performance] React DevTools Profiling enabled. Access metrics via window.__REACT_PERFORMANCE__');
}