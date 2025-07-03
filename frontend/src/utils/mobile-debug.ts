// Mobile debugging utility for WebSocket connectivity testing
// This can be used in mobile browser console to debug WebSocket issues

export interface MobileDebugInfo {
  userAgent: string;
  isMobile: boolean;
  windowSize: { width: number; height: number };
  location: {
    hostname: string;
    host: string;
    protocol: string;
    port: string;
  };
  browserDetection: {
    isChrome: boolean;
    isFirefox: boolean;
    isSafari: boolean;
    isBrave: boolean;
    isEdge: boolean;
  };
  networkInfo: any;
  websocketSupport: boolean;
}

export interface WebSocketTestResult {
  success: boolean;
  error?: string;
  connectionTime?: number;
  url: string;
  readyState?: number;
  browserInfo: MobileDebugInfo;
}

// Enhanced mobile detection (same as main utils)
export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent) ||
         /Mobi|Android/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768);
};

// Browser detection utilities
export const detectBrowser = () => {
  const ua = navigator.userAgent;
  return {
    isChrome: (/Chrome/.test(ua) && !/Edg/.test(ua)) || /Brave/.test(ua) || /CriOS/.test(ua),
    isFirefox: /Firefox/.test(ua),
    isSafari: /Safari/.test(ua) && !/Chrome/.test(ua),
    isBrave: /Brave/.test(ua),
    isEdge: /Edg/.test(ua),
  };
};

// Get comprehensive mobile debug info
export const getMobileDebugInfo = (): MobileDebugInfo => {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  return {
    userAgent: navigator.userAgent,
    isMobile: isMobile(),
    windowSize: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    location: {
      hostname: window.location.hostname,
      host: window.location.host,
      protocol: window.location.protocol,
      port: window.location.port,
    },
    browserDetection: detectBrowser(),
    networkInfo: connection ? {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    } : null,
    websocketSupport: typeof WebSocket !== 'undefined',
  };
};

// Test WebSocket connection with detailed logging
export const testWebSocketConnection = (
  baseUrl: string,
  roomId: string,
  token: string,
  timeout: number = 10000
): Promise<WebSocketTestResult> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const debugInfo = getMobileDebugInfo();
    
    // Construct WebSocket URL using the same logic as the main application
    const wsUrl = debugInfo.isMobile 
      ? `ws://${debugInfo.location.hostname}:3001/api/collab`
      : `ws://localhost:3001/api/collab`;
    
    const fullUrl = `${wsUrl}/${roomId}?token=${encodeURIComponent(token)}`;
    
    console.log('[Mobile Debug] Testing WebSocket connection:', {
      url: fullUrl.replace(token, 'TOKEN_HIDDEN'),
      debugInfo,
    });
    
    if (!debugInfo.websocketSupport) {
      resolve({
        success: false,
        error: 'WebSocket not supported in this browser',
        url: fullUrl,
        browserInfo: debugInfo,
      });
      return;
    }
    
    let ws: WebSocket;
    let resolved = false;
    
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (ws) {
          ws.close();
        }
        resolve({
          success: false,
          error: 'Connection timeout',
          url: fullUrl,
          readyState: ws ? ws.readyState : -1,
          browserInfo: debugInfo,
        });
      }
    }, timeout);
    
    try {
      ws = new WebSocket(fullUrl);
      
      ws.onopen = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          const connectionTime = Date.now() - startTime;
          console.log('[Mobile Debug] WebSocket connection successful in', connectionTime, 'ms');
          ws.close();
          resolve({
            success: true,
            connectionTime,
            url: fullUrl,
            readyState: ws.readyState,
            browserInfo: debugInfo,
          });
        }
      };
      
      ws.onerror = (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          console.error('[Mobile Debug] WebSocket error:', error);
          resolve({
            success: false,
            error: `WebSocket error: ${error.type}`,
            url: fullUrl,
            readyState: ws.readyState,
            browserInfo: debugInfo,
          });
        }
      };
      
      ws.onclose = (event) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          console.log('[Mobile Debug] WebSocket closed:', event.code, event.reason);
          resolve({
            success: false,
            error: `WebSocket closed: ${event.code} - ${event.reason}`,
            url: fullUrl,
            readyState: ws.readyState,
            browserInfo: debugInfo,
          });
        }
      };
      
    } catch (error) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        console.error('[Mobile Debug] WebSocket creation error:', error);
        resolve({
          success: false,
          error: `WebSocket creation error: ${error instanceof Error ? error.message : error}`,
          url: fullUrl,
          browserInfo: debugInfo,
        });
      }
    }
  });
};

// Convenience function for testing with current script
export const testCurrentScript = async (scriptId: string, token: string): Promise<WebSocketTestResult> => {
  const baseUrl = `ws://${window.location.hostname}:3001/api/collab`;
  return testWebSocketConnection(baseUrl, scriptId, token);
};

// Export debug functions to global scope for mobile console access
(window as any).mobileDebug = {
  getMobileDebugInfo,
  testWebSocketConnection,
  testCurrentScript,
  isMobile,
  detectBrowser,
};

console.log('[Mobile Debug] Debug utilities loaded. Available functions:');
console.log('- window.mobileDebug.getMobileDebugInfo()');
console.log('- window.mobileDebug.testWebSocketConnection(baseUrl, roomId, token)');
console.log('- window.mobileDebug.testCurrentScript(scriptId, token)');
console.log('- window.mobileDebug.isMobile()');
console.log('- window.mobileDebug.detectBrowser()'); 