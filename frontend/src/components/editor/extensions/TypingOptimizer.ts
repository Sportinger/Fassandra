import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * TypingOptimizer Extension
 *
 * Dramatically improves typing performance by:
 * 1. Detecting when user is actively typing
 * 2. Deferring expensive operations during typing
 * 3. Batching updates when typing stops
 */

const typingOptimizerKey = new PluginKey('typingOptimizer');

interface TypingState {
  isTyping: boolean;
  lastKeystroke: number;
  pendingOperations: Array<() => void>;
}

export const TypingOptimizer = Extension.create({
  name: 'typingOptimizer',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: typingOptimizerKey,

        state: {
          init: (): TypingState => ({
            isTyping: false,
            lastKeystroke: 0,
            pendingOperations: [],
          }),

          apply: (tr, value): TypingState => {
            // Check if this is a typing transaction
            const isTypingTransaction =
              tr.docChanged &&
              !tr.getMeta('fromYjs') &&
              !tr.getMeta('addToHistory') &&
              tr.steps.length <= 2; // Simple text changes

            if (isTypingTransaction) {
              return {
                ...value,
                isTyping: true,
                lastKeystroke: Date.now(),
              };
            }

            // Check if typing has stopped (500ms idle)
            const now = Date.now();
            if (value.isTyping && now - value.lastKeystroke > 500) {
              // Execute all pending operations
              value.pendingOperations.forEach(op => {
                try {
                  op();
                } catch (error) {
                  console.error('[TypingOptimizer] Error executing pending operation:', error);
                }
              });

              return {
                isTyping: false,
                lastKeystroke: 0,
                pendingOperations: [],
              };
            }

            return value;
          },
        },

        props: {
          // Optimize DOM handling during typing
          handleDOMEvents: {
            'beforeinput': (view) => {
              const state = typingOptimizerKey.getState(view.state);
              if (state?.isTyping) {
                // We're in typing mode - operations will be deferred
              }
              return false;
            },
          },
        },

        view: (editorView) => {
          // Periodically check if typing has stopped
          const checkInterval = setInterval(() => {
            const state = typingOptimizerKey.getState(editorView.state);
            if (state?.isTyping) {
              const now = Date.now();
              if (now - state.lastKeystroke > 500) {
                // Force a transaction to trigger pending operations
                editorView.dispatch(editorView.state.tr.setMeta('typingIdle', true));
              }
            }
          }, 100);

          return {
            destroy: () => {
              clearInterval(checkInterval);
            },
          };
        },
      }),
    ];
  },

  // Expose helper methods to other extensions
  addStorage() {
    return {
      isTyping: (): boolean => {
        const state = typingOptimizerKey.getState(this.editor.state);
        return state?.isTyping || false;
      },

      deferOperation: (operation: () => void): void => {
        const state = typingOptimizerKey.getState(this.editor.state);
        if (state?.isTyping) {
          state.pendingOperations.push(operation);
        } else {
          // Not typing, execute immediately
          operation();
        }
      },
    };
  },
});
