import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '../../../AuthContext';
import { 
  shareScript, 
  getScriptShares, 
  removeScriptShare, 
  toggleScriptPublic,
  createScriptFromParsed,
  ParsedScriptData 
} from '../../../api';
import { Script, ScriptShareWithUser, UploadStatus, PlaceholderScript } from '../../../types';
import { ClaudeSessionService } from '../../../services/ClaudeSessionService';
import { useUploadState } from '../../../hooks/useUploadState';
import UploadStateManager from '../../../services/UploadStateManager';
import { useScripts } from '../hooks/useScripts';
import { useScriptActions } from '../hooks/useScriptActions';
import { ShareScriptModal } from '../modals/ShareScriptModal';
import { DeleteConfirmModal } from '../modals/DeleteConfirmModal';
import { ScriptCard } from '../ScriptCard';
import { ScriptCreator } from '../ScriptCreator';
import { sessionManager } from '../services/SessionManager';
import { useCssTiltWithAccelerometer } from '../../../hooks/useCssTiltWithAccelerometer';
import logger from '../../../services/LoggingService';
import styles from './ScriptList.module.css';

interface ScriptListProps {
  onSelectScript: (scriptId: string, scriptTitle: string) => void;
  onUploadClick: () => void;
  onScriptClickStart?: (scriptTitle: string) => void;
  refreshTrigger?: number;
}

export interface ScriptListRef {
  addUploadPlaceholder: (placeholder: PlaceholderScript) => void;
}

export const ScriptList = forwardRef<ScriptListRef, ScriptListProps>(({ 
  onSelectScript, 
  onUploadClick, 
  onScriptClickStart, 
  refreshTrigger 
}, ref) => {
  // Auth
  const { token, user, tokenReady } = useAuth();
  
  // Core state
  const [error, setError] = useState<string | null>(null);
  
  // Custom hooks
  const { scripts, loading, setScripts, refreshScripts } = useScripts(token, tokenReady);
  const scriptActions = useScriptActions({ token, setScripts, setError });
  
  // Delete modal state
  const [deletingScriptId, setDeletingScriptId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{scriptId: string, scriptTitle: string} | null>(null);
  const [isDeleteModalClosing, setIsDeleteModalClosing] = useState(false);
  
  // Share modal state
  const [sharingScript, setSharingScript] = useState<{scriptId: string, scriptTitle: string, isPublic: boolean} | null>(null);
  const [isSharingModalClosing, setIsSharingModalClosing] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [sharePermission, setSharePermission] = useState<'read' | 'write'>('read');
  const [scriptShares, setScriptShares] = useState<ScriptShareWithUser[]>([]);
  const [sharingLoading, setSharingLoading] = useState(false);
  
  // Upload state
  const { uploads, addUpload, updateUpload, removeUpload, appendLog } = useUploadState();

  // Simple upload function - extracts text only, no Claude processing
  const performSimpleUpload = async (placeholder: PlaceholderScript) => {
    if (!token || !placeholder.fileData) {
      logger.error('ScriptList', 'Missing token or file data for upload');
      updateUpload(placeholder.id, {
        uploadStatus: 'error' as UploadStatus,
        uploadError: 'Missing authentication or file data'
      });
      setTimeout(() => removeUpload(placeholder.id), 3000);
      return;
    }

    try {
      updateUpload(placeholder.id, {
        uploadStatus: 'uploading' as UploadStatus,
        uploadProgress: 10,
        uploadSubStage: 'Uploading PDF...'
      });

      const formData = new FormData();
      formData.append('file', placeholder.fileData);

      const headers: Record<string, string> = {};
      if (token && token !== 'authenticated') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      updateUpload(placeholder.id, {
        uploadProgress: 30,
        uploadSubStage: 'Extracting text...'
      });

      const response = await fetch('/api/s/upload-pdf-simple', {
        method: 'POST',
        body: formData,
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status} ${text}`);
      }

      const result = await response.json() as { script_id: string; title: string; message: string };

      updateUpload(placeholder.id, {
        uploadStatus: 'completed' as UploadStatus,
        uploadProgress: 100,
        uploadSubStage: 'Script created successfully!'
      });

      logger.info('ScriptList', `Simple upload completed: ${result.title} (${result.script_id})`);

      // Refresh script list and remove placeholder after a short delay
      setTimeout(() => {
        refreshScripts();
        removeUpload(placeholder.id);
      }, 2000);

    } catch (error: any) {
      logger.error('ScriptList', 'Simple upload failed:', error);
      updateUpload(placeholder.id, {
        uploadStatus: 'error' as UploadStatus,
        uploadError: error.message || 'Upload failed',
        uploadSubStage: 'Upload failed'
      });
      setTimeout(() => removeUpload(placeholder.id), 5000);
    }
  };

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    addUploadPlaceholder: (placeholder: PlaceholderScript) => {
      logger.debug('ScriptList', '[ScriptList] Adding upload placeholder:', placeholder.title);
      addUpload(placeholder);
      // Use simple upload (text extraction only, no Claude)
      performSimpleUpload(placeholder);
    }
  }));

  // Resume monitoring active uploads after reload/navigation
  React.useEffect(() => {
    // Helper to attach to an in-flight Claude session using stored sessionId
    const attachToSession = async (placeholder: PlaceholderScript, sessionId: string) => {
      try {
        // Avoid double attaching
        if (sessionManager.hasSession(placeholder.id)) return;

        // Ensure we have a WS auth token
        let wsToken = token;
        if (!wsToken || wsToken === 'authenticated') {
          try {
            const wsTokResp = await fetch('/api/ws-token', { credentials: 'include' });
            if (wsTokResp.ok) {
              const data = await wsTokResp.json() as { token: string };
              wsToken = data.token;
            }
          } catch (e) {
            logger.warn('ScriptList', '[ResumeUpload] Failed to retrieve WS token from cookie endpoint:', e);
          }
        }
        if (!wsToken || wsToken === 'authenticated') {
          logger.warn('ScriptList', '[ResumeUpload] Missing auth token; will rely on polling only');
        }

        // Set minimal status to indicate ongoing processing
        updateUpload(placeholder.id, {
          uploadStatus: placeholder.uploadStatus || ('uploading' as UploadStatus),
          uploadSubStage: placeholder.uploadSubStage || 'Resuming processing...'
        });

        // Recreate session service and connect (for live progress); also start polling fallback
        const sessionService = new ClaudeSessionService(
          sessionId,
          wsToken || 'authenticated',
          (update) => {
            if (update.type === 'chunk_info' && update.total_pages && update.total_chunks) {
              updateUpload(placeholder.id, {
                uploadSubStage: update.message || `Script will be processed in ${update.total_chunks} chunks (${update.total_pages} pages)`
              });
            } else if (update.type === 'page_progress' && update.current_page && update.total_pages) {
              const pageProgress = (update.current_page / update.total_pages) * 60 + 20;
              updateUpload(placeholder.id, {
                uploadProgress: Math.round(pageProgress),
                uploadSubStage: update.message || `Processing page ${update.current_page} of ${update.total_pages}`
              });
            } else if (update.type === 'chunk_progress' && update.current_chunk && update.total_chunks) {
              const chunkProg = (update.current_chunk / update.total_chunks) * 60 + 20;
              updateUpload(placeholder.id, {
                uploadProgress: Math.round(chunkProg),
                uploadSubStage: update.message || `Processing chunk ${update.current_chunk} of ${update.total_chunks}`
              });
            }
            if (update.type === 'output' && update.line) {
              appendLog(placeholder.id, update.line);
            }
          },
          () => {
            updateUpload(placeholder.id, {
              uploadStatus: 'completed' as UploadStatus,
              uploadProgress: 100,
              uploadSubStage: 'Upload finished successfully'
            });
            setTimeout(() => {
              refreshScripts();
              removeUpload(placeholder.id);
              sessionManager.dispose(placeholder.id);
            }, 5000);
          },
          (errMsg) => {
            updateUpload(placeholder.id, {
              uploadStatus: 'error' as UploadStatus,
              uploadError: errMsg || 'Processing failed',
              uploadSubStage: 'Upload failed'
            });
            sessionManager.dispose(placeholder.id);
            removeUpload(placeholder.id);
          }
        );

        sessionManager.track(placeholder.id, sessionService);
        try { sessionService.connect(); } catch {}

        // Start polling fallback to keep UI updated if WS drops
        let pollTimer: any = null;
        const startPolling = () => {
          if (pollTimer) return;
          pollTimer = setInterval(async () => {
            try {
              const st = await ClaudeSessionService.getSessionStatus(sessionId, token || undefined);
              if (typeof st.progress === 'number') {
                const prog = Math.min(99, Math.max(20, Math.round(st.progress)));
                updateUpload(placeholder.id, { uploadProgress: prog });
              }
              if (st.status === 'Complete') {
                clearInterval(pollTimer); pollTimer = null;
                updateUpload(placeholder.id, {
                  uploadStatus: 'completed' as UploadStatus,
                  uploadProgress: 100,
                  uploadSubStage: 'Upload finished successfully'
                });
                setTimeout(() => {
                  refreshScripts();
                  removeUpload(placeholder.id);
                  sessionManager.dispose(placeholder.id);
                }, 3000);
              } else if (st.status === 'Failed') {
                clearInterval(pollTimer); pollTimer = null;
                updateUpload(placeholder.id, {
                  uploadStatus: 'error' as UploadStatus,
                  uploadError: st.error || 'Processing failed',
                  uploadSubStage: 'Upload failed'
                });
                sessionManager.dispose(placeholder.id);
                removeUpload(placeholder.id);
              }
            } catch {
              // ignore transient errors
            }
          }, 3000);
        };
        startPolling();
      } catch (e) {
        logger.error('ScriptList', '[ResumeUpload] Failed to attach to session:', e);
      }
    };

    // Iterate current uploads and resume any with a stored session id
    (async () => {
      for (const u of uploads) {
        // Only placeholders have uploadStatus; skip completed/errored
        if (!u.uploadStatus || u.uploadStatus === 'completed' || u.uploadStatus === 'error') continue;
        const sid = UploadStateManager.getSessionId(u.id);
        if (!sid) continue;
        await attachToSession(u as unknown as PlaceholderScript, sid);
      }
    })();
  }, [uploads, token]);

  // Refresh scripts on trigger change
  React.useEffect(() => {
    if (refreshTrigger && tokenReady && token) {
      refreshScripts();
    }
  }, [refreshTrigger, tokenReady, token, refreshScripts]);

  // Keep sessions alive across route changes; cleanup happens on window unload
  // via SessionManager, so we intentionally do not dispose on unmount here.

  // Script selection
  const handleScriptClick = (scriptId: string, scriptTitle: string) => {
    if (onScriptClickStart) {
      onScriptClickStart(scriptTitle);
    }
    // Navigate immediately without animation delay
    onSelectScript(scriptId, scriptTitle);
  };

  // Delete handling
  const handleDeleteScript = (scriptId: string, scriptTitle: string) => {
    setConfirmDelete({ scriptId, scriptTitle });
  };

  const confirmDeleteScript = async () => {
    if (!confirmDelete) return;
    
    const { scriptId } = confirmDelete;
    setDeletingScriptId(scriptId);
    
    setIsDeleteModalClosing(true);
    setTimeout(async () => {
      setConfirmDelete(null);
      setIsDeleteModalClosing(false);
      
      const success = await scriptActions.handleDeleteScript(scriptId);
      if (success) {
        removeUpload(scriptId);
      }
      setDeletingScriptId(null);
    }, 300);
  };

  const cancelDelete = () => {
    setIsDeleteModalClosing(true);
    setTimeout(() => {
      setConfirmDelete(null);
      setIsDeleteModalClosing(false);
    }, 300);
  };

  // Sharing functions
  const handleOpenSharingModal = async (scriptId: string, scriptTitle: string, isPublic: boolean) => {
    setSharingScript({ scriptId, scriptTitle, isPublic });
    setSharingLoading(true);
    setScriptShares([]);
    
    const shares = await scriptActions.fetchScriptShares(scriptId);
    setScriptShares(shares);
    setSharingLoading(false);
  };

  const handleCloseSharingModal = () => {
    setIsSharingModalClosing(true);
    setTimeout(() => {
      setSharingScript(null);
      setIsSharingModalClosing(false);
      setScriptShares([]);
      setShareUsername('');
      setSharePermission('read');
    }, 300);
  };

  const handleAddShare = async () => {
    if (!sharingScript || !shareUsername.trim()) return;
    
    setSharingLoading(true);
    const success = await scriptActions.handleShareScript(
      sharingScript.scriptId, 
      shareUsername.trim(), 
      sharePermission
    );
    
    if (success) {
      const shares = await scriptActions.fetchScriptShares(sharingScript.scriptId);
      setScriptShares(shares);
      setShareUsername('');
    }
    setSharingLoading(false);
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!sharingScript) return;
    
    setSharingLoading(true);
    const success = await scriptActions.handleRemoveShare(sharingScript.scriptId, shareId);
    if (success) {
      setScriptShares(prev => prev.filter(share => share.id !== shareId));
    }
    setSharingLoading(false);
  };

  const handleTogglePublic = async () => {
    if (!sharingScript) return;
    
    setSharingLoading(true);
    const success = await scriptActions.handleTogglePublic(sharingScript.scriptId);
    if (success) {
      setSharingScript(prev => prev ? { ...prev, isPublic: !prev.isPublic } : null);
    }
    setSharingLoading(false);
  };

  // Upload handling
  const performRealBackgroundUpload = async (placeholder: PlaceholderScript) => {
    if (!token || !placeholder.fileData) {
      logger.error('ScriptList', 'Missing token or file data for upload');
      return;
    }
    
    const updateUploadStatus = (updates: Partial<Script>) => {
      updateUpload(placeholder.id, updates);
    };

    try {
      logger.debug('ScriptList', '[ScriptList] Starting upload for:', placeholder.title);
      
      updateUploadStatus({ 
        uploadStatus: 'uploading' as UploadStatus, 
        uploadProgress: 5,
        uploadSubStage: 'Validating file...'
      });

      // Step 1: Upload PDF to backend to start Claude session
      const formData = new FormData();
      formData.append('file', placeholder.fileData);

      // For mobile (JWT token), include Authorization header; for web, rely on cookies
      const headers: Record<string, string> = {};
      if (token && token !== 'authenticated') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      updateUploadStatus({
        uploadProgress: 10,
        uploadSubStage: 'Uploading PDF...'
      });

      const uploadResp = await fetch('/api/s/upload-pdf', {
        method: 'POST',
        body: formData,
        headers,
        credentials: 'include'
      });
      if (!uploadResp.ok) {
        const txt = await uploadResp.text();
        throw new Error(`Upload failed: ${uploadResp.status} ${uploadResp.statusText} ${txt}`);
      }
      const { session_id } = await uploadResp.json() as { session_id: string };
      // Persist session id for potential reconnection
      UploadStateManager.setSessionId(placeholder.id, session_id);

      updateUploadStatus({
        uploadProgress: 20,
        uploadSubStage: 'Processing with Claude...'
      });

      // Step 2: Ensure we have a real JWT token for WebSocket auth
      let wsToken = token;
      if (!wsToken || wsToken === 'authenticated') {
        try {
          const wsTokResp = await fetch('/api/ws-token', { credentials: 'include' });
          if (wsTokResp.ok) {
            const data = await wsTokResp.json() as { token: string };
            wsToken = data.token;
          }
        } catch (e) {
          logger.warn('ScriptList', 'Failed to retrieve WS token from cookie endpoint:', e);
        }
      }

      if (!wsToken || wsToken === 'authenticated') {
        throw new Error('Unable to obtain authentication token for processing session');
      }

      // Step 3: Connect WebSocket to receive progress and completion
      const sessionService = new ClaudeSessionService(
        session_id,
        wsToken,
        (update) => {
          // Handle different types of updates
          if (update.type === 'chunk_info' && update.total_pages && update.total_chunks) {
            updateUploadStatus({
              uploadProgress: Math.max(12, placeholder.uploadProgress || 12),
              uploadSubStage: update.message || `Script will be processed in ${update.total_chunks} chunks (${update.total_pages} pages)`
            });
            if (update.message) {
              logger.info('Claude', update.message);
            }
          } else
          if (update.type === 'page_progress' && update.current_page && update.total_pages) {
            // Calculate progress based on page parsing (20-80% range)
            const pageProgress = (update.current_page / update.total_pages) * 60 + 20;
            updateUploadStatus({ 
              uploadProgress: Math.round(pageProgress),
              uploadSubStage: update.message || `Processing page ${update.current_page} of ${update.total_pages}`
            });
          } else if (update.type === 'chunk_progress' && update.current_chunk && update.total_chunks) {
            // Map chunk progress into the same 20-80% band
            const chunkProg = (update.current_chunk / update.total_chunks) * 60 + 20;
            const pages = (update.pages_start && update.pages_end) ? ` (pages ${update.pages_start}-${update.pages_end})` : '';
            updateUploadStatus({
              uploadProgress: Math.round(chunkProg),
              uploadSubStage: update.message || `Processing chunk ${update.current_chunk} of ${update.total_chunks}${pages}`
            });
          } else if (typeof update.progress === 'number') {
            // Regular progress updates
            const prog = Math.min(95, Math.max(20, Math.round(update.progress)));
            updateUploadStatus({ uploadProgress: prog });
          }

          // Stream raw Claude output into logs for visibility
          if (update.type === 'output' && update.line) {
            logger.info('Claude', update.line);
            appendLog(placeholder.id, update.line);
            // If the line looks like JSON (starts with '[' or '{'), treat it as a real incremental update
            const trimmed = update.line.trimStart();
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
              const current = UploadStateManager.getUpload(placeholder.id)?.uploadProgress ?? 20;
              const next = Math.min(95, current + 1); // advance by 1% per CLI event, cap before completion
              updateUploadStatus({ uploadProgress: next });
            }
            // Fallback parsing for Claude progress lines to surface in UI
            const line = update.line;
            try {
              if (line.includes('[PROGRESS] Starting chunked parsing')) {
                const m = line.match(/Total pages: (\d+), Chunks: (\d+)/);
                if (m) {
                  const total_pages = parseInt(m[1], 10);
                  const total_chunks = parseInt(m[2], 10);
                  updateUploadStatus({
                    uploadProgress: Math.max(12, placeholder.uploadProgress || 12),
                    uploadSubStage: `Script will be processed in ${total_chunks} chunks (${total_pages} pages)`
                  });
                }
              } else if (line.includes('[PROGRESS] Page') && line.includes('processed')) {
                const m = line.match(/Page\s+(\d+)\s+of\s+(\d+)\s+processed/);
                if (m) {
                  const current_page = parseInt(m[1], 10);
                  const total_pages = parseInt(m[2], 10);
                  const pageProgress = (current_page / total_pages) * 60 + 20;
                  updateUploadStatus({
                    uploadProgress: Math.round(pageProgress),
                    uploadSubStage: `Processing page ${current_page} of ${total_pages}`
                  });
                }
              } else if (line.includes('[CHUNK_COMPLETE]')) {
                const m = line.match(/Chunk\s+(\d+)\s+of\s+(\d+)/);
                if (m) {
                  const cur = parseInt(m[1], 10);
                  const total = parseInt(m[2], 10);
                  const chunkProg = (cur / total) * 60 + 20;
                  updateUploadStatus({
                    uploadProgress: Math.round(chunkProg),
                    uploadSubStage: `Processing chunk ${cur} of ${total}`
                  });
                }
              }
            } catch {}
          }
          
          if (update.status) {
            // Map status to user-friendly messages
            // Only set generic status if we don't already have a more specific message
            const cur = UploadStateManager.getUpload(placeholder.id);
            const hasSpecific = cur?.uploadSubStage && (
              cur.uploadSubStage.startsWith('Processing page') ||
              cur.uploadSubStage.startsWith('Processing chunk') ||
              cur.uploadSubStage.includes('will be processed')
            );
            if (!hasSpecific) {
              let statusMessage = update.status;
              if (update.status.includes('ParsingPdf')) {
                statusMessage = 'Parsing PDF content...';
              } else if (update.status.includes('CreatingJson')) {
                statusMessage = 'Creating structured data...';
              } else if (update.status.includes('InsertingData')) {
                statusMessage = 'Saving to database...';
              }
              updateUploadStatus({ uploadSubStage: statusMessage });
            }
          }
        },
        () => {
          // Completed: backend has created the script
          updateUploadStatus({
            uploadStatus: 'completed' as UploadStatus,
            uploadProgress: 100,
            uploadSubStage: 'Upload finished successfully'
          });
          // Keep completed upload box visible for 10s before removal
          setTimeout(() => {
            refreshScripts();
            removeUpload(placeholder.id);
            sessionManager.dispose(placeholder.id);
          }, 10000);
        },
        (errMsg) => {
          updateUploadStatus({
            uploadStatus: 'error' as UploadStatus,
            uploadError: errMsg || 'Processing failed',
            uploadSubStage: 'Upload failed'
          });
          sessionManager.dispose(placeholder.id);
          // Remove failed upload placeholder so the box vanishes
          removeUpload(placeholder.id);
        }
      );

      sessionManager.track(placeholder.id, sessionService);
      sessionService.connect();

      // Fallback polling in case WS events are blocked: poll session status
      // and update progress; mark complete when status reaches Complete.
      let pollTimer: any = null;
      const startPolling = () => {
        if (pollTimer) return;
        pollTimer = setInterval(async () => {
          try {
            const st = await ClaudeSessionService.getSessionStatus(session_id, token);
            if (typeof st.progress === 'number') {
              const prog = Math.min(99, Math.max(20, Math.round(st.progress)));
              updateUploadStatus({ uploadProgress: prog });
            }
            if (st.status === 'Complete') {
              clearInterval(pollTimer);
              pollTimer = null;
              updateUploadStatus({
                uploadStatus: 'completed' as UploadStatus,
                uploadProgress: 100,
                uploadSubStage: 'Upload finished successfully'
              });
              setTimeout(() => {
                refreshScripts();
                removeUpload(placeholder.id);
                sessionManager.dispose(placeholder.id);
              }, 3000);
            } else if (st.status === 'Failed') {
              clearInterval(pollTimer);
              pollTimer = null;
              updateUploadStatus({
                uploadStatus: 'error' as UploadStatus,
                uploadError: st.error || 'Processing failed',
                uploadSubStage: 'Upload failed'
              });
              sessionManager.dispose(placeholder.id);
              removeUpload(placeholder.id);
            }
          } catch {
            // Ignore transient errors
          }
        }, 3000);
      };
      startPolling();

    } catch (error: any) {
      logger.error('ScriptList', 'Upload failed:', error);
      updateUploadStatus({ 
        uploadStatus: 'error' as UploadStatus,
        uploadError: error.message || 'Upload failed',
        uploadSubStage: 'Upload failed'
      });
      sessionManager.dispose(placeholder.id); // Clean up session on error
      // Remove failed upload placeholder so the box vanishes
      removeUpload(placeholder.id);
    }
  };

  const handleCancelUploadFromCard = async (placeholderId: string) => {
    try {
      const sessionId = UploadStateManager.getSessionId(placeholderId);
      if (!sessionId) {
        logger.warn('ScriptList', '[CancelUpload] No session id for placeholder', placeholderId);
        removeUpload(placeholderId);
        return;
      }
      const svc = new ClaudeSessionService(sessionId, token || 'authenticated', () => {}, () => {}, () => {});
      await svc.cancelSession();
      sessionManager.dispose(placeholderId);
      removeUpload(placeholderId);
    } catch (e) {
      logger.error('ScriptList', '[CancelUpload] Failed to cancel:', e);
      // Remove anyway to avoid stale box
      sessionManager.dispose(placeholderId);
      removeUpload(placeholderId);
    }
  };

  const UploadPlaceholderCard: React.FC<{ placeholder: Script }> = ({ placeholder }) => {
    const tilt = useCssTiltWithAccelerometer({ maxTilt: 10, sensitivity: 1.2, mobileMultiplier: 0.6, invert: true });
    const [menuOpen, setMenuOpen] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
      const onDocClick = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      };
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }, []);
    return (
      <div key={placeholder.id} style={{ perspective: '1000px' }}>
        <div
          ref={tilt.ref}
          className={`${styles.uploadPlaceholder} ${styles.tiltCard}`}
          onMouseMove={tilt.onMouseMove}
          onMouseEnter={tilt.onMouseEnter}
          onMouseLeave={tilt.onMouseLeave}
          onTouchStart={tilt.onTouchStart}
        >
          {/* Menu button */}
          <button className={styles.uploadMenuButton} onClick={() => setMenuOpen(v => !v)} title="Options">⋮</button>
          {menuOpen && (
            <div ref={menuRef} className={styles.uploadDropdownMenu}>
              <button className={styles.uploadDropdownItem} onClick={() => handleCancelUploadFromCard(placeholder.id)}>Cancel upload</button>
            </div>
          )}
          <div className={styles.uploadTitle}>{placeholder.title}</div>
          <div className={styles.uploadProgress}>
            {placeholder.uploadStatus === 'uploading' && (
              <>
                <div className={styles.uploadStage}>{placeholder.uploadSubStage}</div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${placeholder.uploadProgress || 0}%` }}
                  />
                </div>
                <div className={styles.progressText}>{Math.round(placeholder.uploadProgress || 0)}%</div>
                {('lastOutput' in placeholder) && (placeholder as any).lastOutput && (
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(placeholder as any).lastOutput}
                  </div>
                )}
              </>
            )}
            {placeholder.uploadStatus === 'processing' && (
              <div className={styles.processingText}>Processing...</div>
            )}
            {placeholder.uploadStatus === 'completed' && (
              <div className={styles.processingText}>Upload finished successfully</div>
            )}
            {placeholder.uploadStatus === 'error' && (
              <div className={styles.errorText}>{placeholder.uploadError}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Combine scripts with upload placeholders
  // Include recently completed uploads; they will be removed after a short delay
  const uploadPlaceholders = uploads.filter(u => !!u.uploadStatus);
  const allScripts = [...scripts, ...uploadPlaceholders];

  if (loading) {
    return <div className={styles.loading}>Loading scripts...</div>;
  }

  return (
    <div>
      <div className={styles.scriptGrid}>
        {/* Regular scripts */}
        {allScripts.map(script => 
          script.uploadStatus ? (
            <UploadPlaceholderCard key={script.id} placeholder={script} />
          ) : (
            <ScriptCard
              key={script.id}
              script={script}
              userId={user?.id}
              isDeleting={deletingScriptId === script.id}
              onSelect={handleScriptClick}
              onRename={scriptActions.handleRenameScript}
              onShare={handleOpenSharingModal}
              onDelete={handleDeleteScript}
            />
          )
        )}
        
        {/* Add New Script Creator */}
        <ScriptCreator
          onCreate={async (name: string) => { await scriptActions.handleCreateScript(name); }}
          onUploadClick={onUploadClick}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <DeleteConfirmModal
          scriptTitle={confirmDelete.scriptTitle}
          isClosing={isDeleteModalClosing}
          onCancel={cancelDelete}
          onConfirm={confirmDeleteScript}
        />
      )}

      {/* Share Script Modal */}
      {sharingScript && (
        <ShareScriptModal
          scriptTitle={sharingScript.scriptTitle}
          isPublic={sharingScript.isPublic}
          shares={scriptShares}
          shareUsername={shareUsername}
          sharePermission={sharePermission}
          sharingLoading={sharingLoading}
          error={error}
          isClosing={isSharingModalClosing}
          onClose={handleCloseSharingModal}
          onTogglePublic={handleTogglePublic}
          onAddShare={handleAddShare}
          onRemoveShare={handleRemoveShare}
          onUsernameChange={setShareUsername}
          onPermissionChange={setSharePermission}
        />
      )}
    </div>
  );
});

export type { ScriptListProps };
