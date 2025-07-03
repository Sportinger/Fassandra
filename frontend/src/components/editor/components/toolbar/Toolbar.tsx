/**
 * Toolbar Component
 * Floating toolbar with responsive behavior
 */

import React from 'react';
import type { ToolbarProps } from '../../types/index';

export const Toolbar: React.FC<ToolbarProps> = ({ 
  editor,
  context: _context,
  hasTextSelection,
  viewMode,
  showRuler,
  speakerNames,
  onSetViewMode,
  onToggleRuler,
  className = ''
}) => {
  // Don't render toolbar if editor is not ready
  if (!editor) {
    return null;
  }

  return (
    <div className={`floatingToolbar ${className}`}>
      <div className="toolbar-section">
        <button 
          onClick={() => onToggleRuler()}
          className={`toolbar-button ${showRuler ? 'active' : ''}`}
          title="Toggle Ruler"
        >
          📏
        </button>
        
        <button 
          onClick={() => onSetViewMode('single-page')}
          className={`toolbar-button ${viewMode === 'single-page' ? 'active' : ''}`}
          title="Single Page View"
        >
          📄
        </button>
        
        <button 
          onClick={() => onSetViewMode('multiple-pages')}
          className={`toolbar-button ${viewMode === 'multiple-pages' ? 'active' : ''}`}
          title="Multiple Pages View"
        >
          📜
        </button>
      </div>
      
      {hasTextSelection && (
        <div className="toolbar-section">
          <button 
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`toolbar-button ${editor.isActive('bold') ? 'active' : ''}`}
            title="Bold"
          >
            B
          </button>
          
          <button 
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`toolbar-button ${editor.isActive('italic') ? 'active' : ''}`}
            title="Italic"
          >
            I
          </button>
        </div>
      )}
      
      <div className="toolbar-section">
        <span className="toolbar-info">
          {speakerNames.size} speaker{speakerNames.size !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}; 