import React, { memo } from 'react';
import { Header } from '../Header';

/**
 * Optimized Header with React.memo
 * Prevents re-renders unless critical props change
 */
export const OptimizedHeader = memo(
  Header,
  (prevProps, nextProps) => {
    // Only re-render if these critical props change
    return (
      prevProps.currentView === nextProps.currentView &&
      prevProps.scriptTitle === nextProps.scriptTitle &&
      prevProps.activeUserCount === nextProps.activeUserCount &&
      prevProps.isDemoMode === nextProps.isDemoMode &&
      prevProps.currentLayout === nextProps.currentLayout &&
      // For arrays, do a shallow comparison
      JSON.stringify(prevProps.layouts) === JSON.stringify(nextProps.layouts)
    );
  }
);

OptimizedHeader.displayName = 'OptimizedHeader';