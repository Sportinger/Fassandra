import React from 'react';
import { ScriptShareWithUser } from '../../../../types';
import styles from './ShareScriptModal.module.css';

interface ShareScriptModalProps {
  scriptTitle: string;
  isPublic: boolean;
  shares: ScriptShareWithUser[];
  shareUsername: string;
  sharePermission: 'read' | 'write';
  sharingLoading: boolean;
  error: string | null;
  isClosing: boolean;
  onClose: () => void;
  onTogglePublic: () => void;
  onAddShare: () => void;
  onRemoveShare: (shareId: string) => void;
  onUsernameChange: (username: string) => void;
  onPermissionChange: (permission: 'read' | 'write') => void;
}

export const ShareScriptModal: React.FC<ShareScriptModalProps> = ({
  scriptTitle,
  isPublic,
  shares,
  shareUsername,
  sharePermission,
  sharingLoading,
  error,
  isClosing,
  onClose,
  onTogglePublic,
  onAddShare,
  onRemoveShare,
  onUsernameChange,
  onPermissionChange,
}) => {
  return (
    <div 
      className={`${styles.modalOverlay} ${isClosing ? styles.exiting : ''}`} 
      onClick={onClose}
    >
      <div 
        className={`${styles.confirmModal} ${isClosing ? styles.exiting : ''}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3>Share "{scriptTitle}"</h3>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          
          <div className={styles.shareOption}>
            <span>Make script public:</span>
            <button 
              className={`${styles.publicToggle} ${isPublic ? styles.active : ''}`}
              onClick={onTogglePublic}
              disabled={sharingLoading}
            >
              {isPublic ? 'Public' : 'Private'}
            </button>
          </div>

          <div className={styles.shareSection}>
            <h4>Share with specific users:</h4>
            <div className={styles.addShareForm}>
              <input 
                type="text" 
                placeholder="Username..." 
                className={styles.shareInput}
                value={shareUsername}
                onChange={(e) => onUsernameChange(e.target.value)}
                disabled={sharingLoading}
              />
              <select 
                className={styles.permissionSelect}
                value={sharePermission}
                onChange={(e) => onPermissionChange(e.target.value as 'read' | 'write')}
                disabled={sharingLoading}
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
              </select>
              <button 
                className={styles.addButton}
                onClick={onAddShare}
                disabled={!shareUsername.trim() || sharingLoading}
              >
                Add
              </button>
            </div>

            {sharingLoading && <div className={styles.loadingText}>Loading...</div>}
            
            <div className={styles.sharesList}>
              {shares.map(share => (
                <div key={share.id} className={styles.shareItem}>
                  <span className={styles.shareUsername}>{share.username}</span>
                  <span className={styles.sharePermission}>{share.permission}</span>
                  <button 
                    className={styles.removeButton}
                    onClick={() => onRemoveShare(share.id)}
                    disabled={sharingLoading}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {shares.length === 0 && !sharingLoading && (
                <div className={styles.noShares}>No users have access to this script yet.</div>
              )}
            </div>
          </div>
        </div>
        <div className={styles.modalActions}>
          <button onClick={onClose} className={styles.cancelButton}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};