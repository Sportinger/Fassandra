import React from 'react';
import { EditorContent } from '@tiptap/react';
import { ViewModeProps } from '../types';
import { Ruler } from '../Ruler';
import styles from '../Editor.module.css';

export const SinglePageView: React.FC<ViewModeProps> = ({
  editor,
  isExiting,
  handlePageContextMenu,
  handleContextMenu,
  handleEditorClick,
  showRuler
}) => {
  return (
    <>
      {/* Ruler System */}
      <Ruler showRuler={showRuler} />
      
    <div 
      className={`${styles.dinA4Page} ${isExiting ? styles.exiting : ''}`}
      onContextMenu={handlePageContextMenu}
    >
      {/* Editor Content */}
      <div 
        className={styles.editorContentWrapper}
        onContextMenu={handleContextMenu}
        onClick={handleEditorClick}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Page Footer */}
      <div className={styles.pageFooter}>
        <button className={styles.pageButton} onClick={() => window.print()}>
          Print / Export PDF
        </button>
      </div>
    </div>
    </>
  );
}; 