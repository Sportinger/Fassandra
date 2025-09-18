import React, { useEffect, useRef, useState } from 'react';
import { MobilePortal } from './MobilePortal';
import { EyeIcon } from './icons';
import { useEditorLayout } from './contexts/EditorUiContext';

interface VisibilityDropdownProps {
  isVisible?: boolean;
}

export const VisibilityDropdown: React.FC<VisibilityDropdownProps> = () => {
  const { showCues, setShowCues, showStruckDialogue, setShowStruckDialogue } = useEditorLayout();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth <= 767 : false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 767);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const items = [
    {
      id: 'toggle-cues',
      label: 'Show cues',
      checked: showCues,
      onToggle: () => setShowCues(prev => !prev),
    },
    {
      id: 'toggle-struck-dialogue',
      label: 'Show struck dialogue',
      checked: showStruckDialogue,
      onToggle: () => setShowStruckDialogue(prev => !prev),
    },
  ];

  const menu = (
    <div className="dropdownMenu" style={{ background: '#1a1a1a' }} ref={menuPortalRef}>
      <div className="dropdownList">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            className="dropdownItem"
            onClick={() => item.onToggle()}
          >
            <span className="toggleIndicator">{item.checked ? '☑' : '☐'}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div ref={dropdownRef} className="dropdownContainer">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`toolbarButton dropdownButton ${isOpen ? 'open' : ''} ${(!showCues || !showStruckDialogue) ? 'active' : ''}`}
        type="button"
        title="Visibility Options"
      >
        <span className="label"><EyeIcon size={20} /></span>
      </button>

      {isOpen && (
        isMobile ? (
          <MobilePortal ref={menuPortalRef}>{menu}</MobilePortal>
        ) : (
          menu
        )
      )}
    </div>
  );
};

export default VisibilityDropdown;
