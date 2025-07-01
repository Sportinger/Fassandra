import React from 'react';
import styles from './Breadcrumb.module.css';

interface BreadcrumbProps {
  currentView: 'scripts' | 'editor';
  scriptTitle?: string;
  onNavigateToScripts?: () => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
  currentView, 
  scriptTitle, 
  onNavigateToScripts 
}) => {
  return (
    <nav className={styles.breadcrumb}>
      <span className={styles.segment}>PESSOA</span>
      <span className={styles.separator}>/</span>
      
      {currentView === 'scripts' ? (
        <span className={`${styles.segment} ${styles.current}`}>Scripts</span>
      ) : (
        <button 
          className={`${styles.segment} ${styles.clickable}`}
          onClick={onNavigateToScripts}
        >
          Scripts
        </button>
      )}
      
      {currentView === 'editor' && scriptTitle && (
        <>
          <span className={styles.separator}>/</span>
          <span className={`${styles.segment} ${styles.current}`}>
            {scriptTitle.split(' ').slice(0, 3).join(' ')}
          </span>
        </>
      )}
    </nav>
  );
}; 