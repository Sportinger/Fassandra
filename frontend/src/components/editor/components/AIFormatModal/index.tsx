import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import styles from './AIFormatModal.module.css';
import { apiService } from '../../../../services/ApiService';

interface AIFormatModalProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  scriptId?: string;
  onLockChange?: (locked: boolean) => void;
}

type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error' | 'cancelled';

interface ChunkProgress {
  current: number;
  total: number;
  itemsParsed: number;
}

interface SSEEvent {
  type: 'started' | 'chunk_started' | 'chunk_complete' | 'complete' | 'error' | 'cancelled';
  total_chunks?: number;
  backup_id?: string;
  total_chars?: number;
  chunk?: number;
  total?: number;
  items_parsed?: number;
  total_items?: number;
  message?: string;
}

export const AIFormatModal: React.FC<AIFormatModalProps> = ({
  editor,
  isOpen,
  onClose,
  scriptId,
  onLockChange,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [chunkProgress, setChunkProgress] = useState<ChunkProgress | null>(null);
  const [backupId, setBackupId] = useState<string | null>(null);
  const [totalItemsParsed, setTotalItemsParsed] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

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

  // Cleanup event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setProcessingStatus('idle');
      setStatusMessage('');
      setErrorMessage('');
      setChunkProgress(null);
      setBackupId(null);
      setTotalItemsParsed(0);
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
    setStatusMessage('Connecting to server...');
    setErrorMessage('');
    setChunkProgress(null);
    setTotalItemsParsed(0);

    // Lock the document
    onLockChange?.(true);

    // Get the base URL and token
    const baseUrl = (window as any).__VITE_BACKEND_URL__ || import.meta.env.VITE_BACKEND_URL || '';
    const token = sessionStorage.getItem('jwt_token');

    // Create EventSource for SSE
    const url = `${baseUrl}/api/s/${scriptId}/ai-format-stream`;

    // Use fetch with EventSource-like behavior since EventSource doesn't support headers
    const fetchSSE = async () => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const event: SSEEvent = JSON.parse(data);
                handleSSEEvent(event);
              } catch (e) {
                console.error('Failed to parse SSE data:', data);
              }
            }
          }
        }
      } catch (error: any) {
        console.error('SSE error:', error);
        setProcessingStatus('error');
        setErrorMessage(error.message || 'Connection failed');
        onLockChange?.(false);
      }
    };

    fetchSSE();
  }, [scriptId, documentText, onLockChange]);

  const handleSSEEvent = (event: SSEEvent) => {
    switch (event.type) {
      case 'started':
        setBackupId(event.backup_id || null);
        setChunkProgress({
          current: 0,
          total: event.total_chunks || 1,
          itemsParsed: 0,
        });
        setStatusMessage(`Starting processing of ${(event.total_chars || 0).toLocaleString()} characters...`);
        break;

      case 'chunk_started':
        setChunkProgress(prev => ({
          current: event.chunk || 0,
          total: event.total || prev?.total || 1,
          itemsParsed: prev?.itemsParsed || 0,
        }));
        setStatusMessage(`Processing chunk ${event.chunk}/${event.total}...`);
        break;

      case 'chunk_complete':
        setChunkProgress(prev => ({
          current: event.chunk || 0,
          total: event.total || prev?.total || 1,
          itemsParsed: (prev?.itemsParsed || 0) + (event.items_parsed || 0),
        }));
        setTotalItemsParsed(prev => prev + (event.items_parsed || 0));
        setStatusMessage(`Chunk ${event.chunk}/${event.total} complete (${event.items_parsed} items)`);
        break;

      case 'complete':
        setProcessingStatus('success');
        setStatusMessage(`Formatting complete! ${event.total_items} items parsed.`);
        setBackupId(event.backup_id || null);
        onLockChange?.(false);
        // Reload after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        break;

      case 'error':
        setProcessingStatus('error');
        setErrorMessage(event.message || 'Unknown error occurred');
        onLockChange?.(false);
        break;

      case 'cancelled':
        setProcessingStatus('cancelled');
        setStatusMessage('Formatting cancelled. Document restored to original state.');
        onLockChange?.(false);
        break;
    }
  };

  const handleCancel = useCallback(async () => {
    if (!scriptId || !backupId) return;

    try {
      setStatusMessage('Cancelling...');
      await apiService.post(`/api/s/${scriptId}/ai-format-cancel`, { backup_id: backupId });
      setProcessingStatus('cancelled');
      setStatusMessage('Formatting cancelled. Document restored.');
      onLockChange?.(false);
    } catch (error: any) {
      console.error('Cancel error:', error);
      setErrorMessage('Failed to cancel: ' + (error.message || 'Unknown error'));
    }
  }, [scriptId, backupId, onLockChange]);

  const handleUndo = useCallback(async () => {
    if (!scriptId || !backupId) return;

    try {
      setStatusMessage('Restoring original document...');
      await apiService.post(`/api/s/${scriptId}/ai-format-undo`, { backup_id: backupId });
      setProcessingStatus('idle');
      setStatusMessage('Document restored to original state.');
      setBackupId(null);
      // Reload to show restored document
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('Undo error:', error);
      setErrorMessage('Failed to undo: ' + (error.message || 'Unknown error'));
    }
  }, [scriptId, backupId]);

  if (!isOpen) return null;

  const canStartFormat = processingStatus === 'idle' && scriptId && documentText.trim().length > 0;
  const canCancel = processingStatus === 'processing' && backupId;
  const canUndo = processingStatus === 'success' && backupId;

  // Calculate progress percentage
  const progressPercent = chunkProgress
    ? Math.round((chunkProgress.current / chunkProgress.total) * 100)
    : 0;

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
              {processingStatus === 'cancelled' && (
                <span className={`${styles.statusBadge} ${styles.cancelled}`}>Cancelled</span>
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
                {chunkProgress && (
                  <>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                      Chunk {chunkProgress.current}/{chunkProgress.total} | {chunkProgress.itemsParsed} items parsed
                    </p>
                  </>
                )}
              </div>
            )}

            {processingStatus === 'success' && (
              <div className={styles.placeholder} style={{ borderColor: '#22c55e' }}>
                <p style={{ color: '#22c55e' }}>{statusMessage}</p>
                {backupId && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888' }}>
                    You can undo this formatting to restore the original document.
                  </p>
                )}
              </div>
            )}

            {processingStatus === 'cancelled' && (
              <div className={styles.placeholder} style={{ borderColor: '#f59e0b' }}>
                <p style={{ color: '#f59e0b' }}>{statusMessage}</p>
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
          {canCancel && (
            <button
              className={styles.cancelButton}
              onClick={handleCancel}
            >
              Cancel Processing
            </button>
          )}
          {canUndo && (
            <button
              className={styles.undoButton}
              onClick={handleUndo}
            >
              Undo Formatting
            </button>
          )}
          <button
            className={styles.secondaryButton}
            onClick={handleClose}
            disabled={processingStatus === 'processing'}
          >
            {processingStatus === 'success' || processingStatus === 'cancelled' ? 'Done' : 'Close'}
          </button>
          {processingStatus === 'idle' && (
            <button
              className={styles.primaryButton}
              onClick={handleStartFormat}
              disabled={!canStartFormat}
            >
              Start AI Format
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
