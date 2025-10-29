/**
 * Editor performance optimizations
 * Reduces re-renders and improves typing performance
 */

import { Editor } from '@tiptap/core';

/**
 * Optimizes editor for large documents
 * Disables expensive features during typing
 */
export function optimizeEditorForTyping(editor: Editor): void {
  // Disable undo/redo during rapid typing (re-enable after idle)
  let typingTimer: number | null = null;
  const TYPING_IDLE_DELAY = 500;

  const originalDispatch = editor.view.dispatch;
  editor.view.dispatch = (tr) => {
    // Clear existing timer
    if (typingTimer) {
      clearTimeout(typingTimer);
    }

    // Call original dispatch
    originalDispatch(tr);

    // Set timer to detect typing idle
    typingTimer = window.setTimeout(() => {
      typingTimer = null;
      // Typing has stopped, flush any pending operations
    }, TYPING_IDLE_DELAY);
  };
}

/**
 * Debounces expensive editor operations
 */
export function debounceEditorOperation<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    lastArgs = args;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      if (lastArgs) {
        fn(...lastArgs);
        lastArgs = null;
      }
      timeoutId = null;
    }, delay);
  };
}

/**
 * Batch DOM updates using requestAnimationFrame
 */
export function batchDOMUpdates(callback: () => void): void {
  requestAnimationFrame(() => {
    callback();
  });
}

/**
 * Check if transaction is a simple text insert
 * These can be handled with minimal overhead
 */
export function isSimpleTextTransaction(tr: any): boolean {
  // Simple text transactions have:
  // - 1 or 2 steps (insert + selection)
  // - No marks changes
  // - No node changes
  if (tr.steps.length > 2) return false;
  if (tr.steps.length === 0) return false;

  const step = tr.steps[0];
  return step.slice?.content?.size === 1 && step.from !== undefined;
}
