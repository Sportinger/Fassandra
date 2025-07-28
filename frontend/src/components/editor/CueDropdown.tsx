import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { CueType, CUE_TYPE_LABELS, CUE_TYPE_ICONS } from '../../types/cue';

interface CueDropdownProps {
  editor: Editor;
  isVisible?: boolean;
  transitionDelay?: string;
}

export const CueDropdown: React.FC<CueDropdownProps> = ({ 
  editor, 
  isVisible = true,
  transitionDelay = '0ms'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleCueSelect = (cueType: CueType) => {
    editor.commands.insertCueBlock(cueType);
    setIsOpen(false);
  };

  const cueTypes: CueType[] = ['light', 'video', 'sound', 'props'];

  return (
    <div 
      ref={dropdownRef}
      className="cue-dropdown-container"
      style={{
        transitionDelay: isVisible ? transitionDelay : `${parseInt(transitionDelay) * 0.5}ms`
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={[
          'toolbarButton',
          'morphingButton',
          isVisible ? 'visible' : 'hidden',
          isOpen ? 'active' : ''
        ].filter(Boolean).join(' ')}
        title="Insert Cue"
        type="button"
      >
        <span className="icon">🎭</span>
        <span className="dropdown-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="cue-dropdown-menu">
          {cueTypes.map(cueType => (
            <button
              key={cueType}
              onClick={() => handleCueSelect(cueType)}
              className="cue-dropdown-item"
              type="button"
            >
              <span className="cue-dropdown-icon">{CUE_TYPE_ICONS[cueType]}</span>
              <span className="cue-dropdown-label">{CUE_TYPE_LABELS[cueType]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};