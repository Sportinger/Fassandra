import React, { useState, useEffect, useRef } from 'react';
import { Ruler } from '../Ruler';
import '../styles/responsive.css';

interface MultiPageViewProps {
  children: React.ReactNode;
  showRuler: boolean;
  className?: string;
}

export const MultiPageView: React.FC<MultiPageViewProps> = ({ 
  children, 
  showRuler,
  className = ''
}) => {
  const [pageCount, setPageCount] = useState(3);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHTML, setContentHTML] = useState('');
  
  // Page dimensions and adjustable margins
  const pageHeight = 600; // Total page height
  const [headerMargin, setHeaderMargin] = useState(40); // Adjustable top margin
  const [footerMargin, setFooterMargin] = useState(40); // Adjustable bottom margin
  const [usableContentHeight, setUsableContentHeight] = useState(pageHeight - 40 - 40); // Calculated dynamically
  
  // Update usable content height when margins change
  useEffect(() => {
    const newUsableHeight = pageHeight - headerMargin - footerMargin;
    setUsableContentHeight(newUsableHeight);
  }, [headerMargin, footerMargin, pageHeight]);
  
  // Extract HTML content from TipTap editor
  useEffect(() => {
    const extractContent = () => {
      if (contentRef.current) {
        const editorElement = contentRef.current.querySelector('.ProseMirror');
        if (editorElement) {
          const html = editorElement.innerHTML;
          setContentHTML(html);
          
          // Calculate pages based on usable content area
          const contentHeight = editorElement.scrollHeight;
          const neededPages = Math.max(1, Math.ceil(contentHeight / usableContentHeight));
          setPageCount(Math.min(neededPages, 8));
        }
      }
    };

    const timer = setTimeout(extractContent, 300);
    return () => clearTimeout(timer);
  }, [children, usableContentHeight]);
  
  // Handle margin changes from ruler
  const handleHeaderMarginChange = (newMargin: number) => {
    setHeaderMargin(newMargin);
  };
  
  const handleFooterMarginChange = (newMargin: number) => {
    setFooterMargin(newMargin);
  };
  
  // Generate pages array
  const pages = Array.from({ length: pageCount }, (_, index) => index);
  
  return (
    <div className={`multi-page-view ${className}`}>
      <div className="multiplePagesContainer" style={{ position: 'relative' }}>
        {pages.map((pageIndex) => (
          <div 
            key={pageIndex} 
            className="dinA4Page multiplePage"
            style={{
              height: 'var(--page-height)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* Individual ruler for this page */}
            {showRuler && (
              <Ruler 
                headerMargin={headerMargin}
                footerMargin={footerMargin}
                onHeaderMarginChange={handleHeaderMarginChange}
                onFooterMarginChange={handleFooterMarginChange}
                pageHeight={pageHeight}
                pageIndex={pageIndex}
                showHandles={true}
              />
            )}
            
            {/* Header margin area */}
            <div style={{
              height: `${headerMargin}px`,
              backgroundColor: 'transparent',
              borderBottom: showRuler ? '1px dashed rgba(59, 130, 246, 0.3)' : 'none',
            }} />
            
            {/* Content area */}
            <div style={{
              height: `${usableContentHeight}px`,
              overflow: 'hidden',
              position: 'relative'
            }}>
              {pageIndex === 0 ? (
                // First page: show actual TipTap editor (hidden reference for content extraction)
                <div>
                  <div ref={contentRef} style={{ opacity: 1 }}>
                    {children}
                  </div>
                </div>
              ) : (
                // Other pages: show the same content with different offsets
                <div style={{
                  transform: `translateY(-${pageIndex * usableContentHeight}px)`,
                  pointerEvents: 'none'
                }}>
                  <div 
                    className="ProseMirror"
                    dangerouslySetInnerHTML={{ __html: contentHTML }}
                    style={{
                      width: '100%',
                      outline: 'none',
                      fontSize: 'var(--font-size-base)',
                      lineHeight: 'var(--line-height-normal)',
                      fontFamily: 'inherit',
                      color: 'var(--color-text, #1f2937)'
                    }}
                  />
                </div>
              )}
            </div>
            
            {/* Footer margin area */}
            <div style={{
              height: `${footerMargin}px`,
              backgroundColor: 'transparent',
              borderTop: showRuler ? '1px dashed rgba(239, 68, 68, 0.3)' : 'none',
            }} />
            
            {/* Page number indicator */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '20px',
              fontSize: '12px',
              color: '#999',
              pointerEvents: 'none',
              backgroundColor: 'rgba(255,255,255,0.8)',
              padding: '2px 6px',
              borderRadius: '2px'
            }}>
              {pageIndex + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 