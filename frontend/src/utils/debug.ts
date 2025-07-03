// Debug utilities for mobile browser troubleshooting

export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent) ||
         /Mobi|Android/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768); // Fallback for devices that might not match user agent patterns
};

export const getNetworkInfo = () => {
  const info = {
    userAgent: navigator.userAgent,
    isMobile: isMobile(),
    online: navigator.onLine,
    connection: (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection,
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    hardwareConcurrency: navigator.hardwareConcurrency,
    maxTouchPoints: navigator.maxTouchPoints,
    deviceMemory: (navigator as any).deviceMemory,
  };
  
  return info;
};

export const testNetworkConnectivity = async (baseUrl: string, token?: string): Promise<{
  api: boolean;
  auth: boolean;
  websocket: boolean;
  apiError?: string;
  authError?: string;
  wsError?: string;
}> => {
  const result = {
    api: false,
    auth: false,
    websocket: false,
    apiError: undefined as string | undefined,
    authError: undefined as string | undefined,
    wsError: undefined as string | undefined,
  };

  // Test basic API connectivity
  try {
    const response = await fetch(`${baseUrl}/api/scripts`, {
      method: 'HEAD', // Use HEAD to minimize data transfer
      mode: 'cors',
    });
    result.api = response.status < 500; // Even 401/404 means API is reachable
  } catch (error) {
    result.api = false;
    result.apiError = error instanceof Error ? error.message : 'Unknown API error';
  }

  // Test authenticated API access if token provided
  if (token) {
    try {
      const response = await fetch(`${baseUrl}/api/scripts`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      result.auth = response.status === 200;
      if (!result.auth) {
        result.authError = `Auth failed: ${response.status} ${response.statusText}`;
      }
    } catch (error) {
      result.auth = false;
      result.authError = error instanceof Error ? error.message : 'Unknown auth error';
    }
  }

  // Test WebSocket connectivity
  try {
    const wsUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const ws = new WebSocket(`${wsUrl}/api/collab/test`);
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        result.websocket = true;
        ws.close();
        resolve();
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        result.websocket = false;
        result.wsError = 'WebSocket connection failed';
        reject(error);
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (!result.websocket) {
          result.wsError = `WebSocket closed: ${event.code} - ${event.reason}`;
          reject(new Error(result.wsError));
        }
      };
    });
  } catch (error) {
    result.websocket = false;
    if (!result.wsError) {
      result.wsError = error instanceof Error ? error.message : 'Unknown WebSocket error';
    }
  }

  return result;
};

export const logDebugInfo = (prefix: string, info: any) => {
  if (isMobile()) {
    // On mobile, we might not have access to console, so store in sessionStorage
    const debugLog = JSON.parse(sessionStorage.getItem('debugLog') || '[]');
    debugLog.push({
      timestamp: new Date().toISOString(),
      prefix,
      info: typeof info === 'string' ? info : JSON.stringify(info),
    });
    // Keep only last 50 entries
    if (debugLog.length > 50) {
      debugLog.splice(0, debugLog.length - 50);
    }
    sessionStorage.setItem('debugLog', JSON.stringify(debugLog));
  }
  
  console.log(`[${prefix}]`, info);
};

export const getDebugLog = (): Array<{timestamp: string, prefix: string, info: string}> => {
  return JSON.parse(sessionStorage.getItem('debugLog') || '[]');
};

export const clearDebugLog = () => {
  sessionStorage.removeItem('debugLog');
}; 