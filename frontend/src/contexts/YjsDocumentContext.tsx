import React, { createContext, useContext, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { yjsDocumentManager } from '../services/yjsDocumentManager';

interface YjsDocumentContextValue {
  getDocument: (scriptId: string) => Y.Doc;
  releaseDocument: (scriptId: string) => void;
  hasDocument: (scriptId: string) => boolean;
  getDocumentInfo: (scriptId: string) => { exists: boolean; refCount: number; clientID?: number };
}

const YjsDocumentContext = createContext<YjsDocumentContextValue | undefined>(undefined);

interface YjsDocumentProviderProps {
  children: React.ReactNode;
}

/**
 * React Context Provider for Yjs Document Manager
 * Provides access to the singleton document manager throughout the React app
 */
export const YjsDocumentProvider: React.FC<YjsDocumentProviderProps> = ({ children }) => {
  // Track mounted state to prevent cleanup issues
  const isMountedRef = useRef(true);

  useEffect(() => {
    console.log('[YjsDocumentProvider] Mounted');
    
    return () => {
      console.log('[YjsDocumentProvider] Unmounting');
      isMountedRef.current = false;
      // Note: We don't clear documents here as they might be needed across navigation
      // Documents are cleared on logout or explicit cleanup
    };
  }, []);

  const contextValue: YjsDocumentContextValue = {
    getDocument: (scriptId: string) => {
      if (!scriptId) {
        throw new Error('[YjsDocumentContext] Script ID is required to get document');
      }
      return yjsDocumentManager.getDocument(scriptId);
    },
    
    releaseDocument: (scriptId: string) => {
      if (!scriptId) return;
      // Only release if component is still mounted
      if (isMountedRef.current) {
        yjsDocumentManager.releaseDocument(scriptId);
      }
    },
    
    hasDocument: (scriptId: string) => {
      return yjsDocumentManager.hasDocument(scriptId);
    },
    
    getDocumentInfo: (scriptId: string) => {
      return yjsDocumentManager.getDocumentInfo(scriptId);
    }
  };

  return (
    <YjsDocumentContext.Provider value={contextValue}>
      {children}
    </YjsDocumentContext.Provider>
  );
};

/**
 * Hook to access Yjs document manager
 * Must be used within YjsDocumentProvider
 */
export const useYjsDocument = () => {
  const context = useContext(YjsDocumentContext);
  if (!context) {
    throw new Error('useYjsDocument must be used within YjsDocumentProvider');
  }
  return context;
};

/**
 * Hook to manage a specific document's lifecycle
 * Automatically handles acquisition and release
 */
export const useYjsDocumentLifecycle = (scriptId: string | null) => {
  const { getDocument, releaseDocument, getDocumentInfo } = useYjsDocument();
  const docRef = useRef<Y.Doc | null>(null);
  const scriptIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!scriptId) return;

    // If script ID changed, release old document
    if (scriptIdRef.current && scriptIdRef.current !== scriptId) {
      console.log(`[useYjsDocumentLifecycle] Script changed from ${scriptIdRef.current} to ${scriptId}`);
      releaseDocument(scriptIdRef.current);
      docRef.current = null;
    }

    // Get new document
    console.log(`[useYjsDocumentLifecycle] Acquiring document for script: ${scriptId}`);
    const doc = getDocument(scriptId);
    docRef.current = doc;
    scriptIdRef.current = scriptId;

    // Cleanup on unmount or script change
    return () => {
      if (scriptId) {
        console.log(`[useYjsDocumentLifecycle] Releasing document for script: ${scriptId}`);
        releaseDocument(scriptId);
        docRef.current = null;
      }
    };
  }, [scriptId, getDocument, releaseDocument]);

  return {
    document: docRef.current,
    documentInfo: scriptId ? getDocumentInfo(scriptId) : null
  };
};