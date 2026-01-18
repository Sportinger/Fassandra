import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import styles from './AIFormatModal.module.css';
import { apiService } from '../../../../services/ApiService';

interface AIFormatModalProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  scriptId?: string;
}

type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';

export const AIFormatModal: React.FC<AIFormatModalProps> = ({
  editor,
  isOpen,
  onClose,
  scriptId,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setProcessingStatus('idle');
      setStatusMessage('');
      setErrorMessage('');
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && processingStatus !== 'processing') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, processingStatus]);

  const handleClose = () => {
    if (processingStatus === 'processing') return; // Don't close while processing
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 250);
  };

  const handleStartFormat = useCallback(async () => {
    if (!scriptId) {
      setErrorMessage('Script ID not available');
      return;
    }

    if (documentText.trim().length === 0) {
      setErrorMessage('Document is empty, nothing to format');
      return;
    }

    setProcessingStatus('processing');
    setStatusMessage('Sending document to Claude for parsing...');
    setErrorMessage('');

    try {
      const response = await apiService.post<{ success: boolean; message: string; script_id: string }>(
        `/api/s/${scriptId}/ai-format`
      );

      if (response.success) {
        setProcessingStatus('success');
        setStatusMessage('Document formatted successfully! Refreshing...');

        // Reload the page to get the updated document
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error(response.message || 'Unknown error');
      }
    } catch (error: any) {
      setProcessingStatus('error');
      const message = error.body || error.message || 'Failed to format document';
      setErrorMessage(message);
      setStatusMessage('');
    }
  }, [scriptId, documentText]);

  if (!isOpen) return null;

  const canStartFormat = processingStatus === 'idle' && scriptId && documentText.trim().length > 0;

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
          <h3>AI Format</h3>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            disabled={processingStatus === 'processing'}
          >
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

          {/* Processing Status Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Processing Status</span>
              {processingStatus === 'processing' && (
                <span className={`${styles.statusBadge} ${styles.processing}`}>Processing</span>
              )}
              {processingStatus === 'success' && (
                <span className={`${styles.statusBadge} ${styles.ready}`}>Complete</span>
              )}
              {processingStatus === 'error' && (
                <span className={`${styles.statusBadge} ${styles.error}`}>Error</span>
              )}
            </div>

            {processingStatus === 'idle' && (
              <div className={styles.placeholder}>
                <p>Ready to format</p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  Click "Start AI Format" to parse the document into scenes, dialogue, and stage directions.
                </p>
              </div>
            )}

            {processingStatus === 'processing' && (
              <div className={styles.placeholder}>
                <p>{statusMessage}</p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  This may take a few minutes for longer documents...
                </p>
              </div>
            )}

            {processingStatus === 'success' && (
              <div className={styles.placeholder} style={{ borderColor: '#22c55e' }}>
                <p style={{ color: '#22c55e' }}>{statusMessage}</p>
              </div>
            )}

            {processingStatus === 'error' && (
              <div className={styles.placeholder} style={{ borderColor: '#ef4444' }}>
                <p style={{ color: '#ef4444' }}>{errorMessage}</p>
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalActions}>
          <button
            className={styles.secondaryButton}
            onClick={handleClose}
            disabled={processingStatus === 'processing'}
          >
            {processingStatus === 'success' ? 'Done' : 'Cancel'}
          </button>
          <button
            className={styles.primaryButton}
            onClick={handleStartFormat}
            disabled={!canStartFormat}
          >
            {processingStatus === 'processing' ? 'Processing...' : 'Start AI Format'}
          </button>
        </div>
      </div>
    </div>
  );
};
