import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FontSizeDropdown } from '../../FontSizeDropdown';
import { FontStyleDropdown } from '../../FontStyleDropdown';
import { CueDropdown } from '../../CueDropdown';
import { CueTypeDropdown } from '../../CueTypeDropdown';
import { SearchBox } from '../../SearchBox';
import { SpeakerDropdown } from '../../SpeakerDropdown';
import { SpeakerColorPicker } from '../../SpeakerColorPicker';
import { DialogueLayoutDropdown } from '../../DialogueLayoutDropdown';
import { ViewModeDropdown } from '../../ViewModeDropdown';
import { MessageSquareQuoteIcon, SearchIcon, ClapperboardIcon, GoalIcon, PrinterIcon, LayoutPanelTopIcon, LayoutListIcon, Trash2Icon, CornerDownLeftIcon, BoldIcon, ItalicIcon, TextAlignCenterIcon, TextAlignEndIcon, TextAlignStartIcon, KeyboardIcon } from '../../icons';
import { RulerAdjustDropdown } from '../../RulerAdjustDropdown';
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
  icon: string | React.ReactElement;
  title: string;
  action: () => void;
  isActive?: boolean;
  contexts: ToolbarContext[];
  order: number;
  isSpecial?: boolean; // For components that need special rendering
  isMobileOnly?: boolean; // For mobile-only buttons
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  editor,
  context: clickContext,
  hasTextSelection,
  viewMode,
  speakerNames,
  currentSpeakerName,
  editAllSpeakers = false,
  onToggleEditAllSpeakers,
  onSetViewMode,
  className = '',
  rehearsalMode = false,
  onToggleRehearsalMode
}) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardManuallyShown, setKeyboardManuallyShown] = useState(false);
  // Force toolbar to show default context after certain actions (e.g., exit blocks)
  const [forceDefaultContext, setForceDefaultContext] = useState(false);
  // Track visual viewport offsets for Safari (older versions need left/width adjustments)
  const [vvLeft, setVvLeft] = useState<number>(() => (window.visualViewport ? window.visualViewport.offsetLeft : 0));
  const [vvWidth, setVvWidth] = useState<number>(() => (window.visualViewport ? window.visualViewport.width : window.innerWidth));
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  // Prevent scroll jumps when we programmatically focus to toggle keyboard
  const suppressFocusScrollRef = useRef<boolean>(false);
  
  // Hide keyboard when clicking outside editor, but keep editor interactive
  useEffect(() => {
    const isMobile = window.innerWidth <= 767;
    if (!isMobile) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (keyboardManuallyShown) {
        const target = e.target as HTMLElement;
        // If click is not on editor, toolbar, or keyboard FAB
        if (!target.closest('.ProseMirror') && !target.closest('.floatingToolbar') && !target.closest('.keyboardFab')) {
          setKeyboardManuallyShown(false);
          hiddenInputRef.current?.blur();
          // Do not blur the editor here; allow cursor/selection
        }
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [keyboardManuallyShown]);

  // Suppress virtual keyboard without blocking cursor/selection by hinting inputmode
  useEffect(() => {
    try {
      const isMobile = window.innerWidth <= 767;
      const pmEl: HTMLElement | null = document.querySelector('.ProseMirror');
      if (!pmEl) return;
      if (isMobile && !keyboardManuallyShown) {
        pmEl.setAttribute('inputmode', 'none');
        pmEl.setAttribute('autocomplete', 'off');
        pmEl.setAttribute('autocorrect', 'off');
        pmEl.setAttribute('autocapitalize', 'off');
      } else {
        pmEl.removeAttribute('inputmode');
        pmEl.removeAttribute('autocomplete');
        pmEl.removeAttribute('autocorrect');
        pmEl.removeAttribute('autocapitalize');
      }
    } catch {}
  }, [keyboardManuallyShown, windowWidth]);

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
        const vv = window.visualViewport;
        const currentVisualHeight = vv.height;
        // Insets at the bottom of the layout viewport: distance from bottom of visual viewport
        // to bottom of layout viewport (covers on‑screen keyboard and browser UI)
        const insetBottom = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
        
        // Direct calculation - keyboard/viewport inset is the difference
        const keyboardHeightCalculated = insetBottom > 50 ? insetBottom : 0;
        // Track lateral pan/width to keep fixed elements aligned to the visual viewport
        setVvLeft(vv.offsetLeft || 0);
        setVvWidth(vv.width || window.innerWidth);
        
        logger.debug('Toolbar', '[🎭 Mobile Keyboard] Visual Viewport detection:', {
          windowHeight: window.innerHeight,
          visualHeight: currentVisualHeight,
          offsetTop: vv.offsetTop,
          insetBottom,
          keyboardHeight: keyboardHeightCalculated,
          deviceType,
          isLandscape,
        });
        
        setKeyboardHeight(keyboardHeightCalculated);
      } else {
        // Fallback: detect via window.innerHeight changes
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        
        // Simple calculation - if height decreased by more than 100px, keyboard is likely open
        const keyboardHeightCalculated = heightDifference > 100 ? heightDifference : 0;
        
        logger.debug('Toolbar', '[🎭 Mobile Keyboard] Fallback detection:', {
          initial: initialViewportHeight,
          current: currentHeight,
          keyboardHeight: keyboardHeightCalculated,
        });
        
        setKeyboardHeight(keyboardHeightCalculated);
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
      window.visualViewport.addEventListener('resize', debouncedDetect, { passive: true } as any);
      // Critical: track visual viewport panning when page scrolls/zooms
      window.visualViewport.addEventListener('scroll', debouncedDetect, { passive: true } as any);
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
            // Avoid auto-centering scroll if we toggled keyboard via FAB
            if (!suppressFocusScrollRef.current) {
              if (target.scrollIntoView) {
                target.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center',
                  inline: 'nearest'
                });
              }
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
          window.visualViewport.removeEventListener('resize', debouncedDetect as any);
          window.visualViewport.removeEventListener('scroll', debouncedDetect as any);
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
  const focusIfNeeded = () => {
    if (keyboardManuallyShown) {
      editor?.commands.focus();
    }
  };

  const allButtons = useMemo((): ToolbarButton[] => [
    // Text formatting buttons (text-formatting context)
    {
      id: 'bold',
      icon: <BoldIcon />,
      title: 'Bold',
      action: () => { focusIfNeeded(); editor?.chain().toggleBold().run(); },
      isActive: editor?.isActive('bold'),
      contexts: ['text-formatting'],
      order: 1
    },
    {
      id: 'italic',
      icon: <ItalicIcon />,
      title: 'Italic',
      action: () => { focusIfNeeded(); editor?.chain().toggleItalic().run(); },
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
      icon: <TextAlignStartIcon />,
      title: 'Align Left',
      action: () => { focusIfNeeded(); editor?.chain().setTextAlign('left').run(); },
      isActive: editor?.isActive({ textAlign: 'left' }),
      contexts: ['text-formatting'],
      order: 6
    },
    {
      id: 'align-center',
      icon: <TextAlignCenterIcon />,
      title: 'Align Center',
      action: () => { focusIfNeeded(); editor?.chain().setTextAlign('center').run(); },
      isActive: editor?.isActive({ textAlign: 'center' }),
      contexts: ['text-formatting'],
      order: 7
    },
    {
      id: 'align-right',
      icon: <TextAlignEndIcon />,
      title: 'Align Right',
      action: () => { focusIfNeeded(); editor?.chain().setTextAlign('right').run(); },
      isActive: editor?.isActive({ textAlign: 'right' }),
      contexts: ['text-formatting'],
      order: 8
    },

    // Dialogue layout dropdown
    {
      id: 'dialogue-layout-dropdown',
      icon: <LayoutListIcon />,
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
        focusIfNeeded();
        editor?.chain().toggleDialogueStrikeThrough().run();
      },
      isActive: (() => {
        let selection: any = null;
        try {
          selection = (editor as any)?.state?.selection || null;
        } catch {}
        const $from = selection?.$from;
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
      id: 'clear-speaker',
      icon: <Trash2Icon />,
      title: 'Clear Speaker Name',
      action: () => {
        logger.debug('Toolbar', 'Clearing speaker name');
        // Clear the speaker text
        focusIfNeeded();
        editor?.chain().deleteSelection().insertContent('').run();
      },
      contexts: ['speaker-select'],
      order: 7,
    },
    {
      id: 'exit-dialogue',
      icon: <CornerDownLeftIcon />,
      title: 'Exit Dialogue Block (Create Normal Text)',
      action: () => {
        logger.debug('Toolbar', 'Exiting dialogue block');
        focusIfNeeded();
        editor?.chain().exitDialogueBlock().run();
        // Switch toolbar to default immediately
        setForceDefaultContext(true);
        setTimeout(() => setForceDefaultContext(false), 250);
      },
      contexts: ['dialogue-layout', 'speaker-select'],
      order: 8,
    },

    // Page interaction buttons (empty-page context)
    {
      id: 'insert-dialogue',
      icon: <MessageSquareQuoteIcon />,
      title: 'Insert Dialogue Block',
      action: () => {
        logger.debug('Toolbar', 'Inserting dialogue block');
        focusIfNeeded();
        editor?.chain().insertDialogueBlock().run();
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
        focusIfNeeded();
        editor?.chain().insertContent('<hr>').run();
      },
      contexts: ['empty-page'],
      order: 2
    },

    {
      id: 'view-mode-dropdown',
      icon: <LayoutPanelTopIcon />,
      title: viewMode === 'single-page' ? 'Single Page View' : 'Multiple Pages View',
      action: () => {}, // Handled by dropdown component
      contexts: ['default'],
      order: 1,
      isSpecial: true
    },

    {
      id: 'print',
      icon: <PrinterIcon />,
      title: 'Print / Export PDF',
      action: () => {
        try {
          const editorHtml: string = (editor && (editor as any).getHTML) ? (editor as any).getHTML() : '';
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            window.print();
            return;
          }
          const css = `
            @page { size: A4 portrait; margin: 12mm 15mm; }
            html, body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { margin: 0; padding: 0; }
            .print-container { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 12pt; line-height: 1.4; color: #111; }
            /* Page breaks at our page indicators */
            .page-indicator { break-before: page; page-break-before: always; }
            .page-indicator:first-of-type { break-before: auto; page-break-before: auto; }
            .page-indicator { margin: 0 0 8mm 0; }
            .page-indicator .page-label { font-weight: 700; font-size: 11pt; }
            /* Dialogue styling basics */
            [data-type="dialogue-block"] { margin: 8pt 0 12pt 0; }
            [data-type="speaker"] { font-weight: 700; margin: 0 0 3pt 0; }
            [data-type="dialogue-text"] p { margin: 0 0 6pt 0; }
            /* Centered layout defaults */
            [data-type="dialogue-block"][data-layout="centered"] [data-type="speaker"] { text-align: center; }
            [data-type="dialogue-block"][data-layout="centered"] [data-type="dialogue-text"] { text-align: left; max-width: 60%; margin: 0 auto; }
            /* Side-by-side basic print */
            [data-type="dialogue-block"][data-layout="side-by-side"] { display: flex; gap: 8pt; align-items: flex-start; }
            [data-type="dialogue-block"][data-layout="side-by-side"] > [data-type="speaker"] { min-width: 25%; text-align: left; }
            [data-type="dialogue-block"][data-layout="side-by-side"] > [data-type="dialogue-text"] { flex: 1; }
            /* Avoid splitting dialogue blocks awkwardly */
            [data-type="dialogue-block"] { page-break-inside: avoid; }
          `;
          const doc = printWindow.document;
          doc.open();
          doc.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Script</title><style>${css}</style></head><body><div class="print-container">${editorHtml}</div></body></html>`);
          doc.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 100);
        } catch {
          window.print();
        }
      },
      contexts: ['default'],
      order: 4
    },
    
    // (Keyboard toggle moved to floating FAB on mobile)
    
    // Scene context buttons (scene-select context)
    {
      id: 'delete-scene',
      icon: '🗑️',
      title: 'Delete Scene',
      action: () => {
        logger.debug('Toolbar', 'Deleting scene block');
        const state: any = (editor as any)?.state;
        const selection = state?.selection;
        const { $from } = selection;
        
        // Find the scene block
        for (let depth = $from.depth; depth >= 0; depth--) {
          const node = $from.node(depth);
          if (node && node.type.name === 'sceneBlock') {
            // Delete the entire scene block
            const pos = $from.before(depth);
            const endPos = $from.after(depth);
        focusIfNeeded();
        editor?.chain().deleteRange({ from: pos, to: endPos }).run();
            
            // Renumber scenes after deletion
            setTimeout(() => {
              editor?.commands.renumberAllScenes();
            }, 50);
            break;
          }
        }
      },
      contexts: ['scene-select'],
      order: 1
    },

    // Ruler adjust (default context)
    {
      id: 'ruler-adjust',
      icon: '📏',
      title: 'Adjust Margins',
      action: () => {}, // handled by dropdown
      contexts: ['default'],
      order: 5,
      isSpecial: true
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
      icon: <ClapperboardIcon />,
      title: 'Add Scene',
      action: () => { focusIfNeeded(); editor?.commands.insertSceneBlock(); },
      contexts: ['default'],
      order: 11
    },
    
    
    // Rehearsal Mode Toggle (default context)
    {
      id: 'rehearsal-mode',
      icon: <GoalIcon />,
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
      icon: <SearchIcon />,
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
        focusIfNeeded();
        editor?.chain().deleteNode('cueBlock').run();
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
          focusIfNeeded();
          editor?.chain()
            .setTextSelection(endPos)
            .insertContent({ type: 'paragraph' })
            .run();
          // Switch toolbar to default immediately
          setForceDefaultContext(true);
          setTimeout(() => setForceDefaultContext(false), 250);
      }
      },
      contexts: ['cue-select'],
      order: 3
    },
      ], [editor, viewMode, onSetViewMode, rehearsalMode, onToggleRehearsalMode, currentCueType, editAllSpeakers, currentSpeakerName, onToggleEditAllSpeakers, keyboardManuallyShown, hiddenInputRef, windowWidth]);

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
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--keyboard-offset', `${keyboardHeight}px`);
      return () => {
        document.documentElement.style.removeProperty('--keyboard-offset');
      };
    }
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
            ) : button.isSpecial && button.id === 'view-mode-dropdown' ? (
              <ViewModeDropdown
                viewMode={viewMode}
                onSetViewMode={onSetViewMode}
                isVisible={isVisible}
              />
            ) : button.isSpecial && button.id === 'ruler-adjust' ? (
              <RulerAdjustDropdown isVisible={isVisible} />
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
                <span className="icon">
                  {typeof button.icon === 'string' ? button.icon : button.icon}
                </span>
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

      {/* Floating round Keyboard toggle FAB (mobile only) */}
      {windowWidth <= 767 && (
        <button
          type="button"
          className="keyboardFab"
          title={keyboardManuallyShown ? 'Hide Keyboard' : 'Show Keyboard'}
          aria-pressed={keyboardManuallyShown}
          aria-label={keyboardManuallyShown ? 'Hide Keyboard' : 'Show Keyboard'}
          onClick={() => {
            const isMobile = window.innerWidth <= 767;
            if (!isMobile) return;
            if (keyboardManuallyShown) {
              hiddenInputRef.current?.blur();
              setKeyboardManuallyShown(false);
            } else {
              // Prevent scroll jumps while toggling
              suppressFocusScrollRef.current = true;
              const sx = window.scrollX, sy = window.scrollY;
              try { (hiddenInputRef.current as any)?.focus?.({ preventScroll: true }); } catch { hiddenInputRef.current?.focus(); }
              setKeyboardManuallyShown(true);
              setTimeout(() => {
                try {
                  if ((editor as any)?.chain) {
                    (editor as any).chain().focus(undefined, { scrollIntoView: false }).run();
                  } else {
                    (editor as any)?.commands?.focus?.(null, { scrollIntoView: false });
                  }
                } catch {
                  (editor as any)?.commands?.focus?.();
                }
                // Restore scroll position just in case
                try { window.scrollTo(sx, sy); } catch {}
                setTimeout(() => { suppressFocusScrollRef.current = false; }, 300);
              }, 120);
            }
          }}
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
