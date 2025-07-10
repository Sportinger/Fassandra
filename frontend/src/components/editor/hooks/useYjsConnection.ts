import { useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { getScriptWithBlocks } from '../../../api';
import { isYDocEmpty } from '../utils/formatters';
import { convertBlocksToTiptapContent } from '../utils/contentConverters';
import { logDebugInfo, isMobile } from '../../../utils/debug';
import { ConnectionStatus } from '../types';
// Import mobile debug utilities for mobile browser troubleshooting
import '../../../utils/mobile-debug';
// Import console forwarder for mobile debugging
import { consoleForwarder } from '../../../utils/console-forwarder';

// Helper function to detect Chrome browser (including Brave)
const isChrome = () => {
  return (/Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent)) || 
         /Brave/.test(navigator.userAgent) || 
         /CriOS/.test(navigator.userAgent); // Chrome on iOS
};

// Helper function to detect Firefox browser
const isFirefox = () => {
  return /Firefox/.test(navigator.userAgent);
};

// Helper function to detect Safari browser
const isSafari = () => {
  return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
};

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
  status: _status,
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

    const browserInfo = {
      isChrome: isChrome(),
      isFirefox: isFirefox(),
      isSafari: isSafari(),
      isMobile: isMobile(),
      userAgent: navigator.userAgent,
    };

    console.log(`[YJS] 🚀 Initializing Yjs/Provider for script: ${scriptId}, user: ${user.username} (${user.id})`);
    console.log('[YJS] Browser info:', browserInfo);
    console.log('[YJS] Mobile detection:', {
      isMobile: isMobile(),
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      hostname: window.location.hostname,
      host: window.location.host,
    });
    console.log('[YJS] 🔍 DEBUGGING: Connection setup starting...');
    
    // Enable console forwarder for mobile debugging
    if (isMobile()) {
      console.log('[YJS] Mobile device detected - enabling console forwarder...');
      consoleForwarder.enable(scriptId, user.id);
    }
    
    logDebugInfo('Editor', `Initializing Yjs/Provider for script: ${scriptId}, user: ${user.username} (${user.id}), browser: ${browserInfo.isChrome ? 'Chrome' : browserInfo.isFirefox ? 'Firefox' : browserInfo.isSafari ? 'Safari' : 'Other'}, mobile: ${browserInfo.isMobile}`);
    setStatus('connecting');
    setErrorMessage(null);

    const currentDoc = new Y.Doc();
    
    // Ensure the 'default' XmlFragment exists immediately (Tiptap's default field name)
    currentDoc.transact(() => {
      currentDoc.getXmlFragment('default'); // This creates it if it doesn't exist
    }, 'initializeDefaultFragment');
    
    console.log('[YJS Debug] Y.Doc created and default fragment initialized');
    setYdoc(currentDoc);

    // Use host-accessible URL for browser WebSocket connections
    const envWsUrl = import.meta.env.VITE_WS_BASE_URL;
    const fallbackWsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/collab`;
    
    // ALL browsers (including mobile) should use the frontend proxy to avoid CORS issues
    // Mobile browsers connecting directly to :3001 can cause network/firewall problems
    const wsBaseUrl = envWsUrl || fallbackWsUrl; // Always use proxy route through frontend
    
    console.log(`[YJS] 🌍 Environment WS URL: ${envWsUrl}`);
    console.log(`[YJS] 🔄 Fallback WS URL: ${fallbackWsUrl}`);
    console.log(`[YJS] ✅ Final WebSocket Base URL: ${wsBaseUrl}`);
    console.log(`[YJS] 🔍 Current location:`, {
      protocol: window.location.protocol,
      host: window.location.host,
      hostname: window.location.hostname,
      port: window.location.port,
      pathname: window.location.pathname
    });
    logDebugInfo('Editor', `WebSocket Base URL: ${wsBaseUrl}`);

    console.log(`[YJS] Setting up IndexedDB persistence for ${scriptId}...`);
    const persistence = new IndexeddbPersistence(`theater-script-${scriptId}`, currentDoc);
    persistenceRef.current = persistence;

    // Check initial state immediately after creating persistence
    console.log(`[YJS] Initial persistence state:`, {
      synced: persistence.synced,
      isDocEmpty: isYDocEmpty(currentDoc),
      hasToken: !!token
    });

    // If already synced, handle it immediately
    if (persistence.synced) {
      console.log(`[YJS] Persistence already synced, checking content immediately`);
      if (isYDocEmpty(currentDoc) && token) {
        console.log(`[Editor Fetch] Y.Doc empty (immediate check), fetching initial content for script ${scriptId}`);
        getScriptWithBlocks(token, scriptId)
          .then(scriptData => {
            console.log("[Editor Fetch] Received scriptData (immediate):", scriptData);
            setScriptTitle(scriptData.script.title);
            setScriptCreationDate(scriptData.script.created_at);

            // Convert blocks to Tiptap content and set
            const tiptapContent = convertBlocksToTiptapContent(scriptData.blocks);
            console.log("[Editor Fetch] Converted to TipTap content (immediate):", tiptapContent);

            // Store content to be set when editor is ready
            setPendingContent(tiptapContent);
            console.log("[Editor Fetch] Content converted, stored as pending for editor (immediate)");
          })
          .catch(error => {
            console.error("[Editor Fetch] Failed to fetch script content (immediate):", error);
            setErrorMessage(`Failed to load script: ${error.message}`);
            setStatus('error');
          });
      } else {
        console.log(`[Editor Fetch] Not fetching content (immediate) - isEmpty: ${isYDocEmpty(currentDoc)}, hasToken: ${!!token}`);
      }
    }

    // Add YJS document event logging for mobile debugging
    currentDoc.on('update', (update: Uint8Array, origin: any) => {
      console.log(`[YJS] Document update received:`, {
        updateSize: update.length,
        origin: origin?.constructor?.name || 'unknown',
        isMobile: isMobile(),
        timestamp: new Date().toISOString(),
      });
      logDebugInfo('Editor', `YJS document update: ${update.length} bytes, origin: ${origin?.constructor?.name || 'unknown'}`);
    });

    currentDoc.on('subdocs', (event: { loaded: Set<Y.Doc>; added: Set<Y.Doc>; removed: Set<Y.Doc>; }) => {
      console.log(`[YJS] Subdocs changed:`, {
        loaded: event.loaded.size,
        added: event.added.size,
        removed: event.removed.size,
      });
    });

    persistence.on('synced', (isSynced: boolean) => {
      console.log(`[YJS] IndexedDB sync status: ${isSynced}`);
      if (isSynced && token) {
        // Check if content needs fetching AFTER sync - regardless of connection status
        if (isYDocEmpty(currentDoc)) {
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
          console.log(`[Editor Fetch] Y.Doc not empty, skipping fetch. Document has content.`);
        }
      } else {
        console.log(`[Editor Fetch] Not fetching content - isSynced: ${isSynced}, hasToken: ${!!token}`);
      }
    });

    console.log(`[YJS] Persistence 'synced' event handler attached`);

    // Set up WebSocket provider with auth and mobile fallback
    const roomName = scriptId;
    
    // Chrome/Safari/Mobile-specific WebSocket configuration with manual URL construction
    if (browserInfo.isChrome || browserInfo.isSafari || isMobile()) {
      const browserType = isMobile() ? 'Mobile' : (browserInfo.isChrome ? 'Chrome' : 'Safari');
      console.log(`[YJS] Applying ${browserType}-specific WebSocket configuration`);
      logDebugInfo('Editor', `Applying ${browserType}-specific WebSocket configuration`);

      // Manually construct WebSocket URL with token as query parameter for compatibility
      const cleanToken = token.trim(); // Remove any trailing whitespace/slash
      const wsUrlWithToken = `${wsBaseUrl}/${roomName}?token=${encodeURIComponent(cleanToken)}`;
      console.log(`[YJS] 🔗 ${browserType}: Connecting to WebSocket: ${wsUrlWithToken.replace(cleanToken, 'TOKEN_HIDDEN')}`);
      console.log(`[YJS] 🛠️ ${browserType}: Full WebSocket URL construction:`, {
        baseUrl: wsBaseUrl,
        roomName,
        cleanToken: cleanToken.substring(0, 10) + '...',
        tokenLength: cleanToken.length,
        isMobile: isMobile(),
        hostname: window.location.hostname,
      });
      console.log(`[YJS] 🚀 ${browserType}: About to create WebSocketProvider...`);
      logDebugInfo('Editor', `${browserType}: Connecting to WebSocket with manual token in URL`);
      
      const providerConfig = {
        connect: true,
        // Don't use params for Chrome/Safari/Mobile - we put the token directly in the URL
        maxBackoffTime: isMobile() ? 3000 : 8000, // Shorter timeout for mobile
        resyncInterval: isMobile() ? 8000 : 12000, // More frequent for mobile
      };

      try {
        console.log(`[YJS] 🔨 ${browserType}: Creating WebSocketProvider with config:`, providerConfig);
        const currentProvider = new WebsocketProvider(wsUrlWithToken, '', currentDoc, providerConfig);
        console.log(`[YJS] ✅ ${browserType}: WebSocket provider created successfully with token in URL`);
        console.log(`[YJS] 🔧 ${browserType}: Setting up WebSocket provider handlers...`);
        setupWebSocketProviderHandlers(currentProvider, browserInfo, setStatus, setErrorMessage, setIsMobileFallback);
        console.log(`[YJS] 📡 ${browserType}: Setting provider state...`);
        setProvider(currentProvider);
        console.log(`[YJS] 🎉 ${browserType}: WebSocket setup complete!`);
      } catch (error) {
        console.error(`[YJS] ❌ ${browserType}: Failed to create WebSocket provider with token in URL:`, error);
        setErrorMessage(`${browserType} WebSocket connection failed. You can still edit locally.`);
        setStatus('disconnected');
        // Don't set provider to null - let editor work in local mode
        setProvider(null);
      }
    } else {
      // Firefox and other browsers - use standard configuration with params
      console.log('Using standard WebSocket configuration for Firefox/other browsers');
      const cleanToken = token.trim(); // Remove any trailing whitespace/slash
      const wsParams = { token: cleanToken };
      
      console.log(`Connecting to WebSocket: ${wsBaseUrl}/${roomName} with params:`, wsParams);
      logDebugInfo('Editor', `Connecting to WebSocket: ${wsBaseUrl}/${roomName} - Firefox/other`);
      
      const providerConfig = {
        connect: true,
        params: wsParams,
        maxBackoffTime: 10000,
        resyncInterval: 15000,
      };

      const currentProvider = new WebsocketProvider(wsBaseUrl, roomName, currentDoc, providerConfig);
      setupWebSocketProviderHandlers(currentProvider, browserInfo, setStatus, setErrorMessage, setIsMobileFallback);
    setProvider(currentProvider);
    }

    logDebugInfo('Editor', 'WebSocket provider created with browser-specific options');

    // Cleanup function
    return () => {
      console.log("Cleaning up WebSocket provider and Yjs doc...");
      logDebugInfo('Editor', 'Cleaning up WebSocket provider and Yjs doc');
      
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

// Helper function to set up WebSocket provider event handlers
const setupWebSocketProviderHandlers = (
  provider: WebsocketProvider,
  browserInfo: { isChrome: boolean; isFirefox: boolean; isSafari: boolean; isMobile: boolean; userAgent: string },
  setStatus: (status: ConnectionStatus | ((prev: ConnectionStatus) => ConnectionStatus)) => void,
  setErrorMessage: (message: string | null) => void,
  setIsMobileFallback: (fallback: boolean) => void
) => {
  // Track connection attempts and implement fallback
  let connectionAttempts = 0;
  let hasConnectedOnce = false;

  provider.on('status', (event: { status: string }) => {
    console.log(`[YJS] 📊 WebSocket status: ${event.status}`);
    const browserType = browserInfo.isMobile ? 'Mobile' : (browserInfo.isChrome ? 'Chrome' : browserInfo.isFirefox ? 'Firefox' : browserInfo.isSafari ? 'Safari' : 'Other');
    logDebugInfo('Editor', `WebSocket status: ${event.status} (attempt: ${connectionAttempts}), Browser: ${browserType}`);
    const newStatus = event.status as ConnectionStatus;
    console.log(`[YJS] 🔄 Processing status change: ${newStatus}, attempts: ${connectionAttempts}, browser: ${browserType}`);
    
    if (newStatus === 'connecting') {
      connectionAttempts++;
      // Show connecting status for mobile users
      if (browserInfo.isMobile) {
        setErrorMessage(`Connecting... (attempt ${connectionAttempts})`);
      }
    } else if (newStatus === 'connected') {
      hasConnectedOnce = true;
      connectionAttempts = 0;
      setIsMobileFallback(false);
      // Show success message briefly for mobile users
      if (browserInfo.isMobile) {
        setErrorMessage('Mobile connection established!');
        setTimeout(() => setErrorMessage(null), 2000);
      }
    } else if (newStatus === 'disconnected') {
      // Handle disconnection - important for mobile debugging
      if (browserInfo.isMobile) {
        setErrorMessage('Mobile connection lost. Retrying...');
      }
    }
    
    // Only update status if it's actually different to prevent unnecessary re-renders
    setStatus(prevStatus => {
      if (prevStatus !== newStatus) {
        console.log(`Status changed from ${prevStatus} to ${newStatus}`);
        logDebugInfo('Editor', `Status changed from ${prevStatus} to ${newStatus} (Mobile: ${browserInfo.isMobile})`);
        return newStatus;
      }
      return prevStatus;
    });
    
    // Clear error message when connected (except for mobile success message)
    if (newStatus === 'connected' && !browserInfo.isMobile) {
      setErrorMessage(null);
      logDebugInfo('Editor', 'WebSocket connected - cleared error message');
    }
  });

  // Handle WebSocket errors
  provider.on('connection-error', (event: Event) => {
    console.error(`WebSocket error (attempt ${connectionAttempts}):`, event);
    logDebugInfo('Editor', `WebSocket error (attempt ${connectionAttempts}): ${event.type}, Browser: ${browserInfo.isChrome ? 'Chrome' : browserInfo.isFirefox ? 'Firefox' : browserInfo.isSafari ? 'Safari' : 'Other'}`);
    
    // Browser-specific error handling
    if (browserInfo.isChrome) {
      console.log('Chrome-specific error handling');
      if (connectionAttempts >= 2) {
        setErrorMessage('Chrome WebSocket connection failed. Try refreshing the page or switching to Firefox.');
      } else {
        setErrorMessage('Chrome WebSocket connection issue. Retrying...');
      }
    } else if (browserInfo.isSafari) {
      console.log('Safari-specific error handling');
      if (connectionAttempts >= 2) {
        setErrorMessage('Safari WebSocket connection failed. Try refreshing the page or switching to Firefox/Chrome.');
      } else {
        setErrorMessage('Safari WebSocket connection issue. Retrying...');
      }
    } else if (browserInfo.isFirefox) {
      console.log('Firefox-specific error handling');
      if (connectionAttempts >= 3) {
        setErrorMessage('Firefox WebSocket connection failed. Try refreshing the page.');
      } else {
        setErrorMessage('Firefox WebSocket connection issue. Retrying...');
      }
    } else {
      // Generic error handling
      if (isMobile()) {
        console.log('Mobile browser WebSocket error - providing mobile-specific guidance');
        logDebugInfo('Editor', 'Mobile browser WebSocket error');
        if (connectionAttempts >= 2) {
          setIsMobileFallback(true);
          setErrorMessage('Mobile connection unstable. Working in offline mode. Try refreshing or switching to WiFi.');
        } else {
          setErrorMessage('Mobile connection issue. Retrying...');
        }
      } else if (connectionAttempts >= 3) {
        console.log('Enabling fallback mode for unreliable connection');
        logDebugInfo('Editor', 'Enabling fallback mode');
        setIsMobileFallback(true);
        setErrorMessage('Connection unstable. Working in offline mode.');
      } else {
        setErrorMessage(`Connection failed: ${event.type}`);
      }
    }
  });
}; 