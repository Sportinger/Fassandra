import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardIcon } from '../../icons';
import type { ToolbarProps, ToolbarContext } from '../../types/index';
import { CueType } from '../../../../types/cue';

import logger from '../../../../services/LoggingService';
import '../../styles/toolbar.css';
import { useToolbarKeyboard } from './hooks/useToolbarKeyboard';
import { buildToolbarButtons, type ToolbarButton } from './toolbarButtons';
import {
  useEditorLayout,
  useEditorRehearsal,
  useEditorSpeakers,
  useEditorContextMenuState,
} from '../../contexts/EditorUiContext';
import { renderToolbarButton } from './renderToolbarButton';
/**
 * Enhanced Toolbar Component
 * Full-featured floating toolbar with context-aware buttons
 * Matches the original FloatingToolbar functionality
 */

// Import the responsive styles
export const Toolbar: React.FC<ToolbarProps> = ({
  editor,
  context: clickContext,
  className = '',
}) => {
  const { viewMode, setViewMode, showCues, showStruckDialogue } = useEditorLayout();
  const {
    rehearsalMode,
    setRehearsalMode,
    autoFollowActive,
    startAutoFollow,
    stopAutoFollow,
    lastAsrText,
    adoptRemotePosition,
  } = useEditorRehearsal();
  const { editAllSpeakers, setEditAllSpeakers, availableSpeakers } = useEditorSpeakers();
  const { editorHasSelection } = useEditorContextMenuState();

  const speakerNames = useMemo(() => new Set(availableSpeakers), [availableSpeakers]);

  const {
    windowWidth,
    keyboardHeight,
    keyboardManuallyShown,
    vvLeft,
    vvWidth,
    hiddenInputRef,
    toggleKeyboard,
  } = useToolbarKeyboard(editor);
  // Force toolbar to show default context after certain actions (e.g., exit blocks)
  const [forceDefaultContext, setForceDefaultContext] = useState(false);
  // Remember last selected cue type (persisted in localStorage)
  const [lastSelectedCueType, setLastSelectedCueType] = useState<CueType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastSelectedCueType');
      return (saved as CueType) || 'light';
    }
    return 'light';
  });

  const handleCueTypeSelection = useCallback((type: CueType) => {
    setLastSelectedCueType(type);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastSelectedCueType', type);
    }
  }, []);

  const requestDefaultContext = useCallback(() => {
    setForceDefaultContext(true);
    setTimeout(() => setForceDefaultContext(false), 250);
  }, []);

  const handleToggleEditAllSpeakers = useCallback(() => {
    setEditAllSpeakers(prev => !prev);
  }, [setEditAllSpeakers]);

  const handleToggleRehearsalMode = useCallback(() => {
    const nextMode = !rehearsalMode;
    setRehearsalMode(nextMode);
    logger.debug('Toolbar', 'Rehearsal mode toggled:', nextMode);
    if (nextMode) {
      try {
        if (adoptRemotePosition()) {
          return;
        }
      } catch {
        /* ignore */
      }
    }
  }, [adoptRemotePosition, rehearsalMode, setRehearsalMode]);

  const handleToggleAutoFollow = useCallback(() => {
    const togglePromise = autoFollowActive ? stopAutoFollow() : startAutoFollow();
    if (togglePromise && typeof (togglePromise as Promise<unknown>).then === 'function') {
      (togglePromise as Promise<unknown>).catch(() => {});
    }
  }, [autoFollowActive, startAutoFollow, stopAutoFollow]);

  // Determine current context based on editor state
  const getContext = (): ToolbarContext => {
    // If a recent action requested default toolbar, honor it immediately
    if (forceDefaultContext) return 'default';
    if (!editor) return 'default';
    
    // Priority order:
    // 1. Explicit click contexts take precedence
    if (clickContext === 'scene-select') return 'scene-select';
    if (clickContext === 'speaker-select') return 'speaker-select';
    if (clickContext === 'dialogue-layout') return 'dialogue-layout';
    if (clickContext === 'empty-page') return 'empty-page';
    if (clickContext === 'cue-select') return 'cue-select';
    if (clickContext === 'text-formatting') return 'text-formatting';
    
    // 2. Text selection always shows formatting tools
    if (editorHasSelection) return 'text-formatting';
    
    // 3. Default context
    return 'default';
  };

  const currentContext = getContext();

  // Get current cue type if a cue is selected, otherwise use last selected
  const getCurrentCueType = (): CueType => {
    if (!editor) return lastSelectedCueType;

    const { state } = editor;
    const { selection } = state;
    const { from } = selection;

    let cueType: CueType | null = null;
    state.doc.nodesBetween(from, from, (node) => {
      if (node.type.name === 'cueBlock' && node.attrs.cueType) {
        cueType = node.attrs.cueType as CueType;
        return false;
      }
    });

    // Return the cue type from selected block, or fallback to last selected type
    return cueType || lastSelectedCueType;
  };

  const currentCueType = getCurrentCueType();

  // Define all possible buttons with their contexts and actions
  const focusIfNeeded = useCallback(() => {
    if (keyboardManuallyShown) {
      editor?.commands.focus();
    }
  }, [keyboardManuallyShown, editor]);

  const allButtons = useMemo(() => buildToolbarButtons({
    editor,
    autoFollowActive,
    onToggleAutoFollow: handleToggleAutoFollow,
    editAllSpeakers,
    onToggleEditAllSpeakers: handleToggleEditAllSpeakers,
    focusIfNeeded,
    viewMode,
    showCues,
    showStruckDialogue,
    rehearsalMode,
    onToggleRehearsalMode: handleToggleRehearsalMode,
    requestDefaultContext,
  }), [
    editor,
    autoFollowActive,
    handleToggleAutoFollow,
    editAllSpeakers,
    handleToggleEditAllSpeakers,
    focusIfNeeded,
    viewMode,
    showCues,
    showStruckDialogue,
    rehearsalMode,
    handleToggleRehearsalMode,
    requestDefaultContext,
  ]);

  // Get buttons for current context, sorted by order
  const contextButtons = useMemo(() => {
    const isMobile = windowWidth <= 767;
    return allButtons
      .filter(button => {
        // Check if button should be shown in current context
        const inContext = button.contexts.includes(currentContext);
        // Filter out mobile-only buttons on desktop
        const showButton = button.isMobileOnly ? isMobile : true;
        return inContext && showButton;
      })
      .sort((a, b) => a.order - b.order);
  }, [allButtons, currentContext, windowWidth]);

  // No animation logic needed - buttons are shown immediately based on context

  // Calculate dynamic toolbar height based on context buttons and device
  const toolbarHeight = useMemo(() => {
    const visibleCount = contextButtons.length;
    
    // Check if we're on mobile using the state that updates on resize
    const isMobile = windowWidth <= 767;
    
    if (isMobile) {
      // Mobile: flexible layout with wrapping - calculate based on button count
      const mobileButtonHeight = 48; // Touch-optimized (increased from 44)
      const mobileButtonWidth = 48;
      const gap = 6; // Gap between buttons
      const padding = 16; // Total vertical padding
      
      // Calculate how many buttons fit per row (approximate)
      const maxWidth = Math.min(windowWidth - 32, 300); // Max toolbar width
      const buttonsPerRow = Math.floor((maxWidth + gap) / (mobileButtonWidth + gap));
      const rows = Math.ceil(visibleCount / buttonsPerRow);
      
      // Height = (button height * rows) + (gap * (rows - 1)) + padding
      const finalHeight = (mobileButtonHeight * rows) + (gap * Math.max(0, rows - 1)) + padding;
      
      logger.debug('Toolbar', '[Mobile Toolbar] Height calculation:', {
        windowWidth,
        isMobile,
        visibleCount,
        buttonsPerRow,
        rows,
        mobileButtonHeight,
        padding,
        finalHeight
      });
      return finalHeight;
    } else {
      // Desktop: vertical layout - stack buttons
      const buttonHeight = 40;
      const gap = 8;
      const padding = 24; // 12px top + 12px bottom
      
      if (visibleCount === 0) return 64; // Minimum height
      
      // Add separators for text-formatting context
      const separatorCount = currentContext === 'text-formatting' ? 2 : 0;
      const separatorHeight = separatorCount * (1 + gap); // 1px height + gap
      
      const finalHeight = (visibleCount * buttonHeight) + ((visibleCount - 1) * gap) + separatorHeight + padding;
      logger.debug('Toolbar', '[Desktop Toolbar] Height calculation:', {
        windowWidth,
        isMobile,
        visibleCount,
        buttonHeight,
        gap,
        padding,
        separatorCount,
        separatorHeight,
        finalHeight
      });
      return finalHeight;
    }
  }, [contextButtons.length, currentContext, windowWidth]);

  // Render separator between button groups (only for text-formatting)
  const shouldShowSeparatorAfter = (button: ToolbarButton, index: number): boolean => {
    if (currentContext !== 'text-formatting') return false;
    const nextButton = contextButtons[index + 1];
    
    // Show separator after formatting buttons (order 1-2) and before font size (order 4)
    if (button.order === 2 && nextButton?.order === 4) return true;
    // Show separator after font size (order 4) and before alignment (order 6)
    if (button.order === 4 && nextButton?.order === 6) return true;
    
    return false;
  };

  // Don't render toolbar if editor is not ready
  if (!editor) {
    return null;
  }

  // Calculate dynamic bottom position for mobile keyboard adjustment
  const isMobile = windowWidth <= 767;
  const keyboardActive = isMobile && keyboardHeight > 0;
  const calculatedBottom = keyboardActive ? keyboardHeight : 0; // Position directly above keyboard or at bottom

  // Expose keyboard inset to CSS so mobile dropdown portal can position above toolbar
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--keyboard-offset', `${keyboardHeight}px`);
    return () => {
      document.documentElement.style.removeProperty('--keyboard-offset');
    };
  }, [keyboardHeight]);
  
  const dynamicStyle = isMobile ? {
    // Mobile: Fixed to bottom of visual viewport via transform (Safari-friendly)
    position: 'fixed' as const,
    bottom: 0,
    top: 'auto',
    left: vvLeft,
    right: 'auto',
    width: vvWidth,
    // Translate up by the keyboard inset; avoids Safari fixed/scroll quirks (use 3D transform)
    transform: `translate3d(0, -${keyboardHeight}px, 0)`,
    transition: 'none',
  } : {
    minHeight: `${toolbarHeight}px`,
    /* No transitions */
    /* transition: 'min-height 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' // easeOutQuad */
  };

  // Only log on mobile or when keyboard state changes
  if (isMobile || keyboardActive) {
  logger.debug('Toolbar', '[Mobile Toolbar] Render styling:', {
    isMobile,
    keyboardHeight,
    keyboardActive,
    toolbarHeight,
    calculatedBottom,
    bottomPosition: keyboardActive ? `${calculatedBottom}px` : 'default'
  });
  }

  return (
    <div 
      className={`floatingToolbar context-${currentContext} ${keyboardActive ? 'keyboard-active' : ''} ${className}`}
      style={dynamicStyle}
    >
      {contextButtons
        // Hide legacy keyboard button on mobile; now rendered as FAB
        .filter(b => !(windowWidth <= 767 && b.id === 'keyboard-toggle'))
        .map((button, index) => {
        // All buttons are immediately visible
        const isVisible = true;
        
        return (
          <React.Fragment key={button.id}>
            {renderToolbarButton({
              button,
              editor,
              isVisible,
              viewMode,
              onSetViewMode: setViewMode,
              currentCueType,
              onCueTypeChange: handleCueTypeSelection,
              speakerNames,
            })}
            
            {shouldShowSeparatorAfter(button, index) && (
              <div 
                className="toolbarSeparator"
              />
            )}
          </React.Fragment>
        );
      })}
      
      {/* Hidden input for manual keyboard control on mobile */}
      {windowWidth <= 767 && (
        <input
          ref={hiddenInputRef}
          type="text"
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none'
          }}
          aria-hidden="true"
        />
      )}

      {/* Fixed-position ASR preview pill next to the toolbar */}
      {autoFollowActive && (
        <div
          style={{
            position: 'fixed',
            left: 'calc(var(--toolbar-button-size) + 12px)',
            top: 'calc(var(--header-height) + env(safe-area-inset-top, 0px) + var(--space-md))',
            maxWidth: 480,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: 13,
            lineHeight: 1.25,
            zIndex: 1110,
            pointerEvents: 'none',
            backdropFilter: 'blur(2px)'
          }}
          title={lastAsrText || ''}
        >
          {lastAsrText || 'Listening…'}
        </div>
      )}

      {/* Floating round Keyboard toggle FAB (mobile only) */}
      {windowWidth <= 767 && (
        <button
          type="button"
          className="keyboardFab"
          title={keyboardManuallyShown ? 'Hide Keyboard' : 'Show Keyboard'}
          aria-pressed={keyboardManuallyShown}
          aria-label={keyboardManuallyShown ? 'Hide Keyboard' : 'Show Keyboard'}
          onClick={toggleKeyboard}
          style={{
            position: 'fixed',
            left: vvLeft + 12,
            bottom: 0,
            // Translate up by desired offset (max of 30vh or keyboard inset + 12)
            transform: `translate3d(0, -${Math.max(Math.round(window.innerHeight * 0.30), keyboardHeight + 12)}px, 0)`,
          }}
        >
          <span className="fabIcon" aria-hidden>
            <KeyboardIcon size={20} />
          </span>
        </button>
      )}
    </div>
  );
};
