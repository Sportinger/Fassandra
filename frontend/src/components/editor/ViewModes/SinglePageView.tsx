import React, { useState, useCallback, useEffect } from 'react';
import '../styles/responsive.css';

import logger from '../../../services/LoggingService';
interface SinglePageViewProps {
  children: React.ReactNode;
  showRuler: boolean;
  className?: string;
  onToggleRuler?: () => void;
  onToggleViewMode?: () => void;
  rehearsalMode?: boolean;
  rehearsalLinePosition?: number;
  onOutsideClick?: () => void;
  overlay?: React.ReactNode;
}

export const SinglePageView: React.FC<SinglePageViewProps> = ({ 
  children, 
  showRuler,
  className = '',
  onToggleRuler,
  onToggleViewMode,
  rehearsalMode = false,
  rehearsalLinePosition = 0,
  onOutsideClick,
  overlay
}) => {
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; visible: boolean}>({
    x: 0, y: 0, visible: false
  });

  // Handle clicking on dark area around page to show context menu
  const handleDarkAreaClick = useCallback((e: React.MouseEvent) => {
    // Only trigger if clicking on the background container, not on the page
    if (e.target === e.currentTarget) {
      logger.debug('SinglePageView', '🖱️ Dark area clicked in single page view, resetting toolbar and showing context menu');
      // FIRST: Reset toolbar to default context when clicking outside page
      onOutsideClick?.();
      // THEN: Show context menu
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true
      });
    }
  }, [onOutsideClick]);

  // Handle context menu actions
  const handleContextMenuAction = useCallback((action: string) => {
    logger.debug('SinglePageView', '📋 Single page context menu action:', action);
    
    switch (action) {
      case 'toggle-ruler':
        onToggleRuler?.();
        break;
      case 'toggle-view':
        onToggleViewMode?.();
        break;
      default:
        logger.debug('SinglePageView', 'Unknown action:', action);
    }
    
    setContextMenu({ x: 0, y: 0, visible: false });
  }, [onToggleRuler, onToggleViewMode]);

  // Handle page break drag operations

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ x: 0, y: 0, visible: false });
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  return (
    <div className={`single-page-view ${className}`} onClick={handleDarkAreaClick}>
      <div className="singlePageContainer" style={{ position: 'relative' }}>
        <div className="dinA4Page">
          <div className="pageInner">
            {children}
          </div>
        </div>
        
        {/* Rehearsal Line - Now at container level */}
        {rehearsalMode && (
          <div 
            className="rehearsal-line"
            style={{ 
              top: `${rehearsalLinePosition}px`,
              position: 'absolute',
              left: 0,
              right: 0,
            }}
          />
        )}

        {/* Floating overlays (e.g., cue badges) */}
        {overlay}
      </div>
      
      {/* Context Menu for dark area clicks */}
      {contextMenu.visible && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            background: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
            zIndex: 10000,
            minWidth: '200px',
            padding: '4px 0',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="context-menu-item"
            style={{
              padding: '10px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              borderBottom: '1px solid var(--color-border)',
              transition: 'background-color 0.2s ease',
            }}
            onClick={() => handleContextMenuAction('toggle-ruler')}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-button-bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background)'}
          >
            📏 {showRuler ? 'Hide Ruler' : 'Show Ruler'}
          </div>
          <div 
            className="context-menu-item"
            style={{
              padding: '10px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              transition: 'background-color 0.2s ease',
            }}
            onClick={() => handleContextMenuAction('toggle-view')}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-button-bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background)'}
          >
            📄 Switch to Borderless View
          </div>
          {/* Dummy Comment option for right-click menu */}
          <div 
            className="context-menu-item"
            style={{
              padding: '10px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              transition: 'background-color 0.2s ease',
            }}
            onClick={() => {/* placeholder for future Comment action */}}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-button-bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background)'}
          >
            💬 Comment
          </div>
        </div>
      )}
    </div>
  );
}; 
