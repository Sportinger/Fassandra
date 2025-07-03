import React from 'react';
import { EditorContent } from '@tiptap/react';
import { ViewModeProps } from '../types';
import { Ruler } from '../Ruler';
import { isMobileDevice } from '../../../utils/mobile';
import styles from '../Editor.module.css';

export const SinglePageView: React.FC<ViewModeProps> = ({
  editor,
  isExiting,
  handlePageContextMenu,
  handleContextMenu,
  handleEditorClick,
  showRuler
}) => {
  const isMobile = isMobileDevice();
  
  return (
    <>
      {/* Ruler System - Hidden on mobile */}
      {!isMobile && <Ruler showRuler={showRuler} />}
      
    <div 
      className={`${styles.dinA4Page} ${isExiting ? styles.exiting : ''} ${isMobile ? 'mobile-page' : ''}`}
      onContextMenu={handlePageContextMenu}
      style={isMobile ? {
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        boxShadow: 'none',
        border: 'none',
        borderRadius: 0,
        maxWidth: '100vw',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        position: 'relative'
      } : {}}
    >
      {/* Editor Content */}
      <div 
        className={`${styles.editorContentWrapper} ${isMobile ? 'mobile-editor-content' : ''}`}
        onContextMenu={handleContextMenu}
        onClick={handleEditorClick}
        style={isMobile ? {
          width: '100vw',
          height: 'calc(100vh - 40px)',
          margin: 0,
          padding: '4px',
          overflow: 'auto',
          maxWidth: '100vw',
          overflowX: 'hidden',
          boxSizing: 'border-box',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          wordBreak: 'break-all'
        } : {}}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Page Footer - Mobile optimized */}
      <div className={`${styles.pageFooter} ${isMobile ? 'mobile-footer' : ''}`}>
        <button 
          className={`${styles.pageButton} ${isMobile ? 'mobile-print-button' : ''}`} 
          onClick={() => window.print()}
          style={isMobile ? {
            width: '100%',
            fontSize: '16px',
            padding: '12px',
            background: 'var(--color-accent, #3b82f6)',
            color: 'white',
            border: 'none',
            borderRadius: '8px'
          } : {}}
        >
          {isMobile ? '📄 Export' : 'Print / Export PDF'}
        </button>
      </div>
    </div>
    </>
  );
}; 