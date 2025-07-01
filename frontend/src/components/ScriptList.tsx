import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { getScripts, createScript, deleteScript, updateScript, shareScript, getScriptShares, removeScriptShare, toggleScriptPublic, generateAllThumbnails } from '../api';
import { Script, ScriptShareWithUser } from '../types';
import { logDebugInfo } from '../utils/debug';
import styles from './ScriptList.module.css';

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
 * Script list and creation component.
 *
 * Displays a grid of scripts, allows creating new scripts via an "add" slot.
 *
 * @component
 * @param {ScriptListProps} props - Component props.
 */
export const ScriptList: React.FC<ScriptListProps> = ({ onSelectScript, onUploadClick, onScriptClickStart, refreshTrigger }) => {
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
  const { token, setToken, user } = useAuth();
  const addSlotRef = useRef<HTMLDivElement>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingScriptId, setRenamingScriptId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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
      const fetchedScripts = await getScripts(token);
      logDebugInfo('ScriptList', `Fetched ${fetchedScripts.length} scripts`);
      setScripts(fetchedScripts);
      
      // Generate thumbnails for scripts that don't have them
      const scriptsWithoutThumbnails = fetchedScripts.filter(script => !script.thumbnail);
      if (scriptsWithoutThumbnails.length > 0) {
        logDebugInfo('ScriptList', `Found ${scriptsWithoutThumbnails.length} scripts without thumbnails, generating...`);
        try {
          const generatedCount = await generateAllThumbnails(token);
          logDebugInfo('ScriptList', `Generated ${generatedCount} thumbnails`);
          
          // Refetch scripts to get the updated thumbnails
          if (generatedCount > 0) {
            const updatedScripts = await getScripts(token);
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
      if (err.status === 401) { // More specific check for auth errors
         logDebugInfo('ScriptList', 'Auth error - logging out user');
         setToken(null); // Auto-logout on auth error
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, [token, setToken]);

  // Effect to handle refresh trigger
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchScripts();
    }
  }, [refreshTrigger]);

  const handleCreateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newScriptName.trim()) return;
    setError(null);
    try {
      const newScript = await createScript(token, newScriptName.trim());
      // Add script to the list without a full refetch for better UX
      setScripts(prev => [...prev, newScript]);
      setNewScriptName(''); // Clear input
      setAddSlotState('plus'); // Hide input form
    } catch (err: any) {
      setError(err.message || 'Failed to create script');
      console.error(err);
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
        await deleteScript(token, scriptId);
        // Remove script from local state
        setScripts(prev => prev.filter(script => script.id !== scriptId));
      } catch (err: any) {
        setError(err.message || 'Failed to delete script');
        console.error(err);
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
        const shares = await getScriptShares(token, scriptId);
        setScriptShares(shares);
      } catch (err: any) {
        console.error('Failed to load shares:', err);
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
      await shareScript(token, sharingScript.scriptId, {
        username: shareUsername.trim(),
        permission: sharePermission,
      });
      
      // Reload shares
      const shares = await getScriptShares(token, sharingScript.scriptId);
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
      await removeScriptShare(token, sharingScript.scriptId, shareId);
      
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
      const newPublicStatus = await toggleScriptPublic(token, sharingScript.scriptId);
      
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

  const handleScriptClick = (scriptId: string, scriptTitle: string) => {
    // Start breadcrumb animation immediately
    onScriptClickStart?.(scriptTitle);
    
    // Start exit animation for slots
    setIsExiting(true);
    
    // Wait for animation to complete before navigating
    setTimeout(() => {
      onSelectScript(scriptId, scriptTitle);
    }, 200);
  };

  const handleUploadOptionClick = () => {
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
      const updatedScript = await updateScript(token, scriptId, renameValue.trim());
      // Update the script in local state
      setScripts(prev => prev.map(script => 
        script.id === scriptId ? { ...updatedScript } : script
      ));
      setRenamingScriptId(null);
      setRenameValue('');
    } catch (err: any) {
      setError(err.message || 'Failed to rename script');
      console.error(err);
    }
  };

  if (loading) return <p>Loading scripts...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <div>
      <div className={`${styles.scriptGrid} ${isExiting ? styles.exiting : ''}`}>
        {scripts.map(script => (
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
}; 