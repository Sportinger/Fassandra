import React, { useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
// 🔧 DISABLED: Offline storage - removed IndexeddbPersistence import
// import { IndexeddbPersistence } from 'y-indexeddb';
import { getScriptWithBlocks } from '../../../api';
import { isYDocEmpty } from '../utils/formatters';
import { convertBlocksToTiptapContent } from '../utils/contentConverters';
import { logDebugInfo, isMobile } from '../../../utils/debug';
import { ConnectionStatus } from '../types';
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

    const currentDoc = new Y.Doc();
    
    // Ensure the 'default' XmlFragment exists immediately (Tiptap's default field name)
    currentDoc.transact(() => {
      currentDoc.getXmlFragment('default'); // This creates it if it doesn't exist
    }, 'initializeDefaultFragment');
    
    console.log('[YJS Debug] Y.Doc created and default fragment initialized');
    setYdoc(currentDoc);

    // 🔧 SECURE ARCHITECTURE: WebSocket through HTTPS Frontend Proxy
    // All traffic (HTTP + WebSocket) goes through frontend SSL termination  
    // Frontend proxy (vite.config.ts) forwards to backend with ws: true enabled
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsBaseUrl = `${wsProtocol}//${window.location.host}/api/collab`;
    
    console.log(`[YJS] ✅ Using Secure Proxy WebSocket URL: ${wsBaseUrl}`);
    console.log(`[YJS] 🔒 WebSocket goes through HTTPS frontend proxy for security`);
    console.log(`[YJS] 🔍 Current location:`, {
      protocol: window.location.protocol,
      host: window.location.host,
      hostname: window.location.hostname,
      port: window.location.port,
      pathname: window.location.pathname,
      wsProtocol: wsProtocol
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
    
    // 🎭 THEATER PRIORITY: Enhanced mobile WebSocket configuration for iPad/iPhone collaboration
    if (browserInfo.isChrome || browserInfo.isSafari || isMobile()) {
      const deviceType = isMobile() ? browserInfo.mobileBrowserType : (browserInfo.isChrome ? 'Chrome' : 'Safari');
      console.log(`[YJS] 🎭 Applying ${deviceType}-optimized WebSocket configuration`);
      logDebugInfo('Editor', `Applying ${deviceType}-optimized WebSocket configuration`);

      // 🎭 THEATER PRIORITY: Enhanced URL construction for mobile browser compatibility
      const cleanToken = token.trim(); // Remove any trailing whitespace/slash
      let wsUrlWithToken = `${wsBaseUrl}/${roomName}?token=${encodeURIComponent(cleanToken)}`;
      
      // 🎭 MOBILE FIX: Special handling for iOS devices that may have WebSocket URL encoding issues
      if (browserInfo.iosVersion && browserInfo.iosVersion.major >= 15) {
        // iOS 15+ has better WebSocket support, use standard encoding
        wsUrlWithToken = `${wsBaseUrl}/${roomName}?token=${encodeURIComponent(cleanToken)}`;
        console.log(`[YJS] 🎭 ${deviceType}: Using iOS 15+ optimized WebSocket URL`);
      } else if (browserInfo.iosVersion && browserInfo.iosVersion.major < 15) {
        // iOS < 15 may have encoding issues, try alternative approach
        wsUrlWithToken = `${wsBaseUrl}/${roomName}?auth_token=${encodeURIComponent(cleanToken)}`;
        console.log(`[YJS] 🎭 ${deviceType}: Using iOS legacy WebSocket URL (iOS ${browserInfo.iosVersion.major})`);
      } else if (browserInfo.isIOSWebView) {
        // iOS WebView (e.g., in-app browsers) may need special handling
        wsUrlWithToken = `${wsBaseUrl}/${roomName}?auth=${cleanToken}`;
        console.log(`[YJS] 🎭 ${deviceType}: Using iOS WebView compatible URL`);
      }
      
      console.log(`[YJS] 🔗 ${deviceType}: Connecting to WebSocket: ${wsUrlWithToken.replace(cleanToken, 'TOKEN_HIDDEN')}`);
      console.log(`[YJS] 🛠️ ${deviceType}: Full WebSocket URL construction:`, {
        baseUrl: wsBaseUrl,
        roomName,
        cleanToken: cleanToken.substring(0, 10) + '...',
        tokenLength: cleanToken.length,
        deviceType: deviceType,
        iosVersion: browserInfo.iosVersion,
        isIOSWebView: browserInfo.isIOSWebView,
        hostname: window.location.hostname,
      });
      console.log(`[YJS] 🚀 ${deviceType}: About to create WebSocketProvider...`);
      logDebugInfo('Editor', `${deviceType}: Connecting to WebSocket with mobile-optimized token handling`);
      
      // 🎭 THEATER PRIORITY: Mobile-optimized connection parameters for rehearsal environments
      const providerConfig = {
        connect: true,
        // Don't use params for mobile browsers - we put the token directly in the URL
        maxBackoffTime: isMobile() ? 
          (browserInfo.mobileBrowserType === 'iPhone' ? 2000 : 3000) : 8000, // Faster retry for iPhone
        resyncInterval: isMobile() ? 
          (browserInfo.mobileBrowserType === 'iPad' ? 6000 : 8000) : 12000, // More frequent sync for mobile
        // 🎭 NEW: Mobile-specific timeouts for theater rehearsal environments
        connectTimeout: isMobile() ? 10000 : 15000, // Shorter timeout for mobile
        maxReconnectAttempts: isMobile() ? 8 : 5, // More attempts for mobile (network instability)
      };

      try {
        console.log(`[YJS] 🔨 ${deviceType}: Creating WebSocketProvider with config:`, providerConfig);
        const currentProvider = new WebsocketProvider(wsUrlWithToken, '', currentDoc, providerConfig);
        console.log(`[YJS] ✅ ${deviceType}: WebSocket provider created successfully with token in URL`);
        console.log(`[YJS] 🔧 ${deviceType}: Setting up WebSocket provider handlers...`);
        setupWebSocketProviderHandlers(currentProvider, browserInfo, setStatus, setErrorMessage, setIsMobileFallback);
        console.log(`[YJS] 📡 ${deviceType}: Setting provider state...`);
        setProvider(currentProvider);
        console.log(`[YJS] 🎉 ${deviceType}: WebSocket setup complete!`);
      } catch (error) {
        console.error(`[YJS] ❌ ${deviceType}: Failed to create WebSocket provider with token in URL:`, error);
        setErrorMessage(`${deviceType} WebSocket connection failed. You can still edit locally.`);
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
      
      // 🔧 DISABLED: Offline storage - removed persistence cleanup
      // if (persistenceRef.current) {
      //   persistenceRef.current.destroy();
      //   persistenceRef.current = null;
      // }
      
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
      // 🎭 THEATER PRIORITY: Enhanced mobile error handling for rehearsal environments
      if (isMobile()) {
        const deviceType = (browserInfo as any).mobileBrowserType || 'Mobile Device';
        console.log(`🎭 ${deviceType} WebSocket error - providing theater-specific guidance`);
        logDebugInfo('Editor', `${deviceType} WebSocket error (attempt ${connectionAttempts})`);
        
        if (connectionAttempts >= 3) {
          setIsMobileFallback(true);
          // 🎭 THEATER GUIDANCE: Specific troubleshooting for mobile rehearsal scenarios
          if (deviceType === 'iPhone' || deviceType === 'iPad') {
            setErrorMessage(`🎭 ${deviceType} connection unstable. Working offline. Tip: Try switching from cellular to WiFi, or close other apps using internet.`);
          } else if (deviceType.includes('Android')) {
            setErrorMessage(`🎭 ${deviceType} connection unstable. Working offline. Tip: Try enabling "Desktop site" mode or clearing browser cache.`);
          } else {
            setErrorMessage('🎭 Mobile connection unstable. Working in offline mode. Try refreshing or switching to WiFi.');
          }
        } else if (connectionAttempts === 2) {
          // 🎭 THEATER GUIDANCE: Second attempt - provide specific help
          if (deviceType === 'iPhone' || deviceType === 'iPad') {
            setErrorMessage(`🎭 ${deviceType}: Connection issue. Checking iOS Safari compatibility... (attempt ${connectionAttempts})`);
          } else {
            setErrorMessage(`🎭 ${deviceType}: Connection issue. Checking mobile browser compatibility... (attempt ${connectionAttempts})`);
          }
        } else {
          setErrorMessage(`🎭 ${deviceType}: Connecting to rehearsal session... (attempt ${connectionAttempts})`);
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