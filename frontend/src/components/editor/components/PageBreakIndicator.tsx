import React, { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';

interface PageBreakIndicatorProps {
  editor: Editor | null;
  pageNumber: number;
  position: number; // Position in pixels from top of editor
  isVisible: boolean;
  onMove: (pageNumber: number, newPosition: number) => void;
  blockId?: string; // ID of the first block on this page
}

// 🔧 NEW: Helper function to find actual block positions in the editor
const findBlockPositions = (editor: Editor | null): Array<{
  blockId: string;
  pageNumber: number;
  top: number;
  bottom: number;
  element: HTMLElement;
}> => {
  if (!editor?.view?.dom) return [];

  const editorElement = editor.view.dom;
  const blocks: Array<{
    blockId: string;
    pageNumber: number;
    top: number;
    bottom: number;
    element: HTMLElement;
  }> = [];

  // Find all block elements with data attributes
  const blockElements = editorElement.querySelectorAll('[data-block-id], [data-page-number], p, div[data-type], h1, h2, h3');
  
  Array.from(blockElements).forEach((element, index) => {
    const htmlElement = element as HTMLElement;
    const rect = htmlElement.getBoundingClientRect();
    const editorRect = editorElement.getBoundingClientRect();
    
    // Get page number from data attribute or estimate based on position
    const pageNumberAttr = htmlElement.getAttribute('data-page-number');
    const blockIdAttr = htmlElement.getAttribute('data-block-id') || `block-${index}`;
    
    // Calculate relative position within editor
    const topRelative = rect.top - editorRect.top + editorElement.scrollTop;
    const bottomRelative = rect.bottom - editorRect.top + editorElement.scrollTop;
    
    blocks.push({
      blockId: blockIdAttr,
      pageNumber: pageNumberAttr ? parseInt(pageNumberAttr) : Math.floor(topRelative / 600) + 1,
      top: topRelative,
      bottom: bottomRelative,
      element: htmlElement
    });
  });

  return blocks.sort((a, b) => a.top - b.top);
};

// 🔧 NEW: Calculate optimal page break positions based on actual block data
const calculateOptimalPageBreakPosition = (
  pageNumber: number, 
  blocks: Array<{blockId: string; pageNumber: number; top: number; bottom: number; element: HTMLElement}>
): number => {
  // Find the last block of the previous page
  const previousPageBlocks = blocks.filter(b => b.pageNumber === pageNumber - 1);
  const currentPageBlocks = blocks.filter(b => b.pageNumber === pageNumber);
  
  if (previousPageBlocks.length === 0 || currentPageBlocks.length === 0) {
    // Fallback to mathematical positioning
    return (pageNumber - 1) * 600;
  }
  
  // Get the last block of previous page and first block of current page
  const lastPreviousBlock = previousPageBlocks[previousPageBlocks.length - 1];
  const firstCurrentBlock = currentPageBlocks[0];
  
  // Position the page break between these blocks
  const optimalPosition = (lastPreviousBlock.bottom + firstCurrentBlock.top) / 2;
  
  console.log(`📄 Page ${pageNumber} break positioned at ${optimalPosition}px (between blocks ${lastPreviousBlock.blockId} and ${firstCurrentBlock.blockId})`);
  return optimalPosition;
};

export const PageBreakIndicator: React.FC<PageBreakIndicatorProps> = ({
  editor,
  pageNumber,
  position,
  isVisible,
  onMove,
  blockId,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [optimalPosition, setOptimalPosition] = useState(position);
  const indicatorRef = useRef<HTMLDivElement>(null);

  // 🔧 NEW: Auto-calculate optimal position based on actual blocks
  useEffect(() => {
    if (!editor || !isVisible) return;

    const calculatePosition = () => {
      const blocks = findBlockPositions(editor);
      if (blocks.length > 0) {
        const newOptimalPosition = calculateOptimalPageBreakPosition(pageNumber, blocks);
        
        // Only update if position has changed significantly (avoid jitter)
        if (Math.abs(newOptimalPosition - optimalPosition) > 5) {
          setOptimalPosition(newOptimalPosition);
          
          // Notify parent of the new position
          if (onMove && Math.abs(newOptimalPosition - position) > 5) {
            onMove(pageNumber, newOptimalPosition);
          }
        }
      }
    };

    // Calculate immediately
    calculatePosition();

    // Recalculate when content changes
    const handleUpdate = () => {
      // Debounce to avoid excessive calculations
      setTimeout(calculatePosition, 100);
    };

    editor.on('update', handleUpdate);
    editor.on('transaction', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('transaction', handleUpdate);
    };
  }, [editor, pageNumber, isVisible, onMove, optimalPosition, position]);

  // 🔧 IMPROVED: Mouse drag handling with snap-to-block functionality
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!indicatorRef.current || !editor?.view?.dom) return;

      const editorElement = editor.view.dom;
      const editorRect = editorElement.getBoundingClientRect();
      let newPosition = Math.max(0, e.clientY - editorRect.top - dragOffset);
      
      // 🔧 NEW: Snap to nearby block boundaries
      const blocks = findBlockPositions(editor);
      const snapDistance = 20; // px
      
      for (const block of blocks) {
        if (Math.abs(newPosition - block.bottom) < snapDistance) {
          newPosition = block.bottom + 5; // 5px below block
          break;
        } else if (Math.abs(newPosition - block.top) < snapDistance) {
          newPosition = block.top - 5; // 5px above block
          break;
        }
      }
      
      onMove(pageNumber, newPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      console.log(`📄 Page ${pageNumber} break moved to ${optimalPosition}px`);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, editor, pageNumber, onMove, optimalPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!indicatorRef.current) return;

    const rect = indicatorRef.current.getBoundingClientRect();
    setDragOffset(e.clientY - rect.top);
    setIsDragging(true);
    e.preventDefault();
    
    console.log(`📄 Started dragging page ${pageNumber} break`);
  };

  if (!isVisible) return null;

  // Use optimal position if available, otherwise fall back to provided position
  const displayPosition = isDragging ? position : optimalPosition;

  return (
    <div
      ref={indicatorRef}
      className="page-break-indicator"
      style={{
        position: 'absolute',
        top: `${displayPosition}px`,
        left: 0,
        right: 0,
        height: '3px',
        background: isDragging 
          ? 'linear-gradient(90deg, #007bff, #0056b3)' 
          : 'linear-gradient(90deg, #6c757d, #495057)',
        borderRadius: '2px',
        cursor: 'ns-resize',
        zIndex: 10,
        opacity: isDragging ? 0.9 : 0.7,
        transition: isDragging ? 'none' : 'all 0.2s ease',
        boxShadow: isDragging ? '0 2px 8px rgba(0,123,255,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
      }}
      onMouseDown={handleMouseDown}
      title={`Page ${pageNumber} break${blockId ? ` (Block: ${blockId})` : ''}`}
    >
      {/* 🔧 IMPROVED: Better visual design for page break label */}
      <div
        className="page-break-label"
        style={{
          position: 'absolute',
          left: '12px',
          top: '-24px',
          fontSize: '11px',
          fontWeight: '600',
          color: isDragging ? '#007bff' : '#6c757d',
          backgroundColor: 'white',
          padding: '3px 8px',
          borderRadius: '4px',
          border: '1px solid',
          borderColor: isDragging ? '#007bff' : '#6c757d',
          pointerEvents: 'none',
          userSelect: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap',
        }}
      >
        Page {pageNumber}
        {blockId && (
          <div style={{
            fontSize: '9px',
            opacity: 0.7,
            marginTop: '1px'
          }}>
            {blockId.substring(0, 8)}...
          </div>
        )}
      </div>
      
      {/* 🔧 NEW: Drag handle for better UX */}
      <div
        style={{
          position: 'absolute',
          right: '8px',
          top: '-8px',
          width: '16px',
          height: '16px',
          backgroundColor: isDragging ? '#007bff' : '#6c757d',
          borderRadius: '50%',
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '8px',
          fontWeight: 'bold',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'all 0.2s ease',
        }}
        onMouseDown={handleMouseDown}
      >
        ⠿
      </div>
    </div>
  );
}; 