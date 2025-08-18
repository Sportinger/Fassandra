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
      
      // Debug logging to see what scripts are returned
      console.log('[DEBUG] Fetched scripts from API:', data.length);
      const publicScripts = data.filter(s => s.is_public);
      console.log('[DEBUG] Public scripts:', publicScripts.length, 'Total:', data.length);
      console.log('[DEBUG] Script details:', data.map(s => ({ 
        title: s.title, 
        is_public: s.is_public, 
        created_by: s.created_by?.substring(0, 8) 
      })));
      logger.info('useScripts', `Fetched ${data.length} scripts from API`);
      logger.info('useScripts', `Public: ${publicScripts.length}, Total: ${data.length}`);
      
      setScripts(data);
      
      // Generate thumbnails in background
      const scriptsWithoutThumbnails = data.filter(s => !s.thumbnail);
      if (scriptsWithoutThumbnails.length > 0) {
        generateAllThumbnails()
          .then(count => {
            // generateAllThumbnails returns a count, not scripts
            // After generating thumbnails, fetch scripts again to get updated thumbnails
            if (count > 0) {
              getScripts(true) // Force refresh to get new thumbnails
                .then(updatedScripts => {
                  if (Array.isArray(updatedScripts)) {
                    setScripts(updatedScripts);
                  }
                })
                .catch(err => {
                  logger.error('useScripts', 'Failed to fetch updated scripts:', err);
                });
            }
          })
          .catch(err => {
            logger.error('useScripts', 'Failed to generate thumbnails:', err);
          });
      }
    } catch (err) {
      const errorMessage = 'Failed to load scripts';
      logger.error('useScripts', errorMessage, err);
      // For demo purposes, show mock data when API fails in development
      if (process.env.NODE_ENV === 'development') {
        setScripts([
          {
            id: 'demo-script-1',
            title: 'Hamlet - Act 3, Scene 1',
            created_by: 'demo-user',
            created_at: new Date().toISOString(),
            is_public: false,
            thumbnail: null
          },
          {
            id: 'demo-script-2',
            title: 'Romeo and Juliet - Balcony Scene',
            created_by: 'demo-user',
            created_at: new Date().toISOString(),
            is_public: true,
            thumbnail: null
          }
        ]);
        setError(null);
      } else {
        setError(errorMessage);
      }
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