/**
 * Enhanced Toolbar Component
 * Full-featured floating toolbar with context-aware buttons and animations
 * Matches the original FloatingToolbar functionality
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FontSizeDropdown } from '../../FontSizeDropdown';
import { SpeakerDropdown } from '../../SpeakerDropdown';
import type { ToolbarProps, ToolbarContext } from '../../types/index';

// Import the responsive styles
import '../../styles/toolbar.css';

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
  onSetViewMode,
  onToggleRuler,
  className = ''
}) => {
  const [visibleButtons, setVisibleButtons] = useState<Set<string>>(new Set());
  const [previousContext, setPreviousContext] = useState<ToolbarContext>('default');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Handle window resize for responsive toolbar height
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clear all pending timeouts
  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
  };

  // Add timeout with tracking
  const addTimeout = (callback: () => void, delay: number) => {
    const timeout = setTimeout(() => {
      callback();
      timeoutsRef.current.delete(timeout);
    }, delay);
    timeoutsRef.current.add(timeout);
    return timeout;
  };

  // Determine current context based on editor state
  const getContext = (): ToolbarContext => {
    if (!editor) return 'default';
    
    const isInDialogueBlock = editor.isActive('dialogueBlock');
    console.log('Context check - isInDialogueBlock:', isInDialogueBlock, 'hasTextSelection:', hasTextSelection);
    
    if (isInDialogueBlock) return 'dialogue-block';
    if (hasTextSelection) return 'text-selection';
    if (clickContext === 'empty-page') return 'empty-page';
    if (clickContext === 'speaker-selection') return 'speaker-selection';
    return 'default';
  };

  const currentContext = getContext();

  // Define all possible buttons with their contexts and actions
  const allButtons = useMemo((): ToolbarButton[] => [
    // Text formatting buttons (text-selection context)
    {
      id: 'bold',
      icon: 'B',
      title: 'Bold',
      action: () => editor?.chain().focus().toggleBold().run(),
      isActive: editor?.isActive('bold'),
      contexts: ['text-selection'],
      order: 1
    },
    {
      id: 'italic',
      icon: 'I',
      title: 'Italic', 
      action: () => editor?.chain().focus().toggleItalic().run(),
      isActive: editor?.isActive('italic'),
      contexts: ['text-selection'],
      order: 2
    },
    {
      id: 'font-size',
      icon: '16', // Will be replaced by FontSizeDropdown
      title: 'Font Size',
      action: () => {}, // No action needed, handled by dropdown
      contexts: ['text-selection'],
      order: 4,
      isSpecial: true
    },
    {
      id: 'align-left',
      icon: '⊢',
      title: 'Align Left',
      action: () => editor?.chain().focus().setTextAlign('left').run(),
      isActive: editor?.isActive({ textAlign: 'left' }),
      contexts: ['text-selection'],
      order: 6
    },
    {
      id: 'align-center',
      icon: '‖',
      title: 'Align Center',
      action: () => editor?.chain().focus().setTextAlign('center').run(),
      isActive: editor?.isActive({ textAlign: 'center' }),
      contexts: ['text-selection'],
      order: 7
    },
    {
      id: 'align-right',
      icon: '⊣',
      title: 'Align Right',
      action: () => editor?.chain().focus().setTextAlign('right').run(),
      isActive: editor?.isActive({ textAlign: 'right' }),
      contexts: ['text-selection'],
      order: 8
    },

    // Dialogue block layout switchers
    {
      id: 'layout-default',
      icon: '≡',
      title: 'Stacked Layout',
      action: () => {
        console.log('Setting layout to default');
        const result = editor?.chain().focus().updateAttributes('dialogueBlock', { layout: 'default' }).run();
        console.log('Update result:', result);
      },
      isActive: editor?.isActive('dialogueBlock', { layout: 'default' }),
      contexts: ['dialogue-block'],
      order: 1,
    },
    {
      id: 'layout-side-by-side',
      icon: '⇥',
      title: 'Side-by-Side Layout',
      action: () => {
        console.log('Setting layout to side-by-side');
        const result = editor?.chain().focus().updateAttributes('dialogueBlock', { layout: 'side-by-side' }).run();
        console.log('Update result:', result);
      },
      isActive: editor?.isActive('dialogueBlock', { layout: 'side-by-side' }),
      contexts: ['dialogue-block'],
      order: 2,
    },
    {
      id: 'exit-dialogue',
      icon: '↩',
      title: 'Exit Dialogue Block (Create Normal Text)',
      action: () => {
        console.log('Exiting dialogue block');
        editor?.chain().focus().exitDialogueBlock().run();
      },
      contexts: ['dialogue-block'],
      order: 3,
    },

    // Page interaction buttons (empty-page context)
    {
      id: 'insert-dialogue',
      icon: '💬',
      title: 'Insert Dialogue Block',
      action: () => {
        console.log('Inserting dialogue block');
        editor?.chain().focus().insertDialogueBlock().run();
      },
      contexts: ['empty-page'],
      order: 1
    },
    {
      id: 'split-page',
      icon: '⎘',
      title: 'Split Page',
      action: () => {
        console.log('Split page');
        // Insert a page break or new page
        editor?.chain().focus().insertContent('<hr>').run();
      },
      contexts: ['empty-page'],
      order: 2
    },

    // View mode buttons (default context)
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
  ], [editor, viewMode, onSetViewMode, showRuler, onToggleRuler]);

  // Get buttons for current context, sorted by order
  const contextButtons = useMemo(() => {
    return allButtons
      .filter(button => button.contexts.includes(currentContext))
      .sort((a, b) => a.order - b.order);
  }, [allButtons, currentContext]);

  // Update visible buttons when context changes
  useEffect(() => {
    // Clear any pending animations from previous context changes
    clearAllTimeouts();
    
    const newVisibleButtons = new Set(contextButtons.map(btn => btn.id));
    
    // Check if this is a rapid context change (text-selection to text-selection)
    const isRapidTextSelection = currentContext === 'text-selection' && 
                                previousContext === 'text-selection';
    
    if (isRapidTextSelection) {
      // For rapid text selections, update immediately without animation
      setVisibleButtons(newVisibleButtons);
      setPreviousContext(currentContext);
      return;
    }
    
    const enteringButtons = Array.from(newVisibleButtons).filter(id => !visibleButtons.has(id));
    const exitingButtons = Array.from(visibleButtons).filter(id => !newVisibleButtons.has(id));
    
    // If no changes needed, just update context
    if (enteringButtons.length === 0 && exitingButtons.length === 0) {
      setPreviousContext(currentContext);
      return;
    }
    
    // Check if button sets are identical (for same-context rapid switches)
    const areButtonSetsEqual = (set1: Set<string>, set2: Set<string>) => {
      if (set1.size !== set2.size) return false;
      for (const item of set1) {
        if (!set2.has(item)) return false;
      }
      return true;
    };
    
    if (areButtonSetsEqual(visibleButtons, newVisibleButtons)) {
      setPreviousContext(currentContext);
      return;
    }
    
    // First hide exiting buttons
    if (exitingButtons.length > 0) {
      exitingButtons.forEach((buttonId, index) => {
        addTimeout(() => {
          setVisibleButtons(prev => {
            const newSet = new Set(prev);
            newSet.delete(buttonId);
            return newSet;
          });
        }, index * 30); // Staggered exit
      });
    }
    
    // Then show entering buttons
    if (enteringButtons.length > 0) {
      const exitDelay = exitingButtons.length * 30;
      enteringButtons.forEach((buttonId, index) => {
        addTimeout(() => {
          setVisibleButtons(prev => new Set([...prev, buttonId]));
        }, exitDelay + 100 + (index * 50)); // Staggered entrance after exit
      });
    }

    // If no buttons are exiting, just set immediately
    if (exitingButtons.length === 0) {
      setVisibleButtons(newVisibleButtons);
    }

    setPreviousContext(currentContext);
  }, [currentContext, contextButtons]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, []);

  // Calculate dynamic toolbar height based on visible buttons and device
  const toolbarHeight = useMemo(() => {
    const visibleCount = visibleButtons.size;
    
    // Check if we're on mobile using the state that updates on resize
    const isMobile = windowWidth <= 767;
    
    if (isMobile) {
      // Mobile: horizontal layout - height is just button height + padding
      const mobileButtonHeight = 44; // Touch-optimized
      const mobilePadding = 16; // 8px top + 8px bottom (--space-sm * 2)
      const finalHeight = mobileButtonHeight + mobilePadding;
      console.log('[Mobile Toolbar] Height calculation:', {
        windowWidth,
        isMobile,
        visibleCount,
        mobileButtonHeight,
        mobilePadding,
        finalHeight
      });
      return finalHeight;
    } else {
      // Desktop: vertical layout - stack buttons
      const buttonHeight = 40;
      const gap = 8;
      const padding = 24; // 12px top + 12px bottom
      
      if (visibleCount === 0) return 64; // Minimum height
      
      // Add separators for text-selection context
      const separatorCount = currentContext === 'text-selection' ? 2 : 0;
      const separatorHeight = separatorCount * (1 + gap); // 1px height + gap
      
      const finalHeight = (visibleCount * buttonHeight) + ((visibleCount - 1) * gap) + separatorHeight + padding;
      console.log('[Desktop Toolbar] Height calculation:', {
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
  }, [visibleButtons.size, currentContext, windowWidth]);

  // Render separator between button groups (only for text-selection)
  const shouldShowSeparatorAfter = (button: ToolbarButton, index: number): boolean => {
    if (currentContext !== 'text-selection') return false;
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

  return (
    <div 
      className={`floatingToolbar morphingToolbar context-${currentContext} ${className}`}
      style={{
        height: `${toolbarHeight}px`,
        transition: 'height 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' // easeOutQuad
      }}
    >
      {contextButtons.map((button, index) => {
        const isVisible = visibleButtons.has(button.id);
        
        return (
          <React.Fragment key={button.id}>
            {button.isSpecial && button.id === 'font-size' ? (
              <FontSizeDropdown 
                editor={editor}
                isVisible={isVisible}
                transitionDelay={isVisible ? `${index * 50}ms` : `${(contextButtons.length - index) * 30}ms`}
              />
            ) : (
              <button
                onClick={button.action}
                className={[
                  'toolbarButton',
                  'morphingButton',
                  button.isActive ? 'active' : '',
                  isVisible ? 'visible' : 'hidden'
                ].filter(Boolean).join(' ')}
                title={button.title}
                type="button"
                style={{
                  transitionDelay: isVisible ? `${index * 50}ms` : `${(contextButtons.length - index) * 30}ms`
                }}
              >
                <span className="icon">{button.icon}</span>
              </button>
            )}
            
            {shouldShowSeparatorAfter(button, index) && (
              <div 
                className={[
                  'toolbarSeparator',
                  'morphingSeparator',
                  isVisible ? 'visible' : 'hidden'
                ].filter(Boolean).join(' ')}
                style={{
                  transitionDelay: isVisible ? `${(index + 1) * 50}ms` : `${(contextButtons.length - index - 1) * 30}ms`
                }}
              />
            )}
          </React.Fragment>
        );
      })}
      
      {/* Speaker Dropdown for speaker-selection context */}
      {currentContext === 'speaker-selection' && (
        <SpeakerDropdown
          editor={editor}
          speakerNames={speakerNames}
          isVisible={true}
        />
      )}
    </div>
  );
}; 