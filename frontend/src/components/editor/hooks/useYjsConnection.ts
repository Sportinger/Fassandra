import { useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { getScriptWithBlocks } from '../../../api';
import { isYDocEmpty } from '../utils/formatters';
import { convertBlocksToTiptapContent } from '../utils/contentConverters';
import { logDebugInfo, isMobile } from '../../../utils/debug';
import { ConnectionStatus } from '../types';

interface UseYjsConnectionProps {
  scriptId: string;
  user: any;
  token: string;
  // ydoc: Y.Doc | null; // Not used directly in this hook
  setYdoc: (doc: Y.Doc | null) => void;
  // provider: WebsocketProvider | null; // Not used directly in this hook
  setProvider: (provider: WebsocketProvider | null) => void;
  persistenceRef: React.MutableRefObject<IndexeddbPersistence | null>;
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus | ((prev: ConnectionStatus) => ConnectionStatus)) => void;
  setErrorMessage: (message: string | null) => void;
  setScriptTitle: (title: string) => void;
  setScriptCreationDate: (date: string | null) => void;
  setPendingContent: (content: string | null) => void;
  setIsMobileFallback: (fallback: boolean) => void;
}

export const useYjsConnection = ({
  scriptId,
  user,
  token,
  // ydoc, // Not used directly in this hook, managed internally
  setYdoc,
  // provider, // Not used directly in this hook, managed internally
  setProvider,
  persistenceRef,
  status,
  setStatus,
  setErrorMessage,
  setScriptTitle,
  setScriptCreationDate,
  setPendingContent,
  setIsMobileFallback,
}: UseYjsConnectionProps) => {
  // Initialize Yjs Doc and Provider
  useEffect(() => {
    if (!scriptId || !user || !token) {
      setStatus('authenticating');
      setErrorMessage('Missing script ID, user, or token.');
      console.warn("Yjs/Provider Init: Missing scriptId, user, or token.");
      return;
    }

    console.log(`Initializing Yjs/Provider for script: ${scriptId}, user: ${user.username} (${user.id})`);
    logDebugInfo('Editor', `Initializing Yjs/Provider for script: ${scriptId}, user: ${user.username} (${user.id})`);
    setStatus('connecting');
    setErrorMessage(null);

    const currentDoc = new Y.Doc();
    
    // Ensure the 'default' XmlFragment exists immediately (Tiptap's default field name)
    currentDoc.transact(() => {
      currentDoc.getXmlFragment('default'); // This creates it if it doesn't exist
    }, 'initializeDefaultFragment');
    
    setYdoc(currentDoc);

    const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || 
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/collab`;
    logDebugInfo('Editor', `WebSocket Base URL: ${wsBaseUrl}`);
    console.log(`WebSocket Base URL: ${wsBaseUrl}`);

    console.log(`Setting up IndexedDB persistence for ${scriptId}...`);
    const persistence = new IndexeddbPersistence(`theater-script-${scriptId}`, currentDoc);
    persistenceRef.current = persistence;

    persistence.on('synced', (isSynced: boolean) => {
      console.log(`IndexedDB sync status: ${isSynced}`);
      if (isSynced && status !== 'connected') {
        // Check if content needs fetching AFTER sync
        if (isYDocEmpty(currentDoc) && token) {
          console.log(`[Editor Fetch] Y.Doc empty, fetching initial content for script ${scriptId}`);
          getScriptWithBlocks(token, scriptId)
            .then(scriptData => {
              console.log("[Editor Fetch] Received scriptData:", scriptData);
              setScriptTitle(scriptData.script.title);
              setScriptCreationDate(scriptData.script.created_at);

              // Convert blocks to Tiptap content and set
              const tiptapContent = convertBlocksToTiptapContent(scriptData.blocks);
              console.log("[Editor Fetch] Converted to TipTap content:", tiptapContent);

              // Store content to be set when editor is ready
              setPendingContent(tiptapContent);
              console.log("[Editor Fetch] Content converted, stored as pending for editor");
            })
            .catch(error => {
              console.error("[Editor Fetch] Failed to fetch script content:", error);
              setErrorMessage(`Failed to load script: ${error.message}`);
              setStatus('error');
            });
        } else {
          console.log(`[Editor Fetch] Y.Doc not empty or no token, skipping fetch`);
        }
      }
    });

    // Set up WebSocket provider with auth and mobile fallback
    const wsUrl = wsBaseUrl;
    const roomName = scriptId;
    const wsParams = { token };
    
    console.log(`Connecting to WebSocket: ${wsUrl}/${roomName} with params:`, wsParams);
    logDebugInfo('Editor', `Connecting to WebSocket: ${wsUrl}/${roomName} - Mobile: ${isMobile()}`);
    
    // Create WebSocket provider with mobile-specific handling
    const currentProvider = new WebsocketProvider(wsUrl, roomName, currentDoc, {
      connect: true,
      params: wsParams,
      maxBackoffTime: isMobile() ? 5000 : 10000,
      resyncInterval: 15000, // 15 seconds instead of 20-30s
    });

    logDebugInfo('Editor', 'WebSocket provider created with mobile options');

    // Track connection attempts and implement fallback
    let connectionAttempts = 0;
    let hasConnectedOnce = false;

    currentProvider.on('status', (event: { status: string }) => {
      console.log(`WebSocket status: ${event.status}`);
      logDebugInfo('Editor', `WebSocket status: ${event.status} (attempt: ${connectionAttempts})`);
      const newStatus = event.status as ConnectionStatus;
      
      if (newStatus === 'connecting') {
        connectionAttempts++;
      } else if (newStatus === 'connected') {
        hasConnectedOnce = true;
        connectionAttempts = 0;
        setIsMobileFallback(false);
      }
      
      // Only update status if it's actually different to prevent unnecessary re-renders
      setStatus(prevStatus => {
        if (prevStatus !== newStatus) {
          console.log(`Status changed from ${prevStatus} to ${newStatus}`);
          logDebugInfo('Editor', `Status changed from ${prevStatus} to ${newStatus}`);
          return newStatus;
        }
        return prevStatus;
      });
      
      // Clear error message when connected
      if (newStatus === 'connected') {
        setErrorMessage(null);
        logDebugInfo('Editor', 'WebSocket connected - cleared error message');
      }
    });

    // Handle WebSocket errors
    currentProvider.on('connection-error', (event: Event) => {
      console.error(`WebSocket error (attempt ${connectionAttempts}):`, event);
      logDebugInfo('Editor', `WebSocket error (attempt ${connectionAttempts}): ${event.type}`);
      
      // On mobile or after multiple failed attempts, enable fallback mode
      if (isMobile() || connectionAttempts >= 3) {
        console.log('Enabling mobile fallback mode for unreliable connection');
        logDebugInfo('Editor', 'Enabling mobile fallback mode');
        setIsMobileFallback(true);
        setErrorMessage('Connection unstable. Working in offline mode.');
      } else {
        setErrorMessage(`Connection failed: ${event.type}`);
      }
    });

    setProvider(currentProvider);

    // Cleanup function
    return () => {
      console.log("Cleaning up WebSocket provider and Yjs doc...");
      logDebugInfo('Editor', 'Cleaning up WebSocket provider and Yjs doc');
      
      if (currentProvider) {
        currentProvider.disconnect();
        currentProvider.destroy();
      }
      
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
        persistenceRef.current = null;
      }
      
      if (currentDoc) {
        currentDoc.destroy();
      }
      
      setProvider(null);
      setYdoc(null);
    };
  }, [scriptId, user, token]); // Only depend on essential auth/routing params
}; 