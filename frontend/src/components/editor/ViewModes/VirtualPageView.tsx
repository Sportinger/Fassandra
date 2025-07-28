import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Ruler } from '../Ruler';
import '../styles/responsive.css';

interface VirtualPageViewProps {
  children: React.ReactNode;
  showRuler: boolean;
  className?: string;
  onToggleRuler?: () => void;
  onToggleViewMode?: () => void;
}

interface PageBoundary {
  pageNumber: number;
  startY: number;
  endY: number;
  contentHeight: number;
}

// DIN A4 dimensions in mm converted to pixels (96 DPI)
const DIN_A4 = {
  widthMm: 210,
  heightMm: 297,
  widthPx: 793.7, // 210mm at 96 DPI
  heightPx: 1122.5, // 297mm at 96 DPI
};

export const VirtualPageView: React.FC<VirtualPageViewProps> = ({
  children,
  showRuler,
  className = '',
  onToggleRuler,
  onToggleViewMode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pageBoundaries, setPageBoundaries] = useState<PageBoundary[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [headerMargin, setHeaderMargin] = useState(40);
  const [footerMargin, setFooterMargin] = useState(40);
  
  // Calculate usable height per page
  const usablePageHeight = DIN_A4.heightPx - headerMargin - footerMargin;
  
  // Calculate page boundaries based on content height
  const calculatePageBoundaries = useCallback(() => {
    if (!contentRef.current) return;
    
    const editor = contentRef.current.querySelector('.ProseMirror');
    if (!editor) return;
    
    const totalHeight = editor.scrollHeight;
    const pageCount = Math.ceil(totalHeight / usablePageHeight);
    const boundaries: PageBoundary[] = [];
    
    for (let i = 0; i < pageCount; i++) {
      boundaries.push({
        pageNumber: i + 1,
        startY: i * DIN_A4.heightPx,
        endY: (i + 1) * DIN_A4.heightPx,
        contentHeight: Math.min(usablePageHeight, totalHeight - (i * usablePageHeight))
      });
    }
    
    setPageBoundaries(boundaries);
  }, [usablePageHeight]);
  
  // Update current page based on scroll position
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const scrollTop = containerRef.current.scrollTop;
    const viewportCenter = scrollTop + (containerRef.current.clientHeight / 2);
    
    // Find which page the viewport center is in
    const page = pageBoundaries.find(boundary => 
      viewportCenter >= boundary.startY && viewportCenter < boundary.endY
    );
    
    if (page) {
      setCurrentPage(page.pageNumber);
    }
  }, [pageBoundaries]);
  
  // Recalculate boundaries when content changes
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      calculatePageBoundaries();
    });
    
    if (contentRef.current) {
      observer.observe(contentRef.current);
    }
    
    return () => observer.disconnect();
  }, [calculatePageBoundaries]);
  
  // Initial calculation
  useEffect(() => {
    calculatePageBoundaries();
  }, [calculatePageBoundaries, children]);
  
  return (
    <div className={`virtual-page-view ${className}`}>
      <div 
        ref={containerRef}
        className="virtual-pages-container"
        onScroll={handleScroll}
        style={{
          position: 'relative',
          height: '100vh',
          overflowY: 'auto',
          backgroundColor: '#f5f5f5'
        }}
      >
        {/* Page background layers */}
        {pageBoundaries.map((boundary) => (
          <div
            key={boundary.pageNumber}
            className="virtual-page-background"
            style={{
              position: 'absolute',
              top: `${boundary.startY}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: `${DIN_A4.widthPx}px`,
              height: `${DIN_A4.heightPx}px`,
              backgroundColor: 'white',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              zIndex: 1
            }}
          >
            {/* Header margin indicator */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: `${headerMargin}px`,
              borderBottom: showRuler ? '1px dashed rgba(59, 130, 246, 0.3)' : 'none'
            }} />
            
            {/* Footer margin indicator */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: `${footerMargin}px`,
              borderTop: showRuler ? '1px dashed rgba(239, 68, 68, 0.3)' : 'none'
            }} />
            
            {/* Page number */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '20px',
              fontSize: '12px',
              color: boundary.pageNumber === currentPage ? '#3b82f6' : '#999',
              fontWeight: boundary.pageNumber === currentPage ? '600' : '400'
            }}>
              Page {boundary.pageNumber}
            </div>
            
            {/* Ruler for current page */}
            {showRuler && boundary.pageNumber === currentPage && (
              <Ruler
                headerMargin={headerMargin}
                footerMargin={footerMargin}
                onHeaderMarginChange={setHeaderMargin}
                onFooterMarginChange={setFooterMargin}
                pageHeight={DIN_A4.heightPx}
                pageIndex={boundary.pageNumber - 1}
                showHandles={true}
              />
            )}
          </div>
        ))}
        
        {/* Continuous content with proper positioning */}
        <div
          ref={contentRef}
          className="virtual-content-wrapper"
          style={{
            position: 'relative',
            width: `${DIN_A4.widthPx}px`,
            margin: '0 auto',
            paddingTop: `${headerMargin}px`,
            paddingBottom: `${footerMargin}px`,
            minHeight: `${DIN_A4.heightPx}px`,
            zIndex: 2
          }}
        >
          {children}
        </div>
        
        {/* Page break indicators */}
        {pageBoundaries.slice(0, -1).map((boundary, index) => (
          <div
            key={`break-${index}`}
            className="page-break-indicator"
            style={{
              position: 'absolute',
              top: `${boundary.endY}px`,
              left: 0,
              right: 0,
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 3
            }}
          >
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.2)',
              height: '1px',
              width: '100%',
              position: 'relative'
            }}>
              <span style={{
                position: 'absolute',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#f5f5f5',
                padding: '0 10px',
                fontSize: '11px',
                color: '#666'
              }}>
                Page Break
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Page navigation indicator */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '14px',
        zIndex: 1000
      }}>
        Page {currentPage} of {pageBoundaries.length}
      </div>
    </div>
  );
};