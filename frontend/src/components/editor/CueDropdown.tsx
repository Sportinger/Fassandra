import React, { useState, useRef, useEffect } from 'react';
import { MobilePortal } from './MobilePortal';
import { Editor } from '@tiptap/react';
import { CueType, CUE_TYPE_LABELS, CUE_TYPE_ICONS } from '../../types/cue';
import { DramaIcon } from './icons';

interface CueDropdownProps {
  editor: Editor;
  isVisible?: boolean;
  transitionDelay?: string;
}

export const CueDropdown: React.FC<CueDropdownProps> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth <= 767 : false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 767);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const handleCueSelect = (cueType: CueType) => {
    // Enter cue select mode: highlight words and click to create cue mark
    (editor as any).commands.startCueSelect(cueType);
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

      {isOpen && (!isMobile ? (
        <div className="dropdownMenu" style={{ background: '#1a1a1a' }} ref={menuPortalRef}>
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
      ) : (
        <MobilePortal ref={menuPortalRef}>
          <div className="dropdownMenu" style={{ background: '#1a1a1a' }}>
            <div className="dropdownList">
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
          </div>
        </MobilePortal>
      ))}
    </div>
  );
};
