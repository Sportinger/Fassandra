import React from 'react';
import { EditorContent } from '@tiptap/react';
import { ViewModeProps } from '../types';
import { Ruler } from '../Ruler';
import styles from '../Editor.module.css';

export const MultiPageView: React.FC<ViewModeProps> = ({
  editor,
  isExiting,
  handlePageContextMenu,
  handleContextMenu,
  handleEditorClick,
  showRuler
}) => {
  if (!editor) return null;

  // For simplicity, we'll create multiple page containers
  // In a real implementation, you might want to split content more intelligently
  const pageCount = Math.max(1, Math.ceil((editor.getHTML().length) / 2000)); // Rough estimation
  
  return (
    <>
      {/* Ruler System */}
      <Ruler showRuler={showRuler} />
      
    <div 
      className={styles.multiplePagesContainer}
      onContextMenu={handlePageContextMenu}
    >
      {Array.from({ length: pageCount }, (_, index) => (
        <div 
          key={index} 
          className={`${styles.dinA4Page} ${styles.multiplePage} ${isExiting ? styles.exiting : ''}`}
          onContextMenu={handlePageContextMenu}
        >
          {/* Page Header */}
            <div className={styles.pageHeader}>
              <div className={styles.pageNumber}>Page {index + 1}</div>
            </div>

          {/* Page number indicator */}
          <div className={styles.pageNumber}>
            Page {index + 1} of {pageCount}
          </div>

          {/* Editor Content - only show on first page for now */}
          {index === 0 && (
            <div 
              className={styles.editorContentWrapper}
              onContextMenu={handleContextMenu}
              onClick={handleEditorClick}
            >
              <EditorContent editor={editor} />
            </div>
          )}

          {/* Page Footer - only on last page */}
          {index === pageCount - 1 && (
            <div className={styles.pageFooter}>
              <button className={styles.pageButton} onClick={() => window.print()}>
                Print / Export PDF
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
    </>
  );
}; 