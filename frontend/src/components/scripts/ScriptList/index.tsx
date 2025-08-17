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
import { useScripts } from '../hooks/useScripts';
import { useScriptActions } from '../hooks/useScriptActions';
import { ShareScriptModal } from '../modals/ShareScriptModal';
import { DeleteConfirmModal } from '../modals/DeleteConfirmModal';
import { ScriptCard } from '../ScriptCard';
import { ScriptCreator } from '../ScriptCreator';
import { sessionManager } from '../services/SessionManager';
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
  const [isExiting, setIsExiting] = useState(false);
  
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
  const { uploads, addUpload, updateUpload, removeUpload } = useUploadState();

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    addUploadPlaceholder: (placeholder: PlaceholderScript) => {
      logger.debug('ScriptList', '[ScriptList] Adding upload placeholder:', placeholder.title);
      addUpload(placeholder);
      performRealBackgroundUpload(placeholder);
    }
  }));

  // Refresh scripts on trigger change
  React.useEffect(() => {
    if (refreshTrigger && tokenReady && token) {
      refreshScripts();
    }
  }, [refreshTrigger, tokenReady, token, refreshScripts]);

  // Clean up sessions on unmount
  React.useEffect(() => {
    return () => {
      sessionManager.disposeAll();
    };
  }, []);

  // Script selection
  const handleScriptClick = (scriptId: string, scriptTitle: string) => {
    if (onScriptClickStart) {
      onScriptClickStart(scriptTitle);
    }
    setIsExiting(true);
    setTimeout(() => {
      onSelectScript(scriptId, scriptTitle);
    }, 800);
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
          if (update.type === 'page_progress' && update.current_page && update.total_pages) {
            // Calculate progress based on page parsing (20-80% range)
            const pageProgress = (update.current_page / update.total_pages) * 60 + 20;
            updateUploadStatus({ 
              uploadProgress: Math.round(pageProgress),
              uploadSubStage: update.message || `Processing page ${update.current_page} of ${update.total_pages}`
            });
          } else if (typeof update.progress === 'number') {
            // Regular progress updates
            const prog = Math.min(95, Math.max(20, Math.round(update.progress)));
            updateUploadStatus({ uploadProgress: prog });
          }
          
          if (update.status) {
            // Map status to user-friendly messages
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
        },
        (scriptId) => {
          // Completed: backend has created the script
          updateUploadStatus({
            uploadStatus: 'completed' as UploadStatus,
            uploadProgress: 100,
            uploadSubStage: 'Upload complete!'
          });
          setTimeout(() => {
            refreshScripts();
            removeUpload(placeholder.id);
            sessionManager.dispose(placeholder.id);
          }, 1000);
        },
        (errMsg) => {
          updateUploadStatus({
            uploadStatus: 'error' as UploadStatus,
            uploadError: errMsg || 'Processing failed',
            uploadSubStage: 'Upload failed'
          });
          sessionManager.dispose(placeholder.id);
        }
      );

      sessionManager.track(placeholder.id, sessionService);
      sessionService.connect();

    } catch (error: any) {
      logger.error('ScriptList', 'Upload failed:', error);
      updateUploadStatus({ 
        uploadStatus: 'error' as UploadStatus,
        uploadError: error.message || 'Upload failed',
        uploadSubStage: 'Upload failed'
      });
      sessionManager.dispose(placeholder.id); // Clean up session on error
    }
  };

  const renderUploadPlaceholder = (placeholder: Script) => {
    return (
      <div key={placeholder.id} className={styles.uploadPlaceholder}>
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
            </>
          )}
          {placeholder.uploadStatus === 'processing' && (
            <div className={styles.processingText}>Processing...</div>
          )}
          {placeholder.uploadStatus === 'error' && (
            <div className={styles.errorText}>{placeholder.uploadError}</div>
          )}
        </div>
      </div>
    );
  };

  // Combine scripts with upload placeholders
  const uploadPlaceholders = uploads.filter(u => u.uploadStatus && u.uploadStatus !== 'completed');
  const allScripts = [...scripts, ...uploadPlaceholders];

  if (loading) {
    return <div className={styles.loading}>Loading scripts...</div>;
  }

  return (
    <div>
      <div className={`${styles.scriptGrid} ${isExiting ? styles.exiting : ''}`}>
        {/* Regular scripts */}
        {allScripts.map(script => 
          script.uploadStatus ? (
            renderUploadPlaceholder(script)
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