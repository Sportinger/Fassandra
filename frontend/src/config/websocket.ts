// WebSocket configuration
export const getWebSocketUrl = (scriptId: string, token: string): string => {
  // Use dedicated WebSocket port 3002 (bypassing nginx completely)
  const wsHost = window.location.hostname === 'localhost' 
    ? 'localhost:3001'  // Local development
    : 'mylayer.org:3002'; // Production - dedicated WS port
  
  const wsProtocol = window.location.hostname === 'localhost' ? 'ws:' : 'wss:';
  
  // For production, we'll use ws:// on port 3002 (no SSL)
  // This bypasses nginx completely
  if (window.location.hostname !== 'localhost') {
    return `ws://${window.location.hostname}:3002/api/collab/${scriptId}?token=${encodeURIComponent(token)}`;
  }
  
  return `${wsProtocol}//${wsHost}/api/collab/${scriptId}?token=${encodeURIComponent(token)}`;
};