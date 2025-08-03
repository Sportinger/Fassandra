import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Ruler } from '../Ruler';
import '../styles/responsive.css';

interface MultiPageViewProps {
  children: React.ReactNode;
  showRuler: boolean;
  className?: string;
  onToggleRuler?: () => void;
  onToggleViewMode?: () => void;
  rehearsalMode?: boolean;
  rehearsalLinePosition?: number;
}

export const MultiPageView: React.FC<MultiPageViewProps> = ({ 
  children, 
  showRuler,
  className = '',
  onToggleRuler,
  onToggleViewMode,
  rehearsalMode = false,
  rehearsalLinePosition = 0
}) => {
  const [pageCount, setPageCount] = useState(3);
  const contentRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageOffsets, setPageOffsets] = useState<number[]>([]);
  const [pageContents, setPageContents] = useState<string[]>([]);
  const [activeEditPage, setActiveEditPage] = useState(0); // Which page has the active editor
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; visible: boolean}>({
    x: 0, y: 0, visible: false
  });
  
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

  // Handle clicking on a page to make it editable
  const handlePageClick = useCallback((pageIndex: number) => {
    console.log(`📝 Switching editor to page ${pageIndex + 1}`);
    setActiveEditPage(pageIndex);
  }, []);

  // Handle clicking on dark area around pages to show context menu
  const handleDarkAreaClick = useCallback((e: React.MouseEvent) => {
    // Only trigger if clicking on the background container, not on pages
    if (e.target === e.currentTarget) {
      console.log('🖱️ Dark area clicked, showing context menu');
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true
      });
    }
  }, []);

  // Handle context menu actions
  const handleContextMenuAction = useCallback((action: string) => {
    console.log('📋 Context menu action:', action);
    
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
  
  // Generate pages array
  const pages = Array.from({ length: pageCount }, (_, index) => index);
  
  return (
    <div className={`multi-page-view ${className}`} onClick={handleDarkAreaClick}>
      <div className="multiplePagesContainer" style={{ position: 'relative' }}>
        {pages.map((pageIndex) => (
          <div 
            key={pageIndex} 
            ref={pageIndex === 0 ? pageRef : undefined}
            className="dinA4Page multiplePage"
            style={{
              height: 'var(--page-height)',
              overflow: 'hidden',
              position: 'relative',
              cursor: pageIndex !== activeEditPage ? 'pointer' : 'text',
              border: pageIndex === activeEditPage ? '2px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
              transition: 'border-color 0.2s ease'
            }}
            onClick={() => handlePageClick(pageIndex)}
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
              {pageIndex === activeEditPage ? (
                // Active page: show actual TipTap editor with correct scroll offset
                <div>
                  <div 
                    ref={pageIndex === activeEditPage ? contentRef : undefined}
                    style={{ 
                      opacity: 1,
                      transform: pageOffsets[activeEditPage] ? `translateY(-${pageOffsets[activeEditPage]}px)` : 'translateY(0)',
                      transition: 'transform 0.3s ease'
                    }}
                  >
                    {children}
                  </div>
                </div>
              ) : (
                // Inactive pages: show static content (clickable to activate)
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
                      color: 'var(--color-text, #1f2937)',
                      opacity: 0.7
                    }}
                  />
                  
                  {/* Click to edit indicator */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(59, 130, 246, 0.9)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    pointerEvents: 'none',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                    zIndex: 1001
                  }}
                  className="click-to-edit-indicator"
                  >
                    Click to edit this page
                  </div>
                  
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
            
                      {/* Page number indicator with edit status */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '20px',
              fontSize: '12px',
              color: pageIndex === activeEditPage ? '#3b82f6' : '#999',
              pointerEvents: 'none',
              backgroundColor: pageIndex === activeEditPage ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.8)',
              padding: '2px 6px',
              borderRadius: '2px',
              fontWeight: pageIndex === activeEditPage ? '600' : '400',
              border: pageIndex === activeEditPage ? '1px solid rgba(59, 130, 246, 0.3)' : 'none'
            }}>
              {pageIndex + 1} {pageIndex === activeEditPage && '✏️'}
            </div>
                  </div>
        ))}
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
            📃 Switch to Single Page View
          </div>
        </div>
      )}
    </div>
  );
}; 