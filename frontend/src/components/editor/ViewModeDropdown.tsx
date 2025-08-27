import React, { useState, useRef, useEffect } from 'react';
import { ViewMode } from './types/index';

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

// SVG Icon Components
const SinglePageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="9" y1="9" x2="15" y2="9"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
);

const MultiPageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="18" rx="2" ry="2"/>
    <rect x="14" y="3" width="7" height="18" rx="2" ry="2"/>
  </svg>
);

const VIEW_MODE_ICONS = {
  'single-page': <SinglePageIcon />,
  'multiple-pages': <MultiPageIcon />,
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
          {React.isValidElement(currentIcon) ? React.cloneElement(currentIcon, { size: 20 }) : currentIcon}
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
                {React.isValidElement(VIEW_MODE_ICONS[mode]) ? React.cloneElement(VIEW_MODE_ICONS[mode], { size: 18 }) : VIEW_MODE_ICONS[mode]}
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
