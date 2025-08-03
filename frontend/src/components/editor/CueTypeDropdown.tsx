import React, { useState, useRef, useEffect } from 'react';
import { Editor as EditorInstance } from '@tiptap/react';
import { CueType, CUE_TYPE_LABELS, CUE_TYPE_ICONS } from '../../types/cue';
import './styles/toolbar.css';

interface CueTypeDropdownProps {
  editor: EditorInstance | null;
  isVisible: boolean;
  currentCueType: CueType;
  transitionDelay?: string;
}

export const CueTypeDropdown: React.FC<CueTypeDropdownProps> = ({ 
  editor, 
  isVisible, 
  currentCueType,
  transitionDelay = '0ms' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'right' | 'left'>('right');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle cue type change
  const handleCueTypeChange = (newType: CueType) => {
    if (!editor) return;

    console.log(`[CueType] Changing cue type to ${newType}`);
    
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

  const cueTypes: CueType[] = ['light', 'video', 'sound', 'props'];

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
        title="Cue Type"
      >
        <span className="icon">{CUE_TYPE_ICONS[currentCueType]}</span>
        <span className="label">
          {CUE_TYPE_LABELS[currentCueType]}
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
        ].filter(Boolean).join(' ')}>
          <div className="dropdownHeader">
            Change Cue Type
          </div>
          <div className="dropdownList">
            {cueTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={[
                  'dropdownItem',
                  currentCueType === type ? 'active' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => handleCueTypeChange(type)}
              >
                <span style={{ marginRight: '8px' }}>{CUE_TYPE_ICONS[type]}</span>
                {CUE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};