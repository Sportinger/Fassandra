import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '../AuthContext';
import { getScripts, createScript, deleteScript, updateScript, shareScript, getScriptShares, removeScriptShare, toggleScriptPublic, generateAllThumbnails, createScriptFromParsed, ParsedScriptData } from '../api';
import { Script, ScriptShareWithUser, UploadStatus, PlaceholderScript } from '../types';
import { logDebugInfo } from '../utils/debug';
import { ClaudeSessionService } from '../services/ClaudeSessionService';
import { useUploadState } from '../hooks/useUploadState';
import UploadStateManager from '../services/UploadStateManager';
import styles from './ScriptList.module.css';

import logger from '../services/LoggingService';
/**
 * Props for the ScriptList component.
 * @property {(scriptId: string, scriptTitle: string) => void} onSelectScript - Callback when a script is selected.
 * @property {(scriptTitle: string) => void} onScriptClickStart - Callback when a script is clicked to start breadcrumb animation.
 * @property {number} refreshTrigger - Trigger to refresh the script list.
 */
interface ScriptListProps {
  onSelectScript: (scriptId: string, scriptTitle: string) => void;
  onUploadClick: () => void;
  onScriptClickStart?: (scriptTitle: string) => void;
  refreshTrigger?: number;
}

/**
 * Exposed methods for the ScriptList component.
 */
export interface ScriptListRef {
  addUploadPlaceholder: (placeholder: PlaceholderScript) => void; // Use extended type
}

/**
 * Script list and creation component.
 *
 * Displays a grid of scripts, allows creating new scripts via an "add" slot.
 *
 * @component
 * @param {ScriptListProps} props - Component props.
 */
export const ScriptList = forwardRef<ScriptListRef, ScriptListProps>(({ 
  onSelectScript, 
  onUploadClick, 
  onScriptClickStart, 
  refreshTrigger 
}, ref) => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newScriptName, setNewScriptName] = useState('');
  const [addSlotState, setAddSlotState] = useState<'plus' | 'options' | 'input'>('plus');
  const [deletingScriptId, setDeletingScriptId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{scriptId: string, scriptTitle: string} | null>(null);
  const [isDeleteModalClosing, setIsDeleteModalClosing] = useState(false);
  const [sharingScript, setSharingScript] = useState<{scriptId: string, scriptTitle: string, isPublic: boolean} | null>(null);
  const [isSharingModalClosing, setIsSharingModalClosing] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [sharePermission, setSharePermission] = useState<'read' | 'write'>('read');
  const [scriptShares, setScriptShares] = useState<ScriptShareWithUser[]>([]);
  const [sharingLoading, setSharingLoading] = useState(false);
  
  // 🚀 NEW: Background upload state - Now persistent across navigation!
  const { uploads, addUpload, updateUpload, removeUpload, setSessionId, getSessionId } = useUploadState();
  
  const { token, setToken, user, tokenReady } = useAuth();
  const addSlotRef = useRef<HTMLDivElement>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingScriptId, setRenamingScriptId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // 🚀 EXPOSE METHODS: Allow parent to add upload placeholders
  useImperativeHandle(ref, () => ({
    addUploadPlaceholder: (placeholder: PlaceholderScript) => {
      logger.debug('ScriptList', '[ScriptList] Adding upload placeholder:', placeholder.title);
      // Add to persistent state
      addUpload(placeholder);
      
      // Start the real upload process with file data
      performRealBackgroundUpload(placeholder);
    }
  }));

  // 🚀 REAL UPLOAD LOGIC: Implement actual API calls with detailed progress
  const performRealBackgroundUpload = async (placeholder: PlaceholderScript) => {
    if (!token || !placeholder.fileData) {
      logger.error('ScriptList', 'Error:', '[ScriptList] Missing token or file data for upload');
      return;
    }
    
    const updateUploadStatus = (updates: Partial<Script>) => {
      updateUpload(placeholder.id, updates);
    };

    try {
      logger.debug('ScriptList', '[ScriptList] 🚀 Starting REAL upload for:', placeholder.title);
      
      // Stage 1: File validation and preparation (5% progress)
      updateUploadStatus({ 
        uploadStatus: 'uploading' as UploadStatus, 
        uploadProgress: 5,
        uploadSubStage: 'Validating file format...'
      });
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX
      
      // Stage 2: Starting upload (10% progress)
      updateUploadStatus({ 
        uploadProgress: 10,
        uploadSubStage: `Uploading ${placeholder.fileData.name} (${(placeholder.fileData.size / 1024 / 1024).toFixed(1)} MB)...`
      });
      
      await new Promise(resolve => setTimeout(resolve, 800));

      // Stage 3: Upload in progress (20% progress)
      updateUploadStatus({ 
        uploadProgress: 20,
        uploadSubStage: 'Transferring PDF to server...'
      });

      const formData = new FormData();
      formData.append('file', placeholder.fileData); // PDF file for Claude Code processing

      // Use relative URL - proxy will handle routing to backend
      const uploadResponse = await fetch('/api/s/upload-pdf', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      // Stage 4: Upload complete, starting analysis (35% progress)
      updateUploadStatus({ 
        uploadStatus: 'analyzing' as UploadStatus, 
        uploadProgress: 35,
        uploadSubStage: 'PDF uploaded successfully. Starting AI analysis...'
      });

      await new Promise(resolve => setTimeout(resolve, 600));

      // Stage 5: PDF processing (45% progress)
      updateUploadStatus({ 
        uploadProgress: 45,
        uploadSubStage: 'Processing PDF document with Claude Code...'
      });

      await new Promise(resolve => setTimeout(resolve, 700));

      // Stage 6: Content analysis (55% progress)
      updateUploadStatus({ 
        uploadProgress: 55,
        uploadSubStage: 'Analyzing script structure with page numbers...'
      });

      await new Promise(resolve => setTimeout(resolve, 900));

      // Stage 7: Speaker detection (65% progress)
      updateUploadStatus({ 
        uploadProgress: 65,
        uploadSubStage: 'Extracting dialogue, speakers, and stage directions...'
      });

      // Check if upload was successful first
      if (!uploadResponse.ok) {
        let errorMessage = `Upload failed: HTTP ${uploadResponse.status}`;
        try {
          const errorData = await uploadResponse.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Ignore JSON parse errors for error response
        }
        throw new Error(errorMessage);
      }

      // Parse the response which now contains session_id
      let responseData: { session_id: string; message: string };
      try {
        responseData = await uploadResponse.json();
        logger.debug('ScriptList', '[ScriptList] Upload response:', responseData);
      } catch (parseError: any) {
        logger.error('ScriptList', '[ScriptList] Failed to parse JSON response:', parseError);
        logger.error('ScriptList', '[ScriptList] Response status:', uploadResponse.status);
        logger.error('ScriptList', '[ScriptList] Response headers:', uploadResponse.headers);
        throw new Error(`Upload failed: Could not parse server response`);
      }

      if (!responseData || !responseData.session_id) {
        logger.error('ScriptList', '[ScriptList] Response missing session_id:', responseData);
        throw new Error('Upload started, but no session ID returned');
      }

      logger.debug('ScriptList', '[ScriptList] Claude Code session started:', responseData.session_id);
      
      // Monitor the session via WebSocket
      updateUploadStatus({ 
        uploadProgress: 70,
        uploadSubStage: 'Claude Code is processing your PDF...'
      });

      // Store session ID for persistence
      setSessionId(placeholder.id, responseData.session_id);
      
      // Create WebSocket connection to monitor session
      const sessionService = new ClaudeSessionService(
        responseData.session_id,
        token,
        (update) => {
          // Handle session updates
          if (update.type === 'status' && update.progress !== undefined) {
            updateUploadStatus({ 
              uploadProgress: Math.max(70, Math.min(90, update.progress)),
              uploadSubStage: `Processing: ${update.status || 'Working...'}`
            });
          } else if (update.type === 'output' && update.line) {
            // Show Claude output in substage
            logger.debug('ScriptList', '[Claude Output]', update.line);
            // Show relevant Claude status messages
            if (update.line.includes('Reading PDF') || update.line.includes('Parsing')) {
              updateUploadStatus({ 
                uploadSubStage: 'Claude Code: Reading and parsing PDF...'
              });
            } else if (update.line.includes('Creating JSON') || update.line.includes('Extracting')) {
              updateUploadStatus({ 
                uploadSubStage: 'Claude Code: Extracting script structure...'
              });
            } else if (update.line.includes('json_to_db') || update.line.includes('database')) {
              updateUploadStatus({ 
                uploadSubStage: 'Claude Code: Inserting into database...'
              });
            }
          }
        },
        async (scriptId) => {
          // Handle completion
          logger.debug('ScriptList', '[ScriptList] Claude Code completed with script ID:', scriptId);
          
          updateUploadStatus({ 
            uploadStatus: 'creating' as UploadStatus,
            uploadProgress: 95,
            uploadSubStage: 'Script created successfully! Finalizing...'
          });

          // Fetch the newly created script details
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const newScript: Script = {
            id: scriptId,
            title: placeholder.title,
            created_by: user?.id || null,
            created_at: new Date().toISOString(),
            is_public: false,
            thumbnail: null,
            isPlaceholder: false,
            uploadStatus: 'completed' as UploadStatus,
            uploadProgress: 100,
            uploadSubStage: 'Script created successfully! Click to open.'
          };
          
          // Remove from uploading and add to main scripts
          removeUpload(placeholder.id);
          
          // Refresh scripts list to get the new script
          await fetchScripts();
          
          logger.debug('ScriptList', '[ScriptList] ✅ Real upload completed successfully');
        },
        (error) => {
          // Handle error
          throw new Error(error);
        }
      );

      // Connect to WebSocket
      sessionService.connect();
      
      // Store session service for potential cancellation
      (placeholder as any).sessionService = sessionService;
      
    } catch (error: any) {
      logger.error('ScriptList', '[ScriptList] ❌ Real upload failed:', error);
      updateUploadStatus({ 
        uploadStatus: 'failed' as UploadStatus, 
        uploadError: error.message || 'Upload failed',
        uploadProgress: 0,
        uploadSubStage: 'Upload failed. Click retry to try again.'
      });
    }
  };

  // 🚀 NEW: Handle retry for failed uploads
  const handleRetryUpload = (placeholderId: string) => {
    const placeholder = uploads.find(u => u.id === placeholderId);
    if (placeholder) {
      const resetPlaceholder = {
        ...placeholder,
        uploadStatus: 'uploading' as UploadStatus,
        uploadProgress: 0,
        uploadError: null
      };
      updateUpload(placeholderId, resetPlaceholder);
      performRealBackgroundUpload(resetPlaceholder);
    }
  };

  // 🚀 NEW: Handle cancel upload
  const handleCancelUpload = async (placeholderId: string) => {
    const placeholder = uploads.find(u => u.id === placeholderId);
    if (placeholder && 'sessionService' in placeholder && placeholder.sessionService) {
      try {
        // Cancel the Claude Code session
        await placeholder.sessionService.cancelSession();
        placeholder.sessionService.disconnect();
      } catch (error) {
        logger.error('ScriptList', '[ScriptList] Failed to cancel session:', error);
      }
    }
    
    removeUpload(placeholderId);
  };

  // 🚀 NEW: Render upload placeholder
  const renderUploadPlaceholder = (placeholder: Script) => {
    const getStatusText = () => {
      if (placeholder.uploadSubStage) {
        return placeholder.uploadSubStage;
      }
      // Fallback to basic status text
      switch (placeholder.uploadStatus) {
        case 'uploading': return 'Uploading file...';
        case 'analyzing': return 'Analyzing content...';
        case 'creating': return 'Creating script...';
        case 'failed': return 'Upload Failed';
        default: return 'Processing...';
      }
    };

    const getMainStatusText = () => {
      // Show Claude indicator when processing
      if (placeholder.uploadStatus === 'processing' || 
          (placeholder.uploadSubStage && placeholder.uploadSubStage.includes('Claude Code'))) {
        return '🤖 Claude Processing';
      }
      
      switch (placeholder.uploadStatus) {
        case 'uploading': return 'Uploading';
        case 'analyzing': return 'Analyzing';
        case 'creating': return 'Creating';
        case 'completed': return 'Completed';
        case 'failed': return 'Failed';
        default: return 'Processing';
      }
    };

    const getProgressColor = () => {
      switch (placeholder.uploadStatus) {
        case 'failed': return '#ef4444';
        case 'completed': return '#10b981';
        case 'uploading': return '#3b82f6';
        case 'analyzing': return '#8b5cf6';
        case 'creating': return '#10b981';
        default: return '#6b7280';
      }
    };

    const isClickable = placeholder.uploadStatus === 'completed';

    return (
      <div 
        key={placeholder.id} 
        className={`${styles.scriptPage} ${styles.uploadPlaceholder} ${!isClickable ? styles.nonClickable : ''}`}
        data-status={placeholder.uploadStatus} // 🎨 Add data attribute for CSS styling
        onClick={isClickable ? () => handleScriptClick(placeholder.id, placeholder.title, placeholder.isPlaceholder, placeholder.uploadStatus) : undefined}
        style={{ cursor: isClickable ? 'pointer' : 'not-allowed' }}
      >
        <div className={styles.uploadContent}>
          <div 
            className={styles.uploadIcon}
            data-status={placeholder.uploadStatus} // 🎨 Add data attribute for icon styling
          >
            {placeholder.uploadStatus === 'failed' ? '❌' : 
             placeholder.uploadStatus === 'completed' ? '✅ ' : '📄'}
          </div>
          
          <div className={styles.uploadTitle}>{placeholder.title}</div>
          
          {/* 🎯 MAIN STATUS BAR */}
          <div className={styles.uploadMainStatus}>
            {getMainStatusText()} {placeholder.uploadProgress ? `${placeholder.uploadProgress}%` : ''}
          </div>
          
          {/* 🎯 DETAILED SUB-STAGE */}
          <div className={styles.uploadSubStage}>{getStatusText()}</div>
          
          {placeholder.uploadStatus !== 'failed' && placeholder.uploadStatus !== 'completed' && (
            <div className={styles.progressContainer}>
              <div 
                className={styles.progressBar}
                data-status={placeholder.uploadStatus} // 🎨 Add data attribute for progress bar styling
                style={{ 
                  width: `${placeholder.uploadProgress || 0}%`,
                  backgroundColor: getProgressColor()
                }}
              />
              <div className={styles.progressText}>
                {placeholder.uploadProgress || 0}%
              </div>
            </div>
          )}
          
          {placeholder.uploadError && (
            <div className={styles.uploadError}>{placeholder.uploadError}</div>
          )}
          
          {placeholder.uploadStatus === 'failed' && (
            <div className={styles.uploadActions}>
              <button 
                className={styles.retryButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetryUpload(placeholder.id);
                }}
              >
                Retry
              </button>
              <button 
                className={styles.cancelButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelUpload(placeholder.id);
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {placeholder.uploadStatus === 'completed' && (
            <div className={styles.completedIndicator}>
              Click to open script
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleUploadOptionClick = () => {
    // Pass the background upload handler to the uploader
    onUploadClick();
    setAddSlotState('plus');
  };

  const toggleMenu = (scriptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === scriptId ? null : scriptId);
  };

  const startRename = (scriptId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    setRenamingScriptId(scriptId);
    setRenameValue(currentTitle);
  };

  const cancelRename = () => {
    setRenamingScriptId(null);
    setRenameValue('');
  };

  const handleRename = async (scriptId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !renameValue.trim()) return;
    
    setError(null);
    try {
      const updatedScript = await updateScript(scriptId, renameValue.trim());
      // Update the script in local state
      setScripts(prev => prev.map(script => 
        script.id === scriptId ? { ...updatedScript } : script
      ));
      setRenamingScriptId(null);
      setRenameValue('');
    } catch (err: any) {
      setError(err.message || 'Failed to rename script');
      logger.error('ScriptList', 'Error:', err);
    }
  };

  // Effect to handle clicks outside the add slot and menus to close them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close add slot if clicked outside
      if (addSlotRef.current && !addSlotRef.current.contains(event.target as Node)) {
        setAddSlotState('plus');
      }
      
      // Close burger menu if clicked outside
      if (openMenuId) {
        const menuElement = document.querySelector(`[data-menu-id="${openMenuId}"]`);
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    if (addSlotState !== 'plus' || openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [addSlotState, openMenuId]);

  const fetchScripts = async () => {
    if (!token) {
      logDebugInfo('ScriptList', 'No token available for fetchScripts');
      return;
    }
    
    logDebugInfo('ScriptList', 'Starting to fetch scripts');
    setLoading(true);
    setError(null);
    
    try {
      const fetchedScripts = await getScripts();
      logDebugInfo('ScriptList', `Fetched ${fetchedScripts.length} scripts`);
      setScripts(fetchedScripts);
      
      // Generate thumbnails for scripts that don't have them
      const scriptsWithoutThumbnails = fetchedScripts.filter(script => !script.thumbnail);
      if (scriptsWithoutThumbnails.length > 0) {
        logDebugInfo('ScriptList', `Found ${scriptsWithoutThumbnails.length} scripts without thumbnails, generating...`);
        try {
          const generatedCount = await generateAllThumbnails();
          logDebugInfo('ScriptList', `Generated ${generatedCount} thumbnails`);
          
          // Refetch scripts to get the updated thumbnails
          if (generatedCount > 0) {
            const updatedScripts = await getScripts();
            setScripts(updatedScripts);
          }
        } catch (thumbnailErr: any) {
          logDebugInfo('ScriptList', `Failed to generate thumbnails: ${thumbnailErr.message}`);
          // Don't fail the whole operation if thumbnail generation fails
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch scripts';
      logDebugInfo('ScriptList', `Failed to fetch scripts: ${errorMsg}, status: ${err.status}`);
      setError(errorMsg);
      
      // 🔧 FIXED: Don't auto-logout on 401 errors during page refresh
      // This prevents the scripts page from redirecting to login on refresh
      // Only show error, let user manually re-authenticate if needed
      if (err.status === 401) {
        logDebugInfo('ScriptList', 'Auth error detected - not auto-logging out to preserve page refresh behavior');
        setError('Authentication expired. Please refresh the page or log in again.');
      }
      logger.error('ScriptList', 'Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 🔧 FIXED: Wait for tokenReady to ensure token is set in ApiService before fetching
    if (token && user && tokenReady) {
      fetchScripts();
    }
  }, [token, user, tokenReady, setToken]);

  // Effect to handle refresh trigger
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchScripts();
    }
  }, [refreshTrigger]);

  // Reconnect to ongoing Claude sessions on mount
  useEffect(() => {
    if (token && uploads.length > 0) {
      logger.debug('ScriptList', '[ScriptList] Checking for ongoing uploads to reconnect...');
      
      uploads.forEach(upload => {
        // Only reconnect if upload is not complete and has a session ID
        if (!upload.uploadComplete && upload.uploadStatus === 'processing') {
          const sessionId = getSessionId(upload.id);
          if (sessionId) {
            logger.debug('ScriptList', `[ScriptList] Reconnecting to session ${sessionId} for upload ${upload.title}`);
            
            // Create WebSocket connection to monitor existing session
            const sessionService = new ClaudeSessionService(
              sessionId,
              token,
              (update) => {
                // Handle session updates
                if (update.type === 'status' && update.progress !== undefined) {
                  updateUpload(upload.id, { 
                    uploadProgress: Math.max(70, Math.min(90, update.progress)),
                    uploadSubStage: `Processing: ${update.status || 'Working...'}`
                  });
                } else if (update.type === 'output' && update.line) {
                  logger.debug('ScriptList', '[Claude Output]', update.line);
                  updateUpload(upload.id, {
                    uploadSubStage: 'Claude Code is working...'
                  });
                }
              },
              (scriptId) => {
                // On complete
                logger.debug('ScriptList', '[ScriptList] Claude session completed! Script ID:', scriptId);
                updateUpload(upload.id, {
                  uploadStatus: 'complete' as const,
                  uploadProgress: 100,
                  uploadComplete: true,
                  uploadSubStage: 'Processing complete!'
                });
                
                // Refresh scripts to show the new one
                fetchScripts();
                
                // Remove after a delay
                setTimeout(() => {
                  removeUpload(upload.id);
                }, 2000);
              },
              (error) => {
                // On error
                logger.error('ScriptList', '[ScriptList] Claude session error:', error);
                updateUpload(upload.id, {
                  uploadStatus: 'error' as const,
                  uploadError: error,
                  uploadSubStage: undefined
                });
              }
            );
            
            // Connect to existing session
            sessionService.connect();
            
            // Store service reference for potential cancellation
            updateUpload(upload.id, { sessionService });
          }
        }
      });
    }
  }, [token]); // Only run on mount when token is available

  const handleCreateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newScriptName.trim()) return;
    setError(null);
    try {
      const newScript = await createScript(newScriptName.trim());
      // Add script to the list without a full refetch for better UX
      setScripts(prev => [...prev, newScript]);
      setNewScriptName(''); // Clear input
      setAddSlotState('plus'); // Hide input form
    } catch (err: any) {
      setError(err.message || 'Failed to create script');
      logger.error('ScriptList', 'Error:', err);
    }
  };

  const handleDeleteScript = async (scriptId: string, scriptTitle: string) => {
    if (!token) return;
    
    // Show custom confirmation modal instead of browser prompt
    setConfirmDelete({ scriptId, scriptTitle });
  };

  const confirmDeleteScript = async () => {
    if (!token || !confirmDelete) return;
    
    const { scriptId } = confirmDelete;
    setDeletingScriptId(scriptId);
    
    setIsDeleteModalClosing(true);
    setTimeout(async () => {
      setConfirmDelete(null);
      setIsDeleteModalClosing(false);
      try {
        await deleteScript(scriptId);
        // Remove script from local state
        setScripts(prev => prev.filter(script => script.id !== scriptId));
      } catch (err: any) {
        setError(err.message || 'Failed to delete script');
        logger.error('ScriptList', 'Error:', err);
      } finally {
        setDeletingScriptId(null);
      }
    }, 300); // Wait for animation
  };

  const cancelDelete = () => {
    setIsDeleteModalClosing(true);
    setTimeout(() => {
      setConfirmDelete(null);
      setIsDeleteModalClosing(false);
    }, 300); // Wait for animation
  };

  const handleOpenSharingModal = async (scriptId: string, scriptTitle: string, isPublic: boolean) => {
    setSharingScript({ scriptId, scriptTitle, isPublic });
    setSharingLoading(true);
    setShareUsername('');
    setSharePermission('read');
    
    // Load existing shares
    if (token) {
      try {
        const shares = await getScriptShares(scriptId);
        setScriptShares(shares);
      } catch (err: any) {
        logger.error('ScriptList', 'Failed to load shares:', err);
        setError(err.message || 'Failed to load shares');
      } finally {
        setSharingLoading(false);
      }
    }
  };

  const handleCloseSharingModal = () => {
    setIsSharingModalClosing(true);
    setTimeout(() => {
      setSharingScript(null);
      setIsSharingModalClosing(false);
      setScriptShares([]);
      setShareUsername('');
      setSharePermission('read');
    }, 300); // Wait for animation
  };

  const handleAddShare = async () => {
    if (!token || !sharingScript || !shareUsername.trim()) return;
    
    setSharingLoading(true);
    try {
      await shareScript(sharingScript.scriptId, {
        username: shareUsername.trim(),
        permission: sharePermission,
      });
      
      // Reload shares
      const shares = await getScriptShares(sharingScript.scriptId);
      setScriptShares(shares);
      setShareUsername('');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to share script');
    } finally {
      setSharingLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!token || !sharingScript) return;
    
    setSharingLoading(true);
    try {
      await removeScriptShare(sharingScript.scriptId, shareId);
      
      // Remove from local state
      setScriptShares(prev => prev.filter(share => share.id !== shareId));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to remove share');
    } finally {
      setSharingLoading(false);
    }
  };

  const handleTogglePublic = async () => {
    if (!token || !sharingScript) return;
    
    setSharingLoading(true);
    try {
      const newPublicStatus = await toggleScriptPublic(sharingScript.scriptId);
      
      // Update local state
      setSharingScript(prev => prev ? { ...prev, isPublic: newPublicStatus } : null);
      setScripts(prev => prev.map(script => 
        script.id === sharingScript.scriptId 
          ? { ...script, is_public: newPublicStatus }
          : script
      ));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle public status');
    } finally {
      setSharingLoading(false);
    }
  };

  // 🚫 PREVENT CLICKING: Only allow clicking completed scripts
  const handleScriptClick = (scriptId: string, scriptTitle: string, isPlaceholder?: boolean, uploadStatus?: UploadStatus) => {
    // Prevent clicking on placeholders that aren't completed
    if (isPlaceholder && uploadStatus !== 'completed') {
      logger.debug('ScriptList', '[ScriptList] ❌ Cannot click placeholder that is still uploading');
      return;
    }

    // Start breadcrumb animation immediately
    onScriptClickStart?.(scriptTitle);
    
    // Start exit animation for slots
    setIsExiting(true);
    
    // Wait for animation to complete before navigating
    setTimeout(() => {
      onSelectScript(scriptId, scriptTitle);
    }, 200);
  };

  if (loading) return <p>Loading scripts...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  // Combine regular scripts with upload placeholders for rendering
  const allScripts = [...scripts];
  const uploadPlaceholders = uploads;

  return (
    <div>
      <div className={`${styles.scriptGrid} ${isExiting ? styles.exiting : ''}`}>
        {/* Regular scripts */}
        {allScripts.map(script => (
          <div 
            key={script.id} 
            className={`${styles.scriptPage} ${script.thumbnail ? styles.withThumbnail : ''}`}
            style={script.thumbnail ? { backgroundImage: `url(${script.thumbnail})` } : {}}
            onClick={() => handleScriptClick(script.id, script.title)}
          >
            {/* Badges positioned in top-left */}
            <div className={styles.badgeContainer}>
              {script.is_public && <span className={styles.publicBadge}>Public</span>}
              {script.created_by !== user?.id && <span className={styles.sharedBadge}>Shared</span>}
            </div>
            
            <div className={styles.pageBody}>
              {script.thumbnail ? (
                <img 
                  src={script.thumbnail} 
                  alt={`Preview of ${script.title}`}
                  className={styles.thumbnailImage}
                />
              ) : (
                <div className={styles.noThumbnail}>
                  <span className={styles.noThumbnailIcon}>📄</span>
                  <span className={styles.noThumbnailText}>Generating preview...</span>
                </div>
              )}
            </div>

            <div className={styles.pageFooter}>
              {/* Title moved to footer above date */}
              {renamingScriptId === script.id ? (
                <form onSubmit={(e) => handleRename(script.id, e)} className={styles.renameForm}>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className={styles.renameInput}
                    autoFocus
                    onBlur={cancelRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        cancelRename();
                      }
                    }}
                  />
                </form>
              ) : (
                <h3 className={styles.pageTitle} title={script.title}>{script.title}</h3>
              )}
              <p className={styles.pageDate}>
                Created: {new Date(script.created_at).toLocaleDateString()}
              </p>
              <div className={styles.menuContainer} data-menu-id={script.id}>
                <button 
                  className={styles.burgerButton}
                  onClick={(e) => toggleMenu(script.id, e)}
                  title="Script options"
                >
                  <span className={styles.burgerIcon}>&#8942;</span>
                </button>
                {openMenuId === script.id && (
                  <div className={styles.dropdownMenu}>
                    <button 
                      className={styles.menuItem}
                      onClick={(e) => startRename(script.id, script.title, e)}
                    >
                      <span>&#x270F;</span> Rename
                    </button>
                    <button 
                      className={styles.menuItem}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        handleOpenSharingModal(script.id, script.title, script.is_public);
                      }}
                    >
                      <span>&#x1F517;</span> Share
                    </button>
                    <button 
                      className={styles.menuItem}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        handleDeleteScript(script.id, script.title);
                      }}
                      disabled={deletingScriptId === script.id}
                    >
                      <span>&#x1F5D1;</span> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Upload placeholders */}
        {uploadPlaceholders.map(placeholder => renderUploadPlaceholder(placeholder))}
        
        {/* Add New Script Slot */}
        <div 
          ref={addSlotRef}
          className={`${styles.scriptSlot} ${styles.addSlot}`}
          onClick={() => addSlotState === 'plus' && setAddSlotState('options')}
        >
          {addSlotState === 'plus' && <div className={styles.addIcon}>+</div>}

          {addSlotState === 'options' && (
            <div className={styles.optionsContainer}>
                <button onClick={() => setAddSlotState('input')}>Create New Script</button>
                <button onClick={handleUploadOptionClick}>Upload Script</button>
            </div>
          )}
          
          {addSlotState === 'input' && (
            <form onSubmit={handleCreateScript} className={styles.createForm}>
              <input
                type="text"
                value={newScriptName}
                onChange={(e) => setNewScriptName(e.target.value)}
                placeholder="New script name"
                autoFocus
                required
              />
              <button type="submit">Create</button>
            </form>
          )}
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {confirmDelete && (
        <div className={`${styles.modalOverlay} ${isDeleteModalClosing ? styles.exiting : ''}`} onClick={cancelDelete}>
          <div className={`${styles.confirmModal} ${isDeleteModalClosing ? styles.exiting : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Delete Script</h3>
            </div>
            <div className={styles.modalBody}>
              <p>Are you sure you want to delete <strong>"{confirmDelete.scriptTitle}"</strong>?</p>
              <p className={styles.warningText}>This action cannot be undone.</p>
            </div>
            <div className={styles.modalActions}>
              <button onClick={cancelDelete} className={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={confirmDeleteScript} className={styles.deleteConfirmButton}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Sharing Modal */}
      {sharingScript && (
        <div className={`${styles.modalOverlay} ${isSharingModalClosing ? styles.exiting : ''}`} onClick={handleCloseSharingModal}>
          <div className={`${styles.confirmModal} ${isSharingModalClosing ? styles.exiting : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Share "{sharingScript.scriptTitle}"</h3>
            </div>
            <div className={styles.modalBody}>
              {error && <div className={styles.errorMessage}>{error}</div>}
              
              <div className={styles.shareOption}>
                <span>Make script public:</span>
                <button 
                  className={`${styles.publicToggle} ${sharingScript.isPublic ? styles.active : ''}`}
                  onClick={handleTogglePublic}
                  disabled={sharingLoading}
                >
                  {sharingScript.isPublic ? 'Public' : 'Private'}
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
                    onChange={(e) => setShareUsername(e.target.value)}
                    disabled={sharingLoading}
                  />
                  <select 
                    className={styles.permissionSelect}
                    value={sharePermission}
                    onChange={(e) => setSharePermission(e.target.value as 'read' | 'write')}
                    disabled={sharingLoading}
                  >
                    <option value="read">Read</option>
                    <option value="write">Write</option>
                  </select>
                  <button 
                    className={styles.addButton}
                    onClick={handleAddShare}
                    disabled={!shareUsername.trim() || sharingLoading}
                  >
                    Add
                  </button>
                </div>

                {sharingLoading && <div className={styles.loadingText}>Loading...</div>}
                
                <div className={styles.sharesList}>
                  {scriptShares.map(share => (
                    <div key={share.id} className={styles.shareItem}>
                      <span className={styles.shareUsername}>{share.username}</span>
                      <span className={styles.sharePermission}>{share.permission}</span>
                      <button 
                        className={styles.removeButton}
                        onClick={() => handleRemoveShare(share.id)}
                        disabled={sharingLoading}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {scriptShares.length === 0 && !sharingLoading && (
                    <div className={styles.noShares}>No users have access to this script yet.</div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button onClick={handleCloseSharingModal} className={styles.cancelButton}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// Update the export to use the new forwardRef component
// export const ScriptList: React.FC<ScriptListProps> = ... (remove this line)

// Export the ref type for use in App component
export type { ScriptListProps }; 