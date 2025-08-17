import React, { useState, useRef, useEffect } from 'react';
import { Editor as EditorInstance } from '@tiptap/react';
import './styles/toolbar.css';

import logger from '../../services/LoggingService';
interface FontSizeDropdownProps {
  editor: EditorInstance | null;
  isVisible: boolean;
  transitionDelay?: string;
}

const FONT_SIZES = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 48, 60, 72, 96
];

export const FontSizeDropdown: React.FC<FontSizeDropdownProps> = ({ 
  editor, 
  isVisible, 
  transitionDelay = '0ms' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSize, setCurrentSize] = useState<number>(16);
  const [dropdownPosition, setDropdownPosition] = useState<'right' | 'left'>('right');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get current font size from editor
  useEffect(() => {
    if (!editor) return;

    const updateFontSize = () => {
      try {
        // First, try to get font size from textStyle mark
        const { selection } = editor.state;
        const { from, to, empty } = selection;
        
        // Check for textStyle mark with style attribute
        let fontSize = null;
        
        if (empty) {
          // Check stored marks at cursor position
          const storedMarks = selection.$from.marks();
          const textStyleMark = storedMarks.find(mark => mark.type.name === 'textStyle');
          if (textStyleMark?.attrs?.fontSize) {
            const fontSizeStr = textStyleMark.attrs.fontSize;
            const fontSizeMatch = fontSizeStr.match(/(\d+)px/);
            if (fontSizeMatch) {
              fontSize = parseInt(fontSizeMatch[1]);
            }
          }
        } else {
          // Check marks in selection
          editor.state.doc.nodesBetween(from, to, (node) => {
            if (node.marks) {
              const textStyleMark = node.marks.find(mark => mark.type.name === 'textStyle');
              if (textStyleMark?.attrs?.fontSize) {
                const fontSizeStr = textStyleMark.attrs.fontSize;
                const fontSizeMatch = fontSizeStr.match(/(\d+)px/);
                if (fontSizeMatch) {
                  fontSize = parseInt(fontSizeMatch[1]);
                  return false; // Stop iteration
                }
              }
            }
          });
        }
        
        if (fontSize) {
          setCurrentSize(fontSize);
          return;
        }
        
        // Fallback: Check if we're in a heading and map to typical sizes
        if (editor.isActive('heading', { level: 1 })) {
          setCurrentSize(32);
        } else if (editor.isActive('heading', { level: 2 })) {
          setCurrentSize(24);
        } else if (editor.isActive('heading', { level: 3 })) {
          setCurrentSize(20);
        } else {
          // Default to 16px for normal text
          setCurrentSize(16);
        }
      } catch (error) {
        logger.warn('FontSizeDropdown', 'Font size detection failed:', error);
        setCurrentSize(16);
      }
    };

    // Update on selection change
    editor.on('selectionUpdate', updateFontSize);
    editor.on('transaction', updateFontSize);
    
    updateFontSize();

    return () => {
      editor.off('selectionUpdate', updateFontSize);
      editor.off('transaction', updateFontSize);
    };
  }, [editor]);

  // Handle font size change
  const handleFontSizeChange = (size: number) => {
    if (!editor) return;

    logger.debug('FontSizeDropdown', `[FontSize] Applying ${size}px to selection`);
    
    // Use our custom FontSize extension command
    editor.chain().focus().setFontSize(`${size}px`).run();
    
    // Debug: Check the HTML output
    setTimeout(() => {
      logger.debug('FontSizeDropdown', '[FontSize] HTML after change:', editor.getHTML());
    }, 100);
    
    setCurrentSize(size);
    setIsOpen(false);
  };

  // Smart positioning based on available space
  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const dropdownWidth = 80; // Width of our dropdown
    const margin = 12; // Updated margin
    
    // Check if there's enough space on the right
    const spaceOnRight = viewportWidth - (buttonRect.right + margin + dropdownWidth);
    
    if (spaceOnRight >= 20) { // Leave some buffer
      setDropdownPosition('right');
    } else {
      setDropdownPosition('left');
    }
  };

  // Update position when opening dropdown
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown when component becomes invisible
  useEffect(() => {
    if (!isVisible) {
      setIsOpen(false);
    }
  }, [isVisible]);

  return (
    <div 
      ref={dropdownRef}
      className={[
        'dropdownContainer',
        'morphingButton',
        isVisible ? 'visible' : 'hidden'
      ].filter(Boolean).join(' ')}
      style={{ transitionDelay }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={[
          'toolbarButton',
          'dropdownButton',
          isOpen ? 'active' : ''
        ].filter(Boolean).join(' ')}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="label">
          {currentSize}
        </span>
        <span className={[
          'arrow',
          isOpen ? 'open' : ''
        ].filter(Boolean).join(' ')}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className={[
          'dropdownMenu',
          `position-${dropdownPosition}`
        ].filter(Boolean).join(' ')} style={{ background: '#1a1a1a' }}>
          <div className="dropdownList">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={[
                  'dropdownItem',
                  currentSize === size ? 'active' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => handleFontSizeChange(size)}
                style={{ fontSize: `${Math.min(size, 18)}px` }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 