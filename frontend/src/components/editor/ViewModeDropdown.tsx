import React, { useState, useRef, useEffect } from 'react';
import { ViewMode } from './types/index';
import { LayoutPanelTopIcon } from './icons';

interface ViewModeDropdownProps {
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  isVisible?: boolean;
  transitionDelay?: string;
}

const VIEW_MODE_LABELS = {
  'single-page': 'Single Page View',
  'multiple-pages': 'Multiple Pages View',
  'virtual-page': 'Virtual Page View'
};

const VIEW_MODE_ICONS = {
  'single-page': <LayoutPanelTopIcon />,
  'multiple-pages': <LayoutPanelTopIcon />,
  'virtual-page': '📄'
};

export const ViewModeDropdown: React.FC<ViewModeDropdownProps> = ({
  viewMode,
  onSetViewMode,
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

  const handleViewModeSelect = (selectedViewMode: ViewMode) => {
    onSetViewMode(selectedViewMode);
    setIsOpen(false);
  };

  const viewModes: ViewMode[] = ['single-page', 'multiple-pages'];

  const currentIcon = VIEW_MODE_ICONS[viewMode];
  const currentLabel = VIEW_MODE_LABELS[viewMode];

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

      {isOpen && (
        <div className="dropdownMenu" style={{ background: '#1a1a1a' }}>
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
      )}
    </div>
  );
};
