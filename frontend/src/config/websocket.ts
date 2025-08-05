// WebSocket configuration
export const getWebSocketUrl = (scriptId: string, token: string): string => {
  // Always use the same host/port as the main site (through Caddy proxy)
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.host; // This includes hostname:port if any
  
  // WebSocket goes through the same Caddy proxy as everything else
  return `${wsProtocol}//${wsHost}/api/collab/${scriptId}?token=${encodeURIComponent(token)}`;
};