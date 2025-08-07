import React, { memo, useCallback, useMemo } from 'react';
import { ScriptList, ScriptListRef } from '../ScriptList';

/**
 * Optimized ScriptList with React.memo to prevent unnecessary re-renders
 * Only re-renders when props actually change
 */
export const OptimizedScriptList = memo(
  React.forwardRef<ScriptListRef, React.ComponentProps<typeof ScriptList>>((props, ref) => {
    return <ScriptList {...props} ref={ref} />;
  }),
  (prevProps, nextProps) => {
    // Custom comparison function
    // Return true if props are equal (skip re-render)
    // Return false if props changed (re-render)
    return (
      prevProps.refreshTrigger === nextProps.refreshTrigger &&
      prevProps.onSelectScript === nextProps.onSelectScript &&
      prevProps.onUploadClick === nextProps.onUploadClick &&
      prevProps.onScriptClickStart === nextProps.onScriptClickStart
    );
  }
);

OptimizedScriptList.displayName = 'OptimizedScriptList';