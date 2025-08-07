import { useState, useEffect, useCallback } from 'react';
import { Script } from '../../../types';
import { getScripts, generateAllThumbnails } from '../../../api';
import logger from '../../../services/LoggingService';

interface UseScriptsReturn {
  scripts: Script[];
  loading: boolean;
  error: string | null;
  refreshScripts: () => Promise<void>;
  setScripts: React.Dispatch<React.SetStateAction<Script[]>>;
}

export const useScripts = (token: string | null, tokenReady: boolean): UseScriptsReturn => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScripts = useCallback(async () => {
    if (!token) {
      setScripts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getScripts();
      setScripts(data);
      
      // Generate thumbnails in background
      const scriptsWithoutThumbnails = data.filter(s => !s.thumbnail);
      if (scriptsWithoutThumbnails.length > 0) {
        generateAllThumbnails()
          .then(updatedScripts => {
            setScripts(prev => {
              const updatedMap = new Map(updatedScripts.map(s => [s.id, s]));
              return prev.map(script => updatedMap.get(script.id) || script);
            });
          })
          .catch(err => {
            logger.error('useScripts', 'Failed to generate thumbnails:', err);
          });
      }
    } catch (err) {
      const errorMessage = 'Failed to load scripts';
      setError(errorMessage);
      logger.error('useScripts', errorMessage, err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (tokenReady && token) {
      fetchScripts();
    } else if (tokenReady && !token) {
      setScripts([]);
      setLoading(false);
    }
  }, [tokenReady, token, fetchScripts]);

  return {
    scripts,
    loading,
    error,
    refreshScripts: fetchScripts,
    setScripts
  };
};