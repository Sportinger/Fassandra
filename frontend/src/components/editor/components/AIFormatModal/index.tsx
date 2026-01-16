import React, { useEffect, useState, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import styles from './AIFormatModal.module.css';

interface AIFormatModalProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AIFormatModal: React.FC<AIFormatModalProps> = ({
  editor,
  isOpen,
  onClose,
}) => {
  const [isClosing, setIsClosing] = useState(false);

  // Extract document text from the editor
  const documentText = useMemo(() => {
    if (!editor) return '';
    return editor.getText();
  }, [editor, isOpen]); // Re-compute when modal opens

  // Calculate stats
  const stats = useMemo(() => {
    const chars = documentText.length;
    const words = documentText.trim() ? documentText.trim().split(/\s+/).length : 0;
    const lines = documentText.split('\n').length;
    const paragraphs = documentText.split(/\n\s*\n/).filter(p => p.trim()).length;
    return { chars, words, lines, paragraphs };
  }, [documentText]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 250);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.modalOverlay} ${isClosing ? styles.exiting : ''}`}
      onClick={handleClose}
    >
      <div
        className={`${styles.modal} ${isClosing ? styles.exiting : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3>AI Format Debug</h3>
          <button className={styles.closeButton} onClick={handleClose}>
            &times;
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Document Text Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Document Text</span>
              <span className={`${styles.statusBadge} ${styles.ready}`}>Ready</span>
            </div>
            <div className={styles.textPreview}>
              {documentText || '(No text in document)'}
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <div className={styles.statValue}>{stats.chars.toLocaleString()}</div>
                <div className={styles.statLabel}>Characters</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{stats.words.toLocaleString()}</div>
                <div className={styles.statLabel}>Words</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{stats.lines.toLocaleString()}</div>
                <div className={styles.statLabel}>Lines</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{stats.paragraphs.toLocaleString()}</div>
                <div className={styles.statLabel}>Paragraphs</div>
              </div>
            </div>
          </div>

          {/* Processing Status Section (placeholder for future) */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Processing Status</span>
            </div>
            <div className={styles.placeholder}>
              <p>AI formatting not yet implemented</p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                This will show progress when Claude parses the document into scenes, dialogue, and stage directions.
              </p>
            </div>
          </div>

          {/* Claude Output Section (placeholder for future) */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Claude Output</span>
            </div>
            <div className={styles.placeholder}>
              <p>No output yet</p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                Parsed structure will appear here after processing.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.secondaryButton} onClick={handleClose}>
            Close
          </button>
          <button className={styles.primaryButton} disabled>
            Start AI Format
          </button>
        </div>
      </div>
    </div>
  );
};
