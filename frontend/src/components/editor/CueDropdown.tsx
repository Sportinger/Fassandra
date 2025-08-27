import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { CueType, CUE_TYPE_LABELS, CUE_TYPE_ICONS } from '../../types/cue';
import { DramaIcon } from './icons';

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
      className="dropdownContainer"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`toolbarButton dropdownButton ${isOpen ? 'open' : ''}`}
        type="button"
      >
        <span className="label">
          <DramaIcon size={20} />
        </span>
      </button>

      {isOpen && (
        <div className="dropdownMenu" style={{ background: '#1a1a1a' }}>
          {cueTypes.map(cueType => (
            <button
              key={cueType}
              onClick={() => handleCueSelect(cueType)}
              className="dropdownItem"
              type="button"
            >
              <span style={{ marginRight: '8px' }}>{CUE_TYPE_ICONS[cueType]}</span>
              <span>{CUE_TYPE_LABELS[cueType]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};