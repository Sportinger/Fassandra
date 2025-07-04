import React, { useState, useCallback } from 'react';

interface RulerProps {
  className?: string;
  headerMargin?: number;
  footerMargin?: number;
  onHeaderMarginChange?: (margin: number) => void;
  onFooterMarginChange?: (margin: number) => void;
  pageHeight?: number;
  pageIndex?: number;
  showHandles?: boolean;
}

export const Ruler: React.FC<RulerProps> = ({ 
  className = '',
  headerMargin = 40,
  footerMargin = 40,
  onHeaderMarginChange,
  onFooterMarginChange,
  pageHeight = 600,
  pageIndex = 0,
  showHandles = false
}) => {
  const [isDragging, setIsDragging] = useState<'header' | 'footer' | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartMargin, setDragStartMargin] = useState(0);
  
  // Generate vertical ruler marks for THIS page only (0 to pageHeight)
  const generateVerticalMarks = () => {
    const marks = [];
    
    // Create marks for this page only (0 to pageHeight)
    for (let i = 0; i <= Math.ceil(pageHeight / 28.35); i++) { // 28.35 pixels per cm approximately
      const cmValue = i * 0.5;
      const pixelValue = cmValue * 28.35; // Convert cm to pixels
      
      if (pixelValue > pageHeight) break;
      
      const isFullCm = i % 2 === 0;
      const isFiveCm = cmValue % 5 === 0 && cmValue > 0;
      
      marks.push(
        <div
          key={`mark-${i}`}
          className="ruler-mark"
          style={{
            position: 'absolute',
            top: `${pixelValue}px`,
            right: '5px',
            width: isFiveCm ? '15px' : isFullCm ? '10px' : '6px',
            height: '1px',
            backgroundColor: '#fff',
            transformOrigin: 'right center',
          }}
        >
          {isFiveCm && (
            <span 
              className="ruler-label"
              style={{
                position: 'absolute',
                right: '18px',
                top: '-6px',
                fontSize: '9px',
                fontWeight: '500',
                color: '#fff',
                userSelect: 'none',
                pointerEvents: 'none',
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '1px 2px',
                borderRadius: '2px',
              }}
            >
              {cmValue}
            </span>
          )}
        </div>
      );
    }
    
    return marks;
  };

  // Generate horizontal ruler marks for page width
  const generateHorizontalMarks = () => {
    const marks = [];
    // Create marks every 0.5cm for the page width
    const pageWidthCm = 21; // DIN A4 width in cm
    for (let i = 0; i <= pageWidthCm * 2; i++) {
      const cmValue = i * 0.5;
      const percentage = (cmValue / pageWidthCm) * 100;
      
      if (percentage > 100) break;
      
      const isFullCm = i % 2 === 0;
      const isFiveCm = cmValue % 5 === 0 && cmValue > 0;
      
      marks.push(
        <div
          key={i}
          className="ruler-mark"
          style={{
            position: 'absolute',
            left: `${percentage}%`,
            bottom: '5px',
            width: '1px',
            height: isFiveCm ? '15px' : isFullCm ? '10px' : '6px',
            backgroundColor: '#fff',
            transformOrigin: 'center bottom',
          }}
        >
          {isFiveCm && (
            <span 
              className="ruler-label"
              style={{
                position: 'absolute',
                left: '-8px',
                bottom: '18px',
                fontSize: '9px',
                fontWeight: '500',
                color: '#fff',
                userSelect: 'none',
                pointerEvents: 'none',
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '1px 2px',
                borderRadius: '2px',
              }}
            >
              {cmValue}
            </span>
          )}
        </div>
      );
    }
    return marks;
  };

  // Generate margin handles for THIS page only
  const generateMarginHandles = () => {
    const handles = [];
    
    // Header handle - positioned exactly on the BLUE dashed line
    handles.push(
      <div
        key="header-handle"
        className="margin-handle header-handle"
        style={{
          position: 'absolute',
          top: `${headerMargin}px`, // Exact position of blue dashed line
          left: '5px',
          width: '50px',
          height: '4px',
          backgroundColor: '#3b82f6',
          cursor: 'ns-resize',
          borderRadius: '2px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          transform: 'translateY(-2px)',
          zIndex: '10001',
        }}
        onMouseDown={(e) => handleMouseDown('header', e)}
        title={`Header margin: ${headerMargin}px (affects all pages)`}
      >
        <div style={{
          position: 'absolute',
          left: '55px',
          top: '-8px',
          fontSize: '10px',
          color: '#3b82f6',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '2px 4px',
          borderRadius: '2px',
        }}>
          Header: {headerMargin}px
        </div>
      </div>
    );
    
    // Footer handle - positioned exactly on the RED dashed line
    handles.push(
      <div
        key="footer-handle"
        className="margin-handle footer-handle"
        style={{
          position: 'absolute',
          top: `${pageHeight - footerMargin}px`, // Exact position of red dashed line
          left: '5px',
          width: '50px',
          height: '4px',
          backgroundColor: '#ef4444',
          cursor: 'ns-resize',
          borderRadius: '2px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          transform: 'translateY(-2px)',
          zIndex: '10001',
        }}
        onMouseDown={(e) => handleMouseDown('footer', e)}
        title={`Footer margin: ${footerMargin}px (affects all pages)`}
      >
        <div style={{
          position: 'absolute',
          left: '55px',
          top: '-8px',
          fontSize: '10px',
          color: '#ef4444',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '2px 4px',
          borderRadius: '2px',
        }}>
          Footer: {footerMargin}px
        </div>
      </div>
    );
    
    return handles;
  };

  // Handle mouse down on margin handle
  const handleMouseDown = useCallback((type: 'header' | 'footer', event: React.MouseEvent) => {
    event.preventDefault();
    setIsDragging(type);
    setDragStartY(event.clientY);
    setDragStartMargin(type === 'header' ? headerMargin : footerMargin);
  }, [headerMargin, footerMargin]);

  // Handle mouse move
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaY = event.clientY - dragStartY;
    
    if (isDragging === 'header') {
      // Header: normal behavior (drag down = increase margin)
      const newMargin = Math.max(10, Math.min(200, dragStartMargin + deltaY));
      if (onHeaderMarginChange) {
        onHeaderMarginChange(newMargin);
      }
    } else if (isDragging === 'footer') {
      // Footer: inverted behavior (drag up = increase margin, drag down = decrease margin)
      const newMargin = Math.max(10, Math.min(200, dragStartMargin - deltaY));
      if (onFooterMarginChange) {
        onFooterMarginChange(newMargin);
      }
    }
  }, [isDragging, dragStartY, dragStartMargin, onHeaderMarginChange, onFooterMarginChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Add global mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <>
      {/* Horizontal ruler (top) - only for first page */}
      {pageIndex === 0 && (
        <div 
          className={`ruler-horizontal ${className}`}
          style={{
            position: 'absolute',
            left: '0',
            top: '-40px',
            width: '100%',
            height: '30px',
            background: 'rgba(0, 0, 0, 0.1)',
            pointerEvents: 'none',
            zIndex: '10000',
            overflow: 'visible',
            borderRadius: '4px 4px 0 0',
          }}
        >
          <div 
            className="ruler-horizontal-content"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              background: 'transparent',
              margin: '0 auto',
            }}
          >
            {generateHorizontalMarks()}
          </div>
        </div>
      )}

      {/* Vertical ruler (left) - overlay on each page */}
      <div 
        className={`ruler-vertical-container ${className}`}
        style={{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '60px',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.1)',
          pointerEvents: showHandles ? 'auto' : 'none',
          zIndex: '10000',
          overflow: 'visible',
          borderRadius: '0 4px 4px 0',
        }}
      >
        <div 
          className="ruler-vertical"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: 'transparent',
            padding: '0 5px',
          }}
        >
          {generateVerticalMarks()}
          
          {/* Page number indicator */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '5px',
              fontSize: '10px',
              color: '#fff',
              fontWeight: '600',
              userSelect: 'none',
              pointerEvents: 'none',
              background: 'rgba(0, 0, 0, 0.5)',
              padding: '2px 4px',
              borderRadius: '2px',
            }}
          >
            P{pageIndex + 1}
          </div>
          
          {/* Margin handles for THIS page only */}
          {showHandles && generateMarginHandles()}
        </div>
      </div>
    </>
  );
}; 