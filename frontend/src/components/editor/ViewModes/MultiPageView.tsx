import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageOffsets, setPageOffsets] = useState<number[]>([]);
  const [pageContents, setPageContents] = useState<string[]>([]);
  
  // Page dimensions and adjustable margins
  const [pageHeight, setPageHeight] = useState(600); // Dynamic page height
  const [headerMargin, setHeaderMargin] = useState(40); // Adjustable top margin
  const [footerMargin, setFooterMargin] = useState(40); // Adjustable bottom margin
  const [usableContentHeight, setUsableContentHeight] = useState(pageHeight - 40 - 40); // Calculated dynamically
  
  // Measure actual page height from DOM
  useEffect(() => {
    const measurePageHeight = () => {
      if (pageRef.current) {
        const rect = pageRef.current.getBoundingClientRect();
        const actualHeight = rect.height;
        if (actualHeight > 0 && actualHeight !== pageHeight) {
          console.log('📏 Measuring actual page height:', actualHeight, 'vs hardcoded:', pageHeight);
          setPageHeight(actualHeight);
        }
      }
    };

    // Initial measurement
    measurePageHeight();

    // Re-measure on window resize
    const handleResize = () => {
      setTimeout(measurePageHeight, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pageHeight]);

  // Update usable content height when margins change
  useEffect(() => {
    const newUsableHeight = pageHeight - headerMargin - footerMargin;
    setUsableContentHeight(newUsableHeight);
  }, [headerMargin, footerMargin, pageHeight]);
  
    // Calculate smart offsets with FOOTER-AWARENESS - no more cutting!
  const calculateSmartOffsets = useCallback((editorElement: HTMLElement, pageCount: number) => {
    const offsets = [0]; // First page always starts at 0
    
    // Cache block elements with height info for footer checking
    const blockElements = Array.from(editorElement.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, blockquote, li'))
      .map(el => ({
        element: el as HTMLElement,
        top: (el as HTMLElement).offsetTop,
        height: (el as HTMLElement).offsetHeight
      }))
      .sort((a, b) => a.top - b.top);
    
    let currentPageStart = 0;
    
    for (let pageIndex = 1; pageIndex < pageCount; pageIndex++) {
      const mathOffset = pageIndex * usableContentHeight;
      const currentPageFooterStart = currentPageStart + usableContentHeight;
      
      // Find all elements that are on the current page
      const elementsOnCurrentPage = blockElements.filter(el => 
        el.top >= currentPageStart && el.top < mathOffset
      );
      
      // Check if any element would be cut by the footer
      let nextPageStart = mathOffset;
      let elementsThatWouldBeCut = [];
      
      for (const element of elementsOnCurrentPage) {
        const elementEnd = element.top + element.height;
        
        // If element extends into footer area, it needs to be moved
        if (elementEnd > currentPageFooterStart) {
          elementsThatWouldBeCut.push(element);
        }
      }
      
      // If any elements would be cut, move the first one to next page
      if (elementsThatWouldBeCut.length > 0) {
        nextPageStart = elementsThatWouldBeCut[0].top;
        console.log(`📄 Page ${pageIndex + 1}: ${elementsThatWouldBeCut.length} elements would be cut, moving to next page`);
      } else {
        // No elements cut, use mathematical offset or find next element
        const nextElement = blockElements.find(el => el.top >= mathOffset - 10);
        if (nextElement) {
          nextPageStart = nextElement.top;
        }
      }
      
      offsets.push(nextPageStart);
      currentPageStart = nextPageStart;
      
      if (pageIndex <= 3) {
        console.log(`📄 Page ${pageIndex + 1}: ${mathOffset}px → ${nextPageStart}px (footer-cut prevention)`);
      }
    }
    
    return offsets;
  }, [usableContentHeight]);

  // Split content efficiently into page-specific segments with FOOTER-AWARENESS!
  const splitContentIntoPages = useCallback((editorElement: HTMLElement, offsets: number[]) => {
    const pageContents: string[] = [];
    
    // Get all block elements with their positions, heights, and HTML
    const blockElements = Array.from(editorElement.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, blockquote, li'))
      .map(el => ({
        element: el as HTMLElement,
        top: (el as HTMLElement).offsetTop,
        height: (el as HTMLElement).offsetHeight,
        html: el.outerHTML
      }))
      .sort((a, b) => a.top - b.top);
    
    for (let pageIndex = 0; pageIndex < offsets.length; pageIndex++) {
      const pageStart = offsets[pageIndex] || 0;
      const pageContentEnd = pageStart + usableContentHeight; // Account for footer!
      
      // Find elements that start on this page and check if they fit
      const pageElements = blockElements.filter(el => {
        const elementStart = el.top;
        const elementEnd = el.top + el.height;
        const pageEnd = offsets[pageIndex + 1] || Infinity;
        
        // Element must start within this page's bounds
        if (elementStart < pageStart || elementStart >= pageEnd) {
          return false;
        }
        
        // If element is too tall for any page, include it anyway to prevent disappearing  
        if (el.height > usableContentHeight) {
          console.warn(`📄 Large element (${el.height}px) exceeds page height (${usableContentHeight}px), including anyway`);
          return true;
        }
        
        // Element is on this page - it was already checked for footer cutting in offset calculation
        return true;
      });
      
      // Combine HTML of elements for this page only
      const pageHTML = pageElements.map(el => el.html).join('');
      pageContents.push(pageHTML);
      
      if (pageIndex < 3) { // Only log first few pages for performance
        console.log(`📄 Page ${pageIndex + 1}: ${pageElements.length} elements, ${pageHTML.length} chars (FOOTER-SAFE!)`);
      }
    }
    
    const totalChars = pageContents.reduce((sum, content) => sum + content.length, 0);
    const avgCharsPerPage = totalChars / pageContents.length;
    
    console.log(`🚀 EFFICIENCY: ${pageContents.length} pages, avg ${Math.round(avgCharsPerPage)} chars/page`);
    console.log(`📐 FOOTER-SAFE: usableContentHeight = ${usableContentHeight}px (header: ${headerMargin}px, footer: ${footerMargin}px)`);
    console.log(`✂️ FOOTER-AWARE: Elements are now moved to next page instead of being cut by footer`);
    
    return pageContents;
  }, [usableContentHeight, headerMargin, footerMargin]);

  // Memoized extract function for better performance
  const extractContent = useCallback(() => {
    if (contentRef.current) {
      const editorElement = contentRef.current.querySelector('.ProseMirror');
      if (editorElement) {
        // No need to store full HTML anymore - we split into page segments
        
        // Calculate pages based on usable content area
        const contentHeight = editorElement.scrollHeight;
        const neededPages = Math.max(1, Math.ceil(contentHeight / usableContentHeight));
        const finalPageCount = Math.min(neededPages, 8);
        setPageCount(finalPageCount);
        
        // Calculate smart offsets for each page using requestAnimationFrame for smooth updates
        requestAnimationFrame(() => {
          const smartOffsets = calculateSmartOffsets(editorElement as HTMLElement, finalPageCount);
          setPageOffsets(smartOffsets);
          
          // Split content into page-specific segments for maximum efficiency
          const pageSegments = splitContentIntoPages(editorElement as HTMLElement, smartOffsets);
          setPageContents(pageSegments);
        });
      }
    }
  }, [usableContentHeight, calculateSmartOffsets, splitContentIntoPages]);

  // Extract HTML content from TipTap editor
  useEffect(() => {
    const timer = setTimeout(extractContent, 50); // Noch schneller!
    return () => clearTimeout(timer);
  }, [children, extractContent, headerMargin, footerMargin]);
  
  // Handle margin changes from ruler - with optimized debouncing
  const handleHeaderMarginChange = useCallback((newMargin: number) => {
    setHeaderMargin(newMargin);
    // Trigger immediate recalculation for responsive feel
    requestAnimationFrame(extractContent);
  }, [extractContent]);
  
  const handleFooterMarginChange = useCallback((newMargin: number) => {
    setFooterMargin(newMargin);
    // Trigger immediate recalculation for responsive feel
    requestAnimationFrame(extractContent);
  }, [extractContent]);
  
  // Generate pages array
  const pages = Array.from({ length: pageCount }, (_, index) => index);
  
  return (
    <div className={`multi-page-view ${className}`}>
      <div className="multiplePagesContainer" style={{ position: 'relative' }}>
        {pages.map((pageIndex) => (
          <div 
            key={pageIndex} 
            ref={pageIndex === 0 ? pageRef : undefined}
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
                // Other pages: show ONLY the content specific to this page - MUCH MORE EFFICIENT!
                <div style={{
                  pointerEvents: 'none'
                }}>
                  <div 
                    className="ProseMirror"
                    dangerouslySetInnerHTML={{ __html: pageContents[pageIndex] || '' }}
                    style={{
                      width: '100%',
                      outline: 'none',
                      fontSize: 'var(--font-size-base)',
                      lineHeight: 'var(--line-height-normal)',
                      fontFamily: 'inherit',
                      color: 'var(--color-text, #1f2937)'
                    }}
                  />
                  
                  {/* Debug: Show page info - only in development */}
                  {process.env.NODE_ENV === 'development' && pageContents[pageIndex] && (
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      fontSize: '10px',
                      backgroundColor: 'rgba(255, 165, 0, 0.7)',
                      color: 'white',
                      padding: '2px 4px',
                      borderRadius: '2px',
                      pointerEvents: 'none',
                      zIndex: 1000
                    }}>
                      {pageContents[pageIndex].length} chars
                    </div>
                  )}
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