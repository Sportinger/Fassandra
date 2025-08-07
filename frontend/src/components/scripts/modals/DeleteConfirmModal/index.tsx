import React from 'react';
import styles from './DeleteConfirmModal.module.css';

interface DeleteConfirmModalProps {
  scriptTitle: string;
  isClosing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  scriptTitle,
  isClosing,
  onCancel,
  onConfirm,
}) => {
  return (
    <div 
      className={`${styles.modalOverlay} ${isClosing ? styles.exiting : ''}`} 
      onClick={onCancel}
    >
      <div 
        className={`${styles.confirmModal} ${isClosing ? styles.exiting : ''}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3>Delete Script</h3>
        </div>
        <div className={styles.modalBody}>
          <p>Are you sure you want to delete <strong>"{scriptTitle}"</strong>?</p>
          <p className={styles.warningText}>This action cannot be undone.</p>
        </div>
        <div className={styles.modalActions}>
          <button onClick={onCancel} className={styles.cancelButton}>
            Cancel
          </button>
          <button onClick={onConfirm} className={styles.deleteConfirmButton}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};