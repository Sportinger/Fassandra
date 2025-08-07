import { useCallback } from 'react';
import { 
  createScript, 
  deleteScript, 
  updateScript, 
  shareScript, 
  getScriptShares, 
  removeScriptShare, 
  toggleScriptPublic 
} from '../../../api';
import { Script, ScriptShareWithUser } from '../../../types';
import logger from '../../../services/LoggingService';

interface UseScriptActionsProps {
  token: string | null;
  setScripts: React.Dispatch<React.SetStateAction<Script[]>>;
  setError: (error: string | null) => void;
}

interface UseScriptActionsReturn {
  handleCreateScript: (title: string) => Promise<Script | null>;
  handleDeleteScript: (scriptId: string) => Promise<boolean>;
  handleRenameScript: (scriptId: string, newTitle: string) => Promise<boolean>;
  handleShareScript: (scriptId: string, username: string, permission: 'read' | 'write') => Promise<boolean>;
  handleRemoveShare: (scriptId: string, shareId: string) => Promise<boolean>;
  handleTogglePublic: (scriptId: string) => Promise<boolean>;
  fetchScriptShares: (scriptId: string) => Promise<ScriptShareWithUser[]>;
}

export const useScriptActions = ({ 
  token, 
  setScripts, 
  setError 
}: UseScriptActionsProps): UseScriptActionsReturn => {

  const handleCreateScript = useCallback(async (title: string): Promise<Script | null> => {
    if (!token) {
      setError('Not authenticated');
      return null;
    }

    try {
      const newScript = await createScript(title);
      setScripts(prev => [...prev, newScript]);
      setError(null);
      return newScript;
    } catch (err) {
      const errorMessage = 'Failed to create script';
      setError(errorMessage);
      logger.error('useScriptActions', errorMessage, err);
      return null;
    }
  }, [token, setScripts, setError]);

  const handleDeleteScript = useCallback(async (scriptId: string): Promise<boolean> => {
    if (!token) {
      setError('Not authenticated');
      return false;
    }

    try {
      await deleteScript(scriptId);
      setScripts(prev => prev.filter(s => s.id !== scriptId));
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = 'Failed to delete script';
      setError(errorMessage);
      logger.error('useScriptActions', errorMessage, err);
      return false;
    }
  }, [token, setScripts, setError]);

  const handleRenameScript = useCallback(async (scriptId: string, newTitle: string): Promise<boolean> => {
    if (!token) {
      setError('Not authenticated');
      return false;
    }

    try {
      await updateScript(scriptId, newTitle);
      setScripts(prev => prev.map(s => 
        s.id === scriptId ? { ...s, title: newTitle } : s
      ));
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = 'Failed to rename script';
      setError(errorMessage);
      logger.error('useScriptActions', errorMessage, err);
      return false;
    }
  }, [token, setScripts, setError]);

  const handleShareScript = useCallback(async (
    scriptId: string, 
    username: string, 
    permission: 'read' | 'write'
  ): Promise<boolean> => {
    if (!token) {
      setError('Not authenticated');
      return false;
    }

    try {
      await shareScript(scriptId, { username, permission });
      setError(null);
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to share script';
      setError(errorMessage);
      logger.error('useScriptActions', errorMessage, err);
      return false;
    }
  }, [token, setError]);

  const handleRemoveShare = useCallback(async (scriptId: string, shareId: string): Promise<boolean> => {
    if (!token) {
      setError('Not authenticated');
      return false;
    }

    try {
      await removeScriptShare(scriptId, shareId);
      setError(null);
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to remove share';
      setError(errorMessage);
      logger.error('useScriptActions', errorMessage, err);
      return false;
    }
  }, [token, setError]);

  const handleTogglePublic = useCallback(async (scriptId: string): Promise<boolean> => {
    if (!token) {
      setError('Not authenticated');
      return false;
    }

    try {
      const newPublicStatus = await toggleScriptPublic(scriptId);
      setScripts(prev => prev.map(script => 
        script.id === scriptId 
          ? { ...script, is_public: newPublicStatus }
          : script
      ));
      setError(null);
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to toggle public status';
      setError(errorMessage);
      logger.error('useScriptActions', errorMessage, err);
      return false;
    }
  }, [token, setScripts, setError]);

  const fetchScriptShares = useCallback(async (scriptId: string): Promise<ScriptShareWithUser[]> => {
    if (!token) {
      setError('Not authenticated');
      return [];
    }

    try {
      const shares = await getScriptShares(scriptId);
      setError(null);
      return shares;
    } catch (err) {
      const errorMessage = 'Failed to load shares';
      setError(errorMessage);
      logger.error('useScriptActions', errorMessage, err);
      return [];
    }
  }, [token, setError]);

  return {
    handleCreateScript,
    handleDeleteScript,
    handleRenameScript,
    handleShareScript,
    handleRemoveShare,
    handleTogglePublic,
    fetchScriptShares
  };
};