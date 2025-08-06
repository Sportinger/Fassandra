import React, { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
// 🔧 DISABLED: Offline storage - removed IndexeddbPersistence import
// import { IndexeddbPersistence } from 'y-indexeddb';
import { getScriptWithBlocks } from '../../../api';
import { isYDocEmpty } from '../utils/formatters';
import { convertBlocksToTiptapContent } from '../utils/contentConverters';
import { logDebugInfo, isMobile } from '../../../utils/debug';
import { ConnectionStatus } from '../types';
import { getWebSocketUrl } from '../../../config/websocket';
import { yjsDocumentManager } from '../../../services/yjsDocumentManager';
// Removed mobile debug utilities - development utility
// Removed console forwarder - development utility

// Helper function to detect Chrome browser (including mobile Chrome and iOS Chrome)
const isChrome = () => {
  const userAgent = navigator.userAgent;
  return (/Chrome/.test(userAgent) && !/Edg/.test(userAgent)) || 
         /Brave/.test(userAgent) || 
         /CriOS/.test(userAgent); // Chrome on iOS
};

// Helper function to detect Firefox browser
const isFirefox = () => {
  return /Firefox/.test(navigator.userAgent) || /FxiOS/.test(navigator.userAgent); // Firefox on iOS
};

// Helper function to detect Safari browser (including mobile Safari)
const isSafari = () => {
  const userAgent = navigator.userAgent;
  // 🎭 THEATER PRIORITY: Enhanced mobile Safari detection for iPads/iPhones
  const isMobileSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && /Mobile/.test(userAgent);
  const isDesktopSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/Mobile/.test(userAgent);
  const isIOSWebView = /AppleWebKit/.test(userAgent) && !/Safari/.test(userAgent) && /Mobile/.test(userAgent);
  
  return isMobileSafari || isDesktopSafari || isIOSWebView;
};

// 🎭 NEW: Enhanced mobile browser detection for theater professionals
const getMobileBrowserType = () => {
  const userAgent = navigator.userAgent;
  
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPod/.test(userAgent)) return 'iPod';
  if (/Android/.test(userAgent) && /Mobile/.test(userAgent)) return 'Android Mobile';
  if (/Android/.test(userAgent) && /Tablet/.test(userAgent)) return 'Android Tablet';
  if (/Android/.test(userAgent)) return 'Android';
  
  return 'Mobile Device';
};

// 🎭 NEW: iOS version detection for WebSocket compatibility
const getIOSVersion = () => {
  const userAgent = navigator.userAgent;
  const match = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
  if (match) {
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3] || '0', 10)
    };
  }
  return null;
};

interface UseYjsConnectionProps {
  scriptId: string;
  user: any;
  token: string;
  // ydoc: Y.Doc | null; // Not used directly in this hook
  setYdoc: (doc: Y.Doc | null) => void;
  // provider: WebsocketProvider | null; // Not used directly in this hook
  setProvider: (provider: WebsocketProvider | null) => void;
  // 🔧 DISABLED: Offline storage - removed persistenceRef
  // persistenceRef: React.MutableRefObject<IndexeddbPersistence | null>;
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
  // 🔧 DISABLED: Offline storage - removed persistenceRef parameter
  // persistenceRef,
  status: _status,
  setStatus,
  setErrorMessage,
  setScriptTitle,
  setScriptCreationDate,
  setPendingContent,
  setIsMobileFallback,
}: UseYjsConnectionProps) => {
  // Track the current provider to clean it up properly
  const providerRef = useRef<WebsocketProvider | null>(null);
  
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
      // 🎭 THEATER PRIORITY: Enhanced mobile browser detection for iPad/iPhone users
      mobileBrowserType: isMobile() ? getMobileBrowserType() : 'Desktop',
      iosVersion: isMobile() && /iOS|iPhone|iPad|iPod/.test(navigator.userAgent) ? getIOSVersion() : null,
      isIOSWebView: /AppleWebKit/.test(navigator.userAgent) && !/Safari/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent),
    };

    console.log(`[YJS] 🚀 Initializing Yjs/Provider for script: ${scriptId}, user: ${user.username} (${user.id})`);
    console.log('[YJS] Enhanced browser info:', browserInfo);
    console.log('[YJS] 🎭 Theater mobile detection:', {
      isMobile: isMobile(),
      mobileBrowserType: browserInfo.mobileBrowserType,
      iosVersion: browserInfo.iosVersion,
      isIOSWebView: browserInfo.isIOSWebView,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      hostname: window.location.hostname,
      host: window.location.host,
    });
    console.log('[YJS] Initializing connection...');
    
    // 🎭 THEATER PRIORITY: Enhanced mobile debug logging for field troubleshooting
    if (isMobile()) {
      console.log(`[YJS] 🎭 ${browserInfo.mobileBrowserType} device detected - enabling theater-optimized WebSocket configuration`);
      logDebugInfo('Editor', `Theater Mobile Setup: ${browserInfo.mobileBrowserType}, iOS: ${browserInfo.iosVersion ? browserInfo.iosVersion.major + '.' + browserInfo.iosVersion.minor : 'N/A'}`);
    }
    
    logDebugInfo('Editor', `Initializing Yjs/Provider for script: ${scriptId}, user: ${user.username} (${user.id}), browser: ${browserInfo.isChrome ? 'Chrome' : browserInfo.isFirefox ? 'Firefox' : browserInfo.isSafari ? 'Safari' : 'Other'}, mobile: ${browserInfo.isMobile}`);
    setStatus('connecting');
    setErrorMessage(null);

    // 🔧 FIX: Use document manager to get persistent document instance
    const currentDoc = yjsDocumentManager.getDocument(scriptId);
    const docInfo = yjsDocumentManager.getDocumentInfo(scriptId);
    
    console.log('[YJS Debug] Using persistent Y.Doc from manager:', {
      scriptId,
      clientID: currentDoc.clientID,
      refCount: docInfo.refCount,
      isNew: docInfo.refCount === 1
    });
    
    setYdoc(currentDoc);

    // 🔧 SECURE ARCHITECTURE: WebSocket through HTTPS Frontend Proxy
    // All traffic (HTTP + WebSocket) goes through frontend SSL termination  
    // Frontend proxy (vite.config.ts) forwards to backend with ws: true enabled
    
    // 🔧 FIX: Check if we're in a Capacitor app context and use configured backend URL
    const isCapacitorApp = window.location.protocol === 'capacitor:' || 
                           window.location.protocol === 'ionic:' ||
                           (window as any).Capacitor !== undefined;
    
    let wsBaseUrl: string;
    
    if (isCapacitorApp) {
      // In Capacitor app, use the configured backend URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://mylayer.org';
      
      // Extract host from API base URL and construct WebSocket URL
      const url = new URL(apiBaseUrl);
      const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      wsBaseUrl = `${wsProtocol}//${url.host}/api/collab`;
      
      console.log(`[YJS] 📱 Capacitor app detected - using backend: ${wsBaseUrl}`);
      logDebugInfo('Editor', `Capacitor app WebSocket URL: ${wsBaseUrl}`);
    } else {
      // In browser, use relative URLs based on current location
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsBaseUrl = `${wsProtocol}//${window.location.host}/api/collab`;
      
      console.log(`[YJS] 🌐 Browser context - using relative URL: ${wsBaseUrl}`);
    }
    
    console.log(`[YJS] ✅ Using Dedicated WebSocket Port: ${wsBaseUrl}`);
    console.log(`[YJS] 🔒 Direct WebSocket connection (bypassing nginx)`);
    console.log(`[YJS] 🔍 Current location:`, {
      protocol: window.location.protocol,
      host: window.location.host,
      hostname: window.location.hostname,
      port: window.location.port,
      pathname: window.location.pathname,
      wsBaseUrl: wsBaseUrl
    });
    logDebugInfo('Editor', `WebSocket Base URL: ${wsBaseUrl} (via secure frontend proxy)`);

    // 🔧 DISABLED: Offline storage - always fetch from backend instead of IndexedDB
    console.log(`[YJS] Skipping IndexedDB persistence - always fetching from backend`);
    
    // Always fetch content from backend since we disabled offline storage
    if (token) {
      console.log(`[Editor Fetch] Fetching initial content for script ${scriptId} from backend`);
      getScriptWithBlocks(scriptId)
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
      console.log(`[Editor Fetch] No token available for fetching content`);
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

    // 🔧 DISABLED: Offline storage - removed persistence event handler
    console.log(`[YJS] Skipping persistence event handler - content already fetched from backend`);

    // Set up WebSocket provider with auth and mobile fallback
    const roomName = scriptId;
    let currentProvider: WebsocketProvider | null = null;
    let cleanupHandlers: (() => void) | null = null;
    
    // 🎭 UNIFIED WebSocket configuration for all platforms
    // FIX: Use the same initialization for both mobile and desktop
    const deviceType = isMobile() ? 'Mobile' : (browserInfo.isChrome ? 'Chrome' : (browserInfo.isSafari ? 'Safari' : 'Browser'));
    console.log(`[YJS] 🎭 ${deviceType}: Initializing WebSocket connection`);
    logDebugInfo('Editor', `${deviceType}: Initializing WebSocket connection`);

    // Clean token for all platforms
    const cleanToken = token.trim();
    
    console.log(`[YJS] 🔗 ${deviceType}: Connecting to WebSocket`);
    console.log(`[YJS] 🛠️ ${deviceType}: Connection details:`, {
      baseUrl: wsBaseUrl,
      roomName,
      tokenLength: cleanToken.length,
      deviceType: deviceType,
      isMobile: isMobile(),
      hostname: window.location.hostname,
    });
    
    // Unified configuration for all platforms
    const providerConfig = {
      connect: true,
      // Pass token in params for ALL platforms (mobile AND desktop)
      params: { token: cleanToken },
      // Optimize timeouts based on platform
      maxBackoffTime: isMobile() ? 3000 : 5000,
      resyncInterval: isMobile() ? 5000 : 10000, // Faster resync for mobile
      connectTimeout: isMobile() ? 10000 : 15000,
      maxReconnectAttempts: isMobile() ? 8 : 5,
    };

    try {
      console.log(`[YJS] 🔨 ${deviceType}: Creating WebSocketProvider with unified config:`, providerConfig);
      
      // CRITICAL FIX: Use the SAME initialization for ALL platforms
      // Pass base URL, room name, document, and config with token in params
      currentProvider = new WebsocketProvider(wsBaseUrl, roomName, currentDoc, providerConfig);
      
      console.log(`[YJS] ✅ ${deviceType}: WebSocket provider created successfully`);
      console.log(`[YJS] 🔧 ${deviceType}: Setting up WebSocket provider handlers...`);
      
      cleanupHandlers = setupWebSocketProviderHandlers(currentProvider, browserInfo, setStatus, setErrorMessage, setIsMobileFallback);
      
      console.log(`[YJS] 📡 ${deviceType}: Setting provider state...`);
      setProvider(currentProvider);
      console.log(`[YJS] 🎉 ${deviceType}: WebSocket setup complete!`);
      
    } catch (error) {
      console.error(`[YJS] ❌ ${deviceType}: Failed to create WebSocket provider:`, error);
      setErrorMessage(`${deviceType} WebSocket connection failed. You can still edit locally.`);
      setStatus('disconnected');
      // Don't set provider to null - let editor work in local mode
      setProvider(null);
      const wsParams = { token: cleanToken };
      
      console.log(`Connecting to WebSocket: ${wsBaseUrl}/${roomName} with params:`, wsParams);
      logDebugInfo('Editor', `Connecting to WebSocket: ${wsBaseUrl}/${roomName} - Firefox/other`);
      
      const providerConfig = {
        connect: true,
        params: wsParams,
        maxBackoffTime: 10000,
        resyncInterval: 15000,
      };

      currentProvider = new WebsocketProvider(wsBaseUrl, roomName, currentDoc, providerConfig);
      cleanupHandlers = setupWebSocketProviderHandlers(currentProvider, browserInfo, setStatus, setErrorMessage, setIsMobileFallback);
      setProvider(currentProvider);
    }

    logDebugInfo('Editor', 'WebSocket provider created with browser-specific options');

    // Store provider ref for cleanup
    providerRef.current = currentProvider;
    
    // Add page unload handler to immediately close WebSocket
    const handleBeforeUnload = () => {
      console.log('[YJS] Page unloading - closing WebSocket immediately');
      if (providerRef.current && providerRef.current.ws) {
        // Send close frame immediately to notify backend
        providerRef.current.ws.close(1000, 'Page unload');
      }
    };
    
    // Register unload handler
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup function
    return () => {
      console.log("Cleaning up WebSocket provider (keeping Yjs doc persistent)...");
      logDebugInfo('Editor', 'Cleaning up WebSocket provider (keeping doc)');
      
      // Remove unload handler
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Clean up heartbeat and other handlers
      if (cleanupHandlers) {
        cleanupHandlers();
        cleanupHandlers = null;
      }
      
      // 🔧 DISABLED: Offline storage - removed persistence cleanup
      // if (persistenceRef.current) {
      //   persistenceRef.current.destroy();
      //   persistenceRef.current = null;
      // }
      
      // 🔧 FIX: Only destroy provider, NOT the document (keep it persistent)
      if (providerRef.current) {
        console.log('[YJS] Destroying WebSocket provider, but keeping document');
        // Explicitly close WebSocket before destroying provider
        if (providerRef.current.ws) {
          providerRef.current.ws.close(1000, 'Component unmount');
        }
        providerRef.current.destroy();
        providerRef.current = null;
      }
      
      // 🔧 FIX: Release document reference but don't destroy it
      if (scriptId) {
        yjsDocumentManager.releaseDocument(scriptId);
        const docInfo = yjsDocumentManager.getDocumentInfo(scriptId);
        console.log('[YJS] Released document reference:', {
          scriptId,
          remainingRefCount: docInfo.refCount,
          stillExists: docInfo.exists
        });
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

  // Heartbeat mechanism to keep connection alive
  let heartbeatInterval: NodeJS.Timeout | null = null;
  
  const startHeartbeat = () => {
    // Clear any existing heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    // Send awareness update every 10 seconds to keep connection alive
    heartbeatInterval = setInterval(() => {
      if (provider.wsconnected) {
        // Send a minimal awareness update as heartbeat
        // This triggers the awareness protocol which keeps the connection active
        const awareness = provider.awareness;
        const localState = awareness.getLocalState();
        
        // Only send if we have a local state
        if (localState) {
          // Trigger awareness update by setting the same state
          // This is lightweight and keeps the connection alive
          awareness.setLocalState(localState);
          console.log('[YJS] 💓 Heartbeat sent (awareness update)');
        }
      }
    }, 10000); // Every 10 seconds (well below the 30-second timeout)
    
    console.log('[YJS] 💓 Heartbeat started (10s interval)');
  };
  
  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
      console.log('[YJS] 💔 Heartbeat stopped');
    }
  };

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
      // Clear any lingering error messages
      setErrorMessage(null);
      // Show success message briefly for mobile users
      if (browserInfo.isMobile) {
        setErrorMessage('Mobile connection established!');
        setTimeout(() => setErrorMessage(null), 2000);
      }
      // Start heartbeat when connected
      startHeartbeat();
    } else if (newStatus === 'disconnected') {
      // Handle disconnection - important for mobile debugging
      if (browserInfo.isMobile) {
        setErrorMessage('Mobile connection lost. Retrying...');
      }
      // Stop heartbeat when disconnected
      stopHeartbeat();
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
    
    // Browser-specific error handling - increased thresholds to reduce false positives
    if (browserInfo.isChrome) {
      console.log('Chrome-specific error handling');
      if (connectionAttempts >= 5) {
        setErrorMessage('Chrome WebSocket connection failed. Try refreshing the page or switching to Firefox.');
      } else if (connectionAttempts >= 3) {
        setErrorMessage(`Chrome WebSocket struggling to connect (attempt ${connectionAttempts}/5). Still trying...`);
      } else {
        setErrorMessage('Chrome WebSocket connecting...');
      }
    } else if (browserInfo.isSafari) {
      console.log('Safari-specific error handling');
      if (connectionAttempts >= 5) {
        setErrorMessage('Safari WebSocket connection failed. Try refreshing the page or switching to Firefox/Chrome.');
      } else if (connectionAttempts >= 3) {
        setErrorMessage(`Safari WebSocket struggling to connect (attempt ${connectionAttempts}/5). Still trying...`);
      } else {
        setErrorMessage('Safari WebSocket connecting...');
      }
    } else if (browserInfo.isFirefox) {
      console.log('Firefox-specific error handling');
      if (connectionAttempts >= 6) {
        setErrorMessage('Firefox WebSocket connection failed. Try refreshing the page.');
      } else if (connectionAttempts >= 3) {
        setErrorMessage(`Firefox WebSocket reconnecting (attempt ${connectionAttempts}/6)...`);
      } else {
        setErrorMessage('Firefox WebSocket connecting...');
      }
    } else {
      // 🎭 THEATER PRIORITY: Enhanced mobile error handling for rehearsal environments
      if (isMobile()) {
        const deviceType = (browserInfo as any).mobileBrowserType || 'Mobile Device';
        console.log(`🎭 ${deviceType} WebSocket error - providing theater-specific guidance`);
        logDebugInfo('Editor', `${deviceType} WebSocket error (attempt ${connectionAttempts})`);
        
        if (connectionAttempts >= 8) {  // Increased from 3 to 8 for mobile
          setIsMobileFallback(true);
          // 🎭 THEATER GUIDANCE: Specific troubleshooting for mobile rehearsal scenarios
          if (deviceType === 'iPhone' || deviceType === 'iPad') {
            setErrorMessage(`🎭 ${deviceType} connection unstable. Working offline. Tip: Try switching from cellular to WiFi, or close other apps using internet.`);
          } else if (deviceType.includes('Android')) {
            setErrorMessage(`🎭 ${deviceType} connection unstable. Working offline. Tip: Try enabling "Desktop site" mode or clearing browser cache.`);
          } else {
            setErrorMessage('🎭 Mobile connection unstable. Working in offline mode. Try refreshing or switching to WiFi.');
          }
        } else if (connectionAttempts >= 5) {  // Changed from === 2
          // 🎭 THEATER GUIDANCE: Second attempt - provide specific help
          if (deviceType === 'iPhone' || deviceType === 'iPad') {
            setErrorMessage(`🎭 ${deviceType}: Connection issue. Checking iOS Safari compatibility... (attempt ${connectionAttempts})`);
          } else {
            setErrorMessage(`🎭 ${deviceType}: Connection issue. Checking mobile browser compatibility... (attempt ${connectionAttempts})`);
          }
        } else {
          // Only show connecting message for first 2 attempts
          if (connectionAttempts <= 2) {
            setErrorMessage(`🎭 ${deviceType}: Connecting to rehearsal session... (attempt ${connectionAttempts})`);
          }
        }
      } else if (connectionAttempts >= 7) {  // Increased from 3 to 7 for desktop
        console.log('Enabling fallback mode for unreliable connection');
        logDebugInfo('Editor', 'Enabling fallback mode');
        setIsMobileFallback(true);
        setErrorMessage('Connection unstable. Working in offline mode.');
      } else if (connectionAttempts >= 4) {
        setErrorMessage(`Connection struggling (attempt ${connectionAttempts}/7). Still trying...`);
      } else {
        setErrorMessage(`Connecting (attempt ${connectionAttempts})...`);
      }
    }
  });
  
  // Return cleanup function for the heartbeat
  return () => {
    stopHeartbeat();
  };
}; 