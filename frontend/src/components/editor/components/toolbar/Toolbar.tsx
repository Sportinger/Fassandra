import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FontSizeDropdown } from '../../FontSizeDropdown';
import { FontStyleDropdown } from '../../FontStyleDropdown';
import { CueDropdown } from '../../CueDropdown';
import { CueTypeDropdown } from '../../CueTypeDropdown';
import { SearchBox } from '../../SearchBox';
import { SpeakerDropdown } from '../../SpeakerDropdown';
import { SpeakerColorPicker } from '../../SpeakerColorPicker';
import { DialogueLayoutDropdown } from '../../DialogueLayoutDropdown';
import type { ToolbarProps, ToolbarContext } from '../../types/index';
import { CueType } from '../../../../types/cue';

import logger from '../../../../services/LoggingService';
import '../../styles/toolbar.css';
/**
 * Enhanced Toolbar Component
 * Full-featured floating toolbar with context-aware buttons
 * Matches the original FloatingToolbar functionality
 */

// Import the responsive styles
interface ToolbarButton {
  id: string;
  icon: string;
  title: string;
  action: () => void;
  isActive?: boolean;
  contexts: ToolbarContext[];
  order: number;
  isSpecial?: boolean; // For components that need special rendering
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  editor,
  context: clickContext,
  hasTextSelection,
  viewMode,
  showRuler,
  speakerNames,
  currentSpeakerName,
  editAllSpeakers = false,
  onToggleEditAllSpeakers,
  onSetViewMode,
  onToggleRuler,
  className = '',
  rehearsalMode = false,
  onToggleRehearsalMode
}) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Handle window resize for responsive toolbar height
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Virtual keyboard detection for mobile
  useEffect(() => {
    // Only enable on mobile devices
    if (windowWidth > 767) {
      setKeyboardHeight(0);
      return;
    }

    let initialViewportHeight = window.innerHeight;
    let initialVisualViewportHeight = window.visualViewport?.height || window.innerHeight;

    // 🎭 THEATER PRIORITY: Enhanced mobile browser detection for iPad/iPhone theater professionals
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isChromeMobile = /Chrome/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent);

    // 🎭 ENHANCED: Better orientation and device detection
    const isLandscape = window.innerWidth > window.innerHeight;
    const deviceType = isIOS ? (navigator.userAgent.includes('iPad') ? 'iPad' : 'iPhone') : 'Android';

    const detectKeyboard = () => {
      // Use Visual Viewport API if available (modern browsers)
      if (window.visualViewport) {
        const currentVisualHeight = window.visualViewport.height;
        const heightDifference = initialVisualViewportHeight - currentVisualHeight;
        
        logger.debug('Toolbar', '[🎭 Mobile Keyboard] Visual Viewport detection:', {
          initial: initialVisualViewportHeight,
          current: currentVisualHeight,
          difference: heightDifference,
          isIOS,
          isSafari,
          isAndroid,
          isChromeMobile,
          deviceType,
          isLandscape,
          orientation: isLandscape ? 'landscape' : 'portrait'
        });

        // 🎭 THEATER OPTIMIZATION: Enhanced device-specific threshold tuning
        let threshold = 150; // Default threshold
        if (isIOS && isSafari) {
          threshold = isLandscape ? 80 : 100; // Lower threshold for iOS Safari landscape
        } else if (isIOS && !isSafari) {
          threshold = isLandscape ? 100 : 120; // iOS Chrome/other browsers
        } else if (isAndroid && isChromeMobile) {
          threshold = isLandscape ? 140 : 180; // Android Chrome landscape vs portrait
        } else if (isAndroid) {
          threshold = isLandscape ? 120 : 160; // Other Android browsers
        }
        
        const keyboardVisible = heightDifference > threshold;
        // 🎭 ENHANCED: Smarter keyboard height calculation
        const calculatedHeight = keyboardVisible ? Math.max(heightDifference, isLandscape ? 180 : 200) : 0;
        
        logger.debug('Toolbar', `[🎭 Mobile Keyboard] ${keyboardVisible ? 'OPEN' : 'CLOSED'}: height difference ${heightDifference}px, threshold ${threshold}px (${deviceType} ${isLandscape ? 'landscape' : 'portrait'})`);
        setKeyboardHeight(calculatedHeight);
      } else {
        // Fallback: detect via window.innerHeight changes
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        
        logger.debug('Toolbar', '[🎭 Mobile Keyboard] Window height detection:', {
          initial: initialViewportHeight,
          current: currentHeight,
          difference: heightDifference,
          isIOS,
          isSafari,
          isAndroid,
          deviceType,
          isLandscape,
          orientation: isLandscape ? 'landscape' : 'portrait'
        });

        // 🎭 THEATER OPTIMIZATION: Enhanced threshold for orientation
        let threshold = 150;
        if (isIOS) {
          threshold = isLandscape ? 80 : 100; // iOS devices - lower for landscape
        } else if (isAndroid) {
          threshold = isLandscape ? 140 : 180; // Android devices - adjust for nav bars
        }
        
        const keyboardVisible = heightDifference > threshold;
        const calculatedHeight = keyboardVisible ? Math.max(heightDifference, isLandscape ? 180 : 200) : 0;
        
        logger.debug('Toolbar', `[🎭 Mobile Keyboard] ${keyboardVisible ? 'OPEN' : 'CLOSED'}: height difference ${heightDifference}px, threshold ${threshold}px (${deviceType} ${isLandscape ? 'landscape' : 'portrait'})`);
        setKeyboardHeight(calculatedHeight);
      }
    };

    // 🎭 ENHANCED: Debounced detection for better experience
    let detectTimeout: NodeJS.Timeout;
    const debouncedDetect = () => {
      clearTimeout(detectTimeout);
      detectTimeout = setTimeout(detectKeyboard, 50); // 50ms debounce
    };

    // Listen for viewport changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', debouncedDetect);
    }
    
    // Fallback resize listener
    window.addEventListener('resize', debouncedDetect);

    // 🎭 ENHANCED: Better iOS Safari handling
    if (isIOS && isSafari) {
      const handleFocusIn = (event: FocusEvent) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          // 🎭 THEATER PRIORITY: Ensure focused element is visible above keyboard
          setTimeout(() => {
            debouncedDetect();
            // Scroll focused element into view with theater-friendly padding
            if (target.scrollIntoView) {
              target.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
              });
            }
          }, 300); // Small delay for keyboard state
        }
      };
      
      const handleFocusOut = () => {
        setTimeout(() => {
          setKeyboardHeight(0);
        }, 300); // Delay for keyboard animation
      };
      
      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);
      
      return () => {
        clearTimeout(detectTimeout);
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', debouncedDetect);
        }
        window.removeEventListener('resize', debouncedDetect);
      };
    }

    // 🎭 ENHANCED: Better orientation change handling for theater rehearsals
    const handleOrientationChange = () => {
      setTimeout(() => {
        initialViewportHeight = window.innerHeight;
        initialVisualViewportHeight = window.visualViewport?.height || window.innerHeight;
        // Update after orientation change
        setKeyboardHeight(0); // Reset first
        setTimeout(debouncedDetect, 100); // Then detect again
      }, 500); // Delay to allow orientation to stabilize
    };

    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      clearTimeout(detectTimeout);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', debouncedDetect);
      }
      window.removeEventListener('resize', debouncedDetect);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [windowWidth]);

  // Animation functions removed - no longer needed

  // Determine current context based on editor state
  const getContext = (): ToolbarContext => {
    if (!editor) return 'default';
    
    // Priority order:
    // 1. Explicit click contexts take precedence
    if (clickContext === 'speaker-select') return 'speaker-select';
    if (clickContext === 'dialogue-layout') return 'dialogue-layout';
    if (clickContext === 'empty-page') return 'empty-page';
    if (clickContext === 'cue-select') return 'cue-select';
    
    // 2. Text selection always shows formatting tools
    if (hasTextSelection) return 'text-formatting';
    
    // 3. Default context
    return 'default';
  };

  const currentContext = getContext();

  // Get current cue type if a cue is selected
  const getCurrentCueType = (): CueType => {
    if (!editor || currentContext !== 'cue-select') return 'light';
    
    const { state } = editor;
    const { selection } = state;
    const { from } = selection;
    
    let cueType: CueType = 'light';
    state.doc.nodesBetween(from, from, (node) => {
      if (node.type.name === 'cueBlock' && node.attrs.cueType) {
        cueType = node.attrs.cueType as CueType;
        return false;
      }
    });
    
    return cueType;
  };

  const currentCueType = getCurrentCueType();

  // Define all possible buttons with their contexts and actions
  const allButtons = useMemo((): ToolbarButton[] => [
    // Text formatting buttons (text-formatting context)
    {
      id: 'bold',
      icon: 'B',
      title: 'Bold',
      action: () => editor?.chain().focus().toggleBold().run(),
      isActive: editor?.isActive('bold'),
      contexts: ['text-formatting'],
      order: 1
    },
    {
      id: 'italic',
      icon: 'I',
      title: 'Italic', 
      action: () => editor?.chain().focus().toggleItalic().run(),
      isActive: editor?.isActive('italic'),
      contexts: ['text-formatting'],
      order: 2
    },
    {
      id: 'font-size',
      icon: '16', // Will be replaced by FontSizeDropdown
      title: 'Font Size',
      action: () => {}, // No action needed, handled by dropdown
      contexts: ['text-formatting'],
      order: 4,
      isSpecial: true
    },
    {
      id: 'align-left',
      icon: '⊢',
      title: 'Align Left',
      action: () => editor?.chain().focus().setTextAlign('left').run(),
      isActive: editor?.isActive({ textAlign: 'left' }),
      contexts: ['text-formatting'],
      order: 6
    },
    {
      id: 'align-center',
      icon: '‖',
      title: 'Align Center',
      action: () => editor?.chain().focus().setTextAlign('center').run(),
      isActive: editor?.isActive({ textAlign: 'center' }),
      contexts: ['text-formatting'],
      order: 7
    },
    {
      id: 'align-right',
      icon: '⊣',
      title: 'Align Right',
      action: () => editor?.chain().focus().setTextAlign('right').run(),
      isActive: editor?.isActive({ textAlign: 'right' }),
      contexts: ['text-formatting'],
      order: 8
    },

    // Dialogue layout dropdown
    {
      id: 'dialogue-layout-dropdown',
      icon: '≡',
      title: 'Dialogue Layout',
      action: () => {}, // Handled by dropdown
      contexts: ['dialogue-layout', 'speaker-select'],
      order: 1,
      isSpecial: true
    },
    {
      id: 'edit-all-toggle',
      icon: editAllSpeakers ? '👥' : '👤',
      title: editAllSpeakers ? 'Edit All Speakers (ON)' : 'Edit Single Speaker (OFF)',
      action: () => {
        logger.debug('Toolbar', 'Toggling edit all speakers mode');
        if (onToggleEditAllSpeakers) {
          onToggleEditAllSpeakers();
        }
      },
      isActive: editAllSpeakers,
      contexts: ['speaker-select'],
      order: 2,
    },
    {
      id: 'strike-through',
      icon: '⸺',
      title: 'Toggle Strike-through',
      action: () => {
        logger.debug('Toolbar', 'Toggling strike-through');
        editor?.chain().focus().toggleDialogueStrikeThrough().run();
      },
      isActive: (() => {
        const { selection } = editor?.state || {};
        const { $from } = selection || {};
        if (!$from) return false;
        
        for (let depth = $from.depth; depth >= 0; depth--) {
          const node = $from.node(depth);
          if (node && node.type.name === 'dialogueBlock') {
            return node.attrs.struckThrough || false;
          }
        }
        return false;
      })(),
      contexts: ['dialogue-layout', 'speaker-select'],
      order: 3,
    },
    {
      id: 'speaker-dropdown',
      icon: '🗣️',
      title: 'Select Speaker',
      action: () => {}, // No action needed, handled by dropdown
      contexts: ['dialogue-layout', 'speaker-select'],
      order: 4,
      isSpecial: true
    },
    {
      id: 'speaker-color-picker',
      icon: '🎨',
      title: 'Speaker Color',
      action: () => {}, // No action needed, handled by color picker
      contexts: ['speaker-select'],
      order: 5,
      isSpecial: true
    },
    {
      id: 'font-style',
      icon: 'Aa',
      title: 'Font Style',
      action: () => {}, // No action needed, handled by dropdown
      contexts: ['speaker-select', 'dialogue-layout'],
      order: 6,
      isSpecial: true
    },
    {
      id: 'exit-dialogue',
      icon: '↩',
      title: 'Exit Dialogue Block (Create Normal Text)',
      action: () => {
        logger.debug('Toolbar', 'Exiting dialogue block');
        editor?.chain().focus().exitDialogueBlock().run();
      },
      contexts: ['dialogue-layout', 'speaker-select'],
      order: 7,
    },

    // Page interaction buttons (empty-page context)
    {
      id: 'insert-dialogue',
      icon: '💬',
      title: 'Insert Dialogue Block',
      action: () => {
        logger.debug('Toolbar', 'Inserting dialogue block');
        editor?.chain().focus().insertDialogueBlock().run();
      },
      contexts: ['empty-page', 'default'], // 🔧 FIX: Add to default context so users can always insert dialogue
      order: 1
    },
    {
      id: 'split-page',
      icon: '⎘',
      title: 'Split Page',
      action: () => {
        logger.debug('Toolbar', 'Split page');
        // Insert a page break or new page
        editor?.chain().focus().insertContent('<hr>').run();
      },
      contexts: ['empty-page'],
      order: 2
    },

    {
      id: 'single-page',
      icon: '▢',
      title: 'Single Page View',
      action: () => onSetViewMode('single-page'),
      isActive: viewMode === 'single-page',
      contexts: ['default'],
      order: 1
    },
    {
      id: 'multi-page',
      icon: '▦',
      title: 'Multiple Pages View',
      action: () => onSetViewMode('multiple-pages'),
      isActive: viewMode === 'multiple-pages',
      contexts: ['default'],
      order: 2
    },
    {
      id: 'show-ruler',
      icon: '📏',
      title: showRuler ? 'Hide Ruler' : 'Show Ruler',
      action: onToggleRuler,
      isActive: showRuler,
      contexts: ['default'],
      order: 3
    },
    {
      id: 'print',
      icon: '⎙',
      title: 'Print / Export PDF',
      action: () => window.print(),
      contexts: ['default'],
      order: 4
    },
    
    // Cue dropdown (default context)
    {
      id: 'cue-dropdown',
      icon: '🎭',
      title: 'Insert Cue',
      action: () => {}, // Handled by dropdown component
      contexts: ['default'],
      order: 10,
      isSpecial: true
    },
    
    // Add Scene button (default context)
    {
      id: 'add-scene',
      icon: '🎬',
      title: 'Add Scene',
      action: () => editor?.commands.insertSceneBlock(),
      contexts: ['default'],
      order: 11
    },
    
    
    // Rehearsal Mode Toggle (default context)
    {
      id: 'rehearsal-mode',
      icon: '🎯',
      title: rehearsalMode ? 'Exit Rehearsal Mode' : 'Enter Rehearsal Mode',
      action: () => {
        if (onToggleRehearsalMode) {
          onToggleRehearsalMode();
        }
      },
      isActive: rehearsalMode,
      contexts: ['default'],
      order: 12
    },
    
    // Search box (default context)
    {
      id: 'search-box',
      icon: '🔍',
      title: 'Search',
      action: () => {}, // Handled by SearchBox component
      contexts: ['default'],
      order: 13,
      isSpecial: true
    },

    // Cue-select context buttons
    {
      id: 'cue-type-dropdown',
      icon: '🎭',
      title: 'Cue Type',
      action: () => {}, // Handled by dropdown component
      contexts: ['cue-select'],
      order: 1,
      isSpecial: true
    },
    {
      id: 'delete-cue',
      icon: '🗑️',
      title: 'Delete Cue',
      action: () => {
        logger.debug('Toolbar', 'Deleting cue block');
        editor?.chain().focus().deleteNode('cueBlock').run();
      },
      contexts: ['cue-select'],
      order: 2
    },
    {
      id: 'exit-cue',
      icon: '↩',
      title: 'Exit Cue Block',
      action: () => {
        logger.debug('Toolbar', 'Exiting cue block');
        // Move cursor to after the cue block and insert a new paragraph
        const { state } = editor!;
        const { selection } = state;
        const { from } = selection;
        
        // Find the cue block node
        let cueBlockPos = -1;
        let cueBlockNode = null;
        state.doc.nodesBetween(from, from, (node, pos) => {
          if (node.type.name === 'cueBlock') {
            cueBlockPos = pos;
            cueBlockNode = node;
            return false;
          }
        });
        
        if (cueBlockPos >= 0 && cueBlockNode) {
          const endPos = cueBlockPos + (cueBlockNode as any).nodeSize;
          editor?.chain()
            .focus()
            .setTextSelection(endPos)
            .insertContent({ type: 'paragraph' })
            .run();
        }
      },
      contexts: ['cue-select'],
      order: 3
    },
      ], [editor, viewMode, onSetViewMode, showRuler, onToggleRuler, rehearsalMode, onToggleRehearsalMode, currentCueType, editAllSpeakers, currentSpeakerName, onToggleEditAllSpeakers]);

  // Get buttons for current context, sorted by order
  const contextButtons = useMemo(() => {
    return allButtons
      .filter(button => button.contexts.includes(currentContext))
      .sort((a, b) => a.order - b.order);
  }, [allButtons, currentContext]);

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
  
  const dynamicStyle = isMobile ? {
    // Let height be auto-determined by CSS flexbox wrapping
    // height: 'auto', // Remove fixed height for mobile
    '--calculated-bottom': `${calculatedBottom}px`,
    bottom: keyboardActive 
      ? `${calculatedBottom}px` // Above keyboard
      : '0' // Stick to bottom when no keyboard
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
      {contextButtons.map((button, index) => {
        // All buttons are immediately visible
        const isVisible = true;
        
        return (
          <React.Fragment key={button.id}>
            {button.isSpecial && button.id === 'font-size' ? (
              <FontSizeDropdown 
                editor={editor}
                isVisible={isVisible}
              />
            ) : button.isSpecial && button.id === 'cue-dropdown' ? (
              <CueDropdown
                editor={editor}
                isVisible={isVisible}
              />
            ) : button.isSpecial && button.id === 'search-box' ? (
              <SearchBox
                editor={editor}
                isVisible={isVisible}
              />
            ) : button.isSpecial && button.id === 'cue-type-dropdown' ? (
              <CueTypeDropdown
                editor={editor}
                isVisible={isVisible}
                currentCueType={currentCueType}
              />
            ) : button.isSpecial && button.id === 'speaker-dropdown' ? (
              <SpeakerDropdown
                editor={editor}
                isVisible={isVisible}
                speakerNames={speakerNames}
              />
            ) : button.isSpecial && button.id === 'speaker-color-picker' ? (
              <SpeakerColorPicker
                editor={editor}
                isVisible={isVisible}
              />
            ) : button.isSpecial && button.id === 'font-style' ? (
              <FontStyleDropdown
                editor={editor}
                isVisible={isVisible}
              />
            ) : button.isSpecial && button.id === 'dialogue-layout-dropdown' ? (
              <DialogueLayoutDropdown
                editor={editor}
                isVisible={isVisible}
                editAllSpeakers={editAllSpeakers}
                currentSpeakerName={currentSpeakerName}
              />
            ) : (
              <button
                onClick={button.action}
                className={[
                  'toolbarButton',
                  button.isActive ? 'active' : ''
                ].filter(Boolean).join(' ')}
                title={button.title}
                type="button"
              >
                <span className="icon">{button.icon}</span>
              </button>
            )}
            
            {shouldShowSeparatorAfter(button, index) && (
              <div 
                className="toolbarSeparator"
              />
            )}
          </React.Fragment>
        );
      })}
      
    </div>
  );
}; 