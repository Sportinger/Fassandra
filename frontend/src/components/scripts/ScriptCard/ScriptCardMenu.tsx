import React, { forwardRef } from 'react';
import styles from './ScriptCard.module.css';

interface ScriptCardMenuProps {
  isOpen: boolean;
  isDeleting: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onRename: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export const ScriptCardMenu = forwardRef<HTMLDivElement, ScriptCardMenuProps>(
  ({ isOpen, isDeleting, onToggle, onRename, onShare, onDelete }, ref) => {
    return (
      <div className={styles.menuContainer} ref={ref}>
        <button 
          className={styles.burgerButton}
          onClick={onToggle}
          title="Script options"
        >
          <span className={styles.burgerIcon}>&#8942;</span>
        </button>
        {isOpen && (
          <div className={styles.dropdownMenu}>
            <button 
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                onRename();
              }}
            >
              <span>&#x270F;</span> Rename
            </button>
            <button 
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
            >
              <span>&#x1F517;</span> Share
            </button>
            <button 
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={isDeleting}
            >
              <span>&#x1F5D1;</span> Delete
            </button>
          </div>
        )}
      </div>
    );
  }
);