import React, { useState, useCallback, useEffect } from 'react';
import '../styles/responsive.css';

import logger from '../../../services/LoggingService';

interface BorderlessViewProps {
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

export const BorderlessView: React.FC<BorderlessViewProps> = ({
  children,
  showRuler,
  className = '',
  onToggleRuler,
  onToggleViewMode,
  rehearsalMode = false,
  rehearsalLinePosition = 0,
  onOutsideClick,
  overlay,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      // Only trigger if clicking on the background container, not on the content panel
      if (e.target === e.currentTarget) {
        logger.debug('BorderlessView', 'Background clicked, resetting toolbar and showing context menu');
        onOutsideClick?.();
        setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
      }
    },
    [onOutsideClick]
  );

  const handleContextMenuAction = useCallback(
    (action: string) => {
      logger.debug('BorderlessView', 'Context menu action:', action);
      switch (action) {
        case 'toggle-ruler':
          onToggleRuler?.();
          break;
        case 'toggle-view':
          onToggleViewMode?.();
          break;
        default:
          logger.debug('BorderlessView', 'Unknown action:', action);
      }
      setContextMenu({ x: 0, y: 0, visible: false });
    },
    [onToggleRuler, onToggleViewMode]
  );

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) setContextMenu({ x: 0, y: 0, visible: false });
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  return (
    <div className={`borderless-view ${className}`} onClick={handleBackgroundClick}>
      {/* Keep className singlePageContainer for overlays/queries relying on it */}
      <div className="singlePageContainer" style={{ position: 'relative' }}>
        <div className="borderlessPanel">
          <div className="pageInner">{children}</div>
        </div>

        {rehearsalMode && (
          <div
            className="rehearsal-line"
            style={{ top: `${rehearsalLinePosition}px`, position: 'absolute', left: 0, right: 0 }}
          />
        )}

        {overlay}
      </div>

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
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-button-bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-background)')}
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
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-button-bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-background)')}
          >
            📄 Switch View
          </div>
        </div>
      )}
    </div>
  );
};

