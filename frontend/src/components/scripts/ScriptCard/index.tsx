import React, { useState, useRef, useEffect } from 'react';
import { Script } from '../../../types';
import { ScriptCardMenu } from './ScriptCardMenu';
import { ScriptPreview } from './ScriptPreview';
import { useCssTiltWithAccelerometer } from '../../../hooks/useCssTiltWithAccelerometer';
import styles from './ScriptCard.module.css';

interface ScriptCardProps {
  script: Script;
  userId?: string;
  isDeleting: boolean;
  onSelect: (scriptId: string, scriptTitle: string) => void;
  onRename: (scriptId: string, newName: string) => void;
  onShare: (scriptId: string, scriptTitle: string, isPublic: boolean) => void;
  onDelete: (scriptId: string, scriptTitle: string) => void;
}

export const ScriptCard: React.FC<ScriptCardProps> = ({
  script,
  userId,
  isDeleting,
  onSelect,
  onRename,
  onShare,
  onDelete,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(script.title);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const tilt = useCssTiltWithAccelerometer({
    maxTilt: 10,
    sensitivity: 1.2,
    mobileMultiplier: 0.6,
    invert: true,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleClick = () => {
    if (!isRenaming && !isMenuOpen) {
      onSelect(script.id, script.title);
    }
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  };

  const handleStartRename = () => {
    setIsRenaming(true);
    setRenameValue(script.title);
    setIsMenuOpen(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (renameValue.trim() && renameValue !== script.title) {
      onRename(script.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setRenameValue(script.title);
  };

  const handleShare = () => {
    setIsMenuOpen(false);
    onShare(script.id, script.title, script.is_public);
  };

  const handleDelete = () => {
    setIsMenuOpen(false);
    onDelete(script.id, script.title);
  };

  return (
    <div className={styles.cardWrapper}>
      <div 
        ref={tilt.ref}
        className={`${styles.scriptPage} ${styles.tiltCard}`}
        onClick={handleClick}
        onMouseMove={tilt.onMouseMove}
        onMouseEnter={tilt.onMouseEnter}
        onMouseLeave={tilt.onMouseLeave}
        onTouchStart={tilt.onTouchStart}
      >
        
        <div className={styles.badgeContainer}>
          {script.is_public && <span className={styles.publicBadge}>Public</span>}
          {script.created_by !== userId && <span className={styles.sharedBadge}>Shared</span>}
        </div>
        
        <div className={styles.pageBody}>
          <ScriptPreview scriptId={script.id} />
        </div>

        <div className={styles.pageFooter}>
          {isRenaming ? (
            <form onSubmit={handleRenameSubmit} className={styles.renameForm}>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className={styles.renameInput}
                autoFocus
                onBlur={handleRenameCancel}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleRenameCancel();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </form>
          ) : (
            <h3 className={styles.pageTitle} title={script.title}>{script.title}</h3>
          )}
          <p className={styles.pageDate}>
            Created: {new Date(script.created_at).toLocaleDateString()}
          </p>
          
          <ScriptCardMenu
            ref={menuRef}
            isOpen={isMenuOpen}
            isDeleting={isDeleting}
            onToggle={handleMenuToggle}
            onRename={handleStartRename}
            onShare={handleShare}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
};
