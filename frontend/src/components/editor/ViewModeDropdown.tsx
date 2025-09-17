import React, { useState, useRef, useEffect } from 'react';
import { MobilePortal } from './MobilePortal';
import { ViewMode } from './types/index';
import { LayoutPanelTopIcon } from './icons';

interface ViewModeDropdownProps {
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
}

const VIEW_MODE_LABELS = {
  'single-page': 'Single Page View',
  'multiple-pages': 'Multiple Pages View',
  'virtual-page': 'Virtual Page View',
  'borderless': 'Borderless View',
} as const;

const VIEW_MODE_ICONS = {
  'single-page': <LayoutPanelTopIcon />,
  'multiple-pages': <LayoutPanelTopIcon />,
  'virtual-page': '📄',
  'borderless': '▭',
} as const;

export const ViewModeDropdown: React.FC<ViewModeDropdownProps> = ({
  viewMode,
  onSetViewMode,
}) => {
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

  const handleViewModeSelect = (selectedViewMode: ViewMode) => {
    onSetViewMode(selectedViewMode);
    setIsOpen(false);
  };

  const viewModes: ViewMode[] = ['single-page', 'borderless'];

  const currentIcon = VIEW_MODE_ICONS[viewMode] ?? VIEW_MODE_ICONS['single-page'];
  const currentLabel = VIEW_MODE_LABELS[viewMode] ?? VIEW_MODE_LABELS['single-page'];

  return (
    <div
      ref={dropdownRef}
      className="dropdownContainer"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`toolbarButton dropdownButton ${isOpen ? 'open' : ''}`}
        type="button"
        title={currentLabel}
      >
        <span className="label">
          {React.isValidElement(currentIcon) ? React.cloneElement(currentIcon as React.ReactElement<{size?: number}>, { size: 20 }) : currentIcon}
        </span>
      </button>

      {isOpen && (!isMobile ? (
        <div className="dropdownMenu" style={{ background: '#1a1a1a' }} ref={menuPortalRef}>
          {viewModes.map(mode => (
            <button
              key={mode}
              onClick={() => handleViewModeSelect(mode)}
              className={`dropdownItem ${viewMode === mode ? 'active' : ''}`}
              type="button"
            >
              <span style={{ marginRight: '8px' }}>
                {React.isValidElement(VIEW_MODE_ICONS[mode]) ? React.cloneElement(VIEW_MODE_ICONS[mode] as React.ReactElement<{size?: number}>, { size: 18 }) : VIEW_MODE_ICONS[mode]}
              </span>
              <span>{VIEW_MODE_LABELS[mode]}</span>
              {viewMode === mode && <span style={{ marginLeft: 'auto' }}>✓</span>}
            </button>
          ))}
        </div>
      ) : (
        <MobilePortal ref={menuPortalRef}>
          <div className="dropdownMenu" style={{ background: '#1a1a1a' }}>
            <div className="dropdownList">
              {viewModes.map(mode => (
                <button
                  key={mode}
                  onClick={() => handleViewModeSelect(mode)}
                  className={`dropdownItem ${viewMode === mode ? 'active' : ''}`}
                  type="button"
                >
                  <span style={{ marginRight: '8px' }}>
                    {React.isValidElement(VIEW_MODE_ICONS[mode]) ? React.cloneElement(VIEW_MODE_ICONS[mode] as React.ReactElement<{size?: number}>, { size: 18 }) : VIEW_MODE_ICONS[mode]}
                  </span>
                  <span>{VIEW_MODE_LABELS[mode]}</span>
                  {viewMode === mode && <span style={{ marginLeft: 'auto' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </MobilePortal>
      ))}
    </div>
  );
};
