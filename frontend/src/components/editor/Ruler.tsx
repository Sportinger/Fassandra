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
  
  // Detect mobile for larger touch areas - responsive to window resize
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const isMobile = windowWidth <= 767;
  const touchAreaWidth = isMobile ? 90 : 70; // Mobile: 90px vs Desktop: 70px
  const touchAreaHeight = isMobile ? 32 : 24; // Mobile: 32px vs Desktop: 24px (8x larger than visual handle)
  
  // Update window width on resize
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Generate vertical ruler marks for THIS page only (0 to pageHeight)
  const generateVerticalMarks = () => {
    const marks = [];
    
    // Create marks every 0.5cm for the full page height
    const pageHeightCm = pageHeight / 28.35; // Convert pixels to cm
    const totalMarks = Math.ceil(pageHeightCm * 2); // 2 marks per cm (every 0.5cm)
    
    for (let i = 0; i <= totalMarks; i++) {
      const cmValue = i * 0.5;
      const percentage = (cmValue * 28.35 / pageHeight) * 100;
      
      if (percentage > 100) break;
      
      const isFullCm = i % 2 === 0;
      const isFiveCm = cmValue % 5 === 0 && cmValue > 0;
      
      marks.push(
        <div
          key={`mark-${i}`}
          className="ruler-mark"
          style={{
            position: 'absolute',
            top: `${percentage}%`,
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
    
    // Calculate percentage positions to align exactly with dashed lines
    const headerPercentage = (headerMargin / pageHeight) * 100;
    const footerPercentage = ((pageHeight - footerMargin) / pageHeight) * 100;
    
    // Debug logging for footer positioning
    if (pageIndex === 0) {
      console.log('🔧 Ruler calculations:', {
        pageHeight,
        headerMargin,
        footerMargin,
        headerPercentage,
        footerPercentage,
        footerPositionPx: pageHeight - footerMargin,
        isMobile,
        touchAreaWidth,
        touchAreaHeight,
        windowWidth
      });
    }
    
    // Header handle - positioned exactly on the BLUE dashed line
    handles.push(
      <div
        key="header-handle"
        className="margin-handle header-handle"
        style={{
          position: 'absolute',
          top: `${headerPercentage}%`, // Percentage-based position for exact alignment
          left: '0px',
          width: `${touchAreaWidth}px`, // Responsive touch area
          height: `${touchAreaHeight}px`, // Responsive touch area
          backgroundColor: 'transparent', // Invisible wrapper
          cursor: 'ns-resize',
          transform: `translateY(-${touchAreaHeight / 2}px)`, // Center the wrapper around the handle
          zIndex: '10001',
          // Better touch interaction
          touchAction: 'none',
          userSelect: 'none',
          // Debug: uncomment to see touch area
          // border: '1px dashed rgba(255,0,0,0.3)',
        }}
        onMouseDown={(e) => handleMouseDown('header', e)}
        onTouchStart={(e) => handleTouchStart('header', e)}
        title={`Header margin: ${headerMargin}px (affects all pages)`}
      >
        {/* Actual visual handle - small and clean */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '5px',
            width: '50px',
            height: '4px',
            backgroundColor: '#3b82f6',
            borderRadius: '2px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            transform: 'translateY(-50%)',
            transition: 'all 0.2s ease',
            pointerEvents: 'none', // Let parent handle interactions
          }}
          ref={(el) => {
            if (el) {
              // Store reference for hover effects
              el.parentElement!.addEventListener('mouseenter', () => {
                el.style.backgroundColor = '#2563eb';
                el.style.transform = 'translateY(-50%) scale(1.05)';
              });
              el.parentElement!.addEventListener('mouseleave', () => {
                el.style.backgroundColor = '#3b82f6';
                el.style.transform = 'translateY(-50%) scale(1)';
              });
            }
          }}
        />
        
        {/* Header label */}
        <div style={{
          position: 'absolute',
          left: `${touchAreaWidth + 5}px`, // Position after touch area
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: isMobile ? '12px' : '11px', // Slightly larger on mobile
          color: '#3b82f6',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '3px 6px',
          borderRadius: '4px',
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
          top: `${footerPercentage}%`, // Percentage-based position for exact alignment
          left: '0px',
          width: `${touchAreaWidth}px`, // Responsive touch area
          height: `${touchAreaHeight}px`, // Responsive touch area
          backgroundColor: 'transparent', // Invisible wrapper
          cursor: 'ns-resize',
          transform: `translateY(-${touchAreaHeight / 2}px)`, // Center the wrapper around the handle
          zIndex: '10001',
          // Better touch interaction
          touchAction: 'none',
          userSelect: 'none',
          // Debug: uncomment to see touch area
          // border: '1px dashed rgba(255,0,0,0.3)',
        }}
        onMouseDown={(e) => handleMouseDown('footer', e)}
        onTouchStart={(e) => handleTouchStart('footer', e)}
        title={`Footer margin: ${footerMargin}px (affects all pages)`}
      >
        {/* Actual visual handle - small and clean */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '5px',
            width: '50px',
            height: '4px',
            backgroundColor: '#ef4444',
            borderRadius: '2px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            transform: 'translateY(-50%)',
            transition: 'all 0.2s ease',
            pointerEvents: 'none', // Let parent handle interactions
          }}
          ref={(el) => {
            if (el) {
              // Store reference for hover effects
              el.parentElement!.addEventListener('mouseenter', () => {
                el.style.backgroundColor = '#dc2626';
                el.style.transform = 'translateY(-50%) scale(1.05)';
              });
              el.parentElement!.addEventListener('mouseleave', () => {
                el.style.backgroundColor = '#ef4444';
                el.style.transform = 'translateY(-50%) scale(1)';
              });
            }
          }}
        />
        
        {/* Footer label */}
        <div style={{
          position: 'absolute',
          left: `${touchAreaWidth + 5}px`, // Position after touch area
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: isMobile ? '12px' : '11px', // Slightly larger on mobile
          color: '#ef4444',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '3px 6px',
          borderRadius: '4px',
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

  // Handle touch start on margin handle
  const handleTouchStart = useCallback((type: 'header' | 'footer', event: React.TouchEvent) => {
    event.preventDefault();
    setIsDragging(type);
    setDragStartY(event.touches[0].clientY);
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

  // Handle touch move
  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!isDragging) return;
    
    event.preventDefault(); // Prevent scrolling
    const deltaY = event.touches[0].clientY - dragStartY;
    
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

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Add global mouse and touch event listeners
  React.useEffect(() => {
    if (isDragging) {
      // Mouse events
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // Touch events
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        // Remove mouse events
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Remove touch events
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

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