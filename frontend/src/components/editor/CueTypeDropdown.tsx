import React, { useState, useRef, useEffect } from 'react';
import { MobilePortal } from './MobilePortal';
import { Editor as EditorInstance } from '@tiptap/react';
import { CueType, CUE_TYPE_LABELS, CUE_TYPE_ICONS } from '../../types/cue';
import './styles/toolbar.css';

import logger from '../../services/LoggingService';
interface CueTypeDropdownProps {
  editor: EditorInstance | null;
  isVisible: boolean;
  currentCueType: CueType;
  onCueTypeChange?: (type: CueType) => void;
  transitionDelay?: string;
}

export const CueTypeDropdown: React.FC<CueTypeDropdownProps> = ({
  editor,
  isVisible,
  currentCueType,
  onCueTypeChange,
  transitionDelay = '0ms'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'right' | 'left'>('right');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth <= 767 : false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 767);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Handle cue type change
  const handleCueTypeChange = (newType: CueType) => {
    if (!editor) return;

    logger.debug('CueTypeDropdown', `[CueType] Changing cue type to ${newType}`);

    // Save the selected type for future use
    if (onCueTypeChange) {
      onCueTypeChange(newType);
    }

    // Get the current selected cue block
    const { state } = editor;
    const { selection } = state;
    const { from } = selection;

    // Find the cue block node
    let cueBlockPos = -1;
    state.doc.nodesBetween(from, from, (node, pos) => {
      if (node.type.name === 'cueBlock') {
        cueBlockPos = pos;
        return false;
      }
    });

    if (cueBlockPos >= 0) {
      // Update the cue block attributes
      editor.chain()
        .focus()
        .updateAttributes('cueBlock', { cueType: newType })
        .run();
    }

    setIsOpen(false);
  };

  // Smart positioning based on available space
  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const dropdownWidth = 200; // Width of our dropdown
    const margin = 12;
    
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
      const target = event.target as Node;
      const inContainer = dropdownRef.current?.contains(target);
      const inMenu = menuPortalRef.current?.contains(target);
      if (!inContainer && !inMenu) {
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

  const cueTypes: CueType[] = ['light', 'video', 'sound', 'props', 'technik', 'einruf'];

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
        <span className="label">{CUE_TYPE_ICONS[currentCueType]}</span>
        <span className={[
          'arrow',
          isOpen ? 'open' : ''
        ].filter(Boolean).join(' ')}>
          ▼
        </span>
      </button>

      {isOpen && (!isMobile ? (
        <div
          className={[ 'dropdownMenu', `position-${dropdownPosition}` ].join(' ')}
          style={{ background: '#1a1a1a' }}
          ref={menuPortalRef}
        >
          {cueTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={[ 'dropdownItem', currentCueType === type ? 'active' : '' ].join(' ')}
              onClick={() => handleCueTypeChange(type)}
            >
              <span style={{ marginRight: '8px' }}>{CUE_TYPE_ICONS[type]}</span>
              {CUE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      ) : (
        <MobilePortal ref={menuPortalRef}>
          <div className="dropdownMenu" style={{ background: '#1a1a1a' }}>
            <div className="dropdownList">
              {cueTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={[ 'dropdownItem', currentCueType === type ? 'active' : '' ].join(' ')}
                  onClick={() => handleCueTypeChange(type)}
                >
                  <span style={{ marginRight: '8px' }}>{CUE_TYPE_ICONS[type]}</span>
                  {CUE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        </MobilePortal>
      ))}
    </div>
  );
};
