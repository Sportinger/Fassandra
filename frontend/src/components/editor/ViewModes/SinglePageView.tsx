import React, { useState, useCallback, useEffect } from 'react';
import { Ruler } from '../Ruler';
import { PageBreakIndicator } from '../components/PageBreakIndicator';
import '../styles/responsive.css';

interface PageBreak {
  id: string;
  pageNumber: number;
  position: number; // Position in the document (percentage from top)
}

interface SinglePageViewProps {
  children: React.ReactNode;
  showRuler: boolean;
  showPageNumbers?: boolean;
  className?: string;
  onToggleRuler?: () => void;
  onToggleViewMode?: () => void;
  pageBreaks?: PageBreak[];
  onPageBreaksChange?: (pageBreaks: PageBreak[]) => void;
}

export const SinglePageView: React.FC<SinglePageViewProps> = ({ 
  children, 
  showRuler,
  showPageNumbers = false,
  className = '',
  onToggleRuler,
  onToggleViewMode,
  pageBreaks = [],
  onPageBreaksChange
}) => {
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; visible: boolean}>({
    x: 0, y: 0, visible: false
  });
  const [draggedPageBreak, setDraggedPageBreak] = useState<string | null>(null);
  const [selectedPageBreak, setSelectedPageBreak] = useState<string | null>(null);

  // Handle clicking on dark area around page to show context menu
  const handleDarkAreaClick = useCallback((e: React.MouseEvent) => {
    // Only trigger if clicking on the background container, not on the page
    if (e.target === e.currentTarget) {
      console.log('🖱️ Dark area clicked in single page view, showing context menu');
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true
      });
    }
  }, []);

  // Handle context menu actions
  const handleContextMenuAction = useCallback((action: string) => {
    console.log('📋 Single page context menu action:', action);
    
    switch (action) {
      case 'toggle-ruler':
        onToggleRuler?.();
        break;
      case 'toggle-view':
        onToggleViewMode?.();
        break;
      default:
        console.log('Unknown action:', action);
    }
    
    setContextMenu({ x: 0, y: 0, visible: false });
  }, [onToggleRuler, onToggleViewMode]);

  // Handle page break drag operations
  const handlePageBreakDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, pageBreakId: string) => {
    setDraggedPageBreak(pageBreakId);
    e.dataTransfer.setData('text/plain', pageBreakId);
  }, []);

  const handlePageBreakDragEnd = useCallback(() => {
    setDraggedPageBreak(null);
  }, []);

  const handlePageBreakDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handlePageBreakDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pageBreakId = e.dataTransfer.getData('text/plain');
    
    if (pageBreakId && onPageBreaksChange) {
      // Calculate new position based on drop location
      const rect = e.currentTarget.getBoundingClientRect();
      const dropY = e.clientY - rect.top;
      const newPosition = (dropY / rect.height) * 100;
      
      // Update page break position
      const updatedPageBreaks = pageBreaks.map(pb => 
        pb.id === pageBreakId 
          ? { ...pb, position: Math.max(0, Math.min(100, newPosition)) }
          : pb
      );
      
      onPageBreaksChange(updatedPageBreaks);
    }
    
    setDraggedPageBreak(null);
  }, [pageBreaks, onPageBreaksChange]);

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
      {showRuler && <Ruler />}
      <div className="singlePageContainer">
        <div className="dinA4Page" style={{ position: 'relative' }}>
          {children}
          
          {/* Page Break Indicators */}
          {showPageNumbers && pageBreaks.map((pageBreak) => (
            <PageBreakIndicator
              key={pageBreak.id}
              editor={null}
              pageNumber={pageBreak.pageNumber}
              position={pageBreak.position}
              isVisible={true}
              onMove={(pageNum, newPosition) => {
                if (onPageBreaksChange) {
                  const updatedPageBreaks = pageBreaks.map(pb => 
                    pb.pageNumber === pageNum 
                      ? { ...pb, position: newPosition }
                      : pb
                  );
                  onPageBreaksChange(updatedPageBreaks);
                }
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Context Menu for dark area clicks */}
      {contextMenu.visible && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: 10000,
            minWidth: '200px',
            padding: '4px 0',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="context-menu-item"
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              borderBottom: '1px solid #eee',
              transition: 'background-color 0.2s ease',
            }}
            onClick={() => handleContextMenuAction('toggle-ruler')}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            📏 {showRuler ? 'Hide Ruler' : 'Show Ruler'}
          </div>
          <div 
            className="context-menu-item"
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              transition: 'background-color 0.2s ease',
            }}
            onClick={() => handleContextMenuAction('toggle-view')}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            📄 Switch to Multiple Pages View
          </div>
        </div>
      )}
    </div>
  );
}; 