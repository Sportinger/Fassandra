import React, { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';

interface PageBreakIndicatorProps {
  editor: Editor | null;
  pageNumber: number;
  position: number; // Position in pixels from top of editor
  isVisible: boolean;
  onMove: (pageNumber: number, newPosition: number) => void;
}

export const PageBreakIndicator: React.FC<PageBreakIndicatorProps> = ({
  editor,
  pageNumber,
  position,
  isVisible,
  onMove,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!indicatorRef.current) return;

      const editorElement = editor?.view.dom;
      if (!editorElement) return;

      const editorRect = editorElement.getBoundingClientRect();
      const newPosition = Math.max(0, e.clientY - editorRect.top - dragOffset);
      
      onMove(pageNumber, newPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, editor, pageNumber, onMove]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!indicatorRef.current) return;

    const rect = indicatorRef.current.getBoundingClientRect();
    setDragOffset(e.clientY - rect.top);
    setIsDragging(true);
    e.preventDefault();
  };

  if (!isVisible) return null;

  return (
    <div
      ref={indicatorRef}
      className="page-break-indicator"
      style={{
        position: 'absolute',
        top: `${position}px`,
        left: 0,
        right: 0,
        height: '2px',
        backgroundColor: isDragging ? '#007bff' : '#6c757d',
        borderRadius: '1px',
        cursor: 'ns-resize',
        zIndex: 10,
        opacity: isDragging ? 0.8 : 0.6,
        transition: isDragging ? 'none' : 'opacity 0.2s ease',
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className="page-break-label"
        style={{
          position: 'absolute',
          left: '8px',
          top: '-20px',
          fontSize: '12px',
          fontWeight: 'bold',
          color: isDragging ? '#007bff' : '#6c757d',
          backgroundColor: 'white',
          padding: '2px 6px',
          borderRadius: '3px',
          border: '1px solid',
          borderColor: isDragging ? '#007bff' : '#6c757d',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        Page {pageNumber}
      </div>
    </div>
  );
}; 