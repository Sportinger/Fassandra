import React, { useState, useEffect } from 'react';
import { getNetworkInfo, testNetworkConnectivity, getDebugLog, clearDebugLog, isMobile } from '../utils/debug';
import { useAuth } from '../AuthContext';
import styles from './MobileDebug.module.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const MobileDebugPanel: React.FC = () => {
  const { token, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [connectivity, setConnectivity] = useState<any>(null);
  const [debugLog, setDebugLog] = useState<Array<{timestamp: string, prefix: string, info: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Show debug panel automatically on mobile
    if (isMobile()) {
      setNetworkInfo(getNetworkInfo());
      setDebugLog(getDebugLog());
    }
  }, []);

  const runConnectivityTest = async () => {
    setIsLoading(true);
    try {
      const result = await testNetworkConnectivity(API_BASE_URL, token || undefined);
      setConnectivity(result);
    } catch (error) {
      setConnectivity({
        api: false,
        auth: false,
        websocket: false,
        apiError: error instanceof Error ? error.message : 'Unknown error',
        authError: 'Test failed',
        wsError: 'Test failed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDebugLog = () => {
    setDebugLog(getDebugLog());
  };

  const clearLogs = () => {
    clearDebugLog();
    setDebugLog([]);
  };

  if (!isMobile()) {
    return null; // Only show on mobile
  }

  return (
    <div className={styles.debugPanel}>
      <button 
        className={styles.debugToggle}
        onClick={() => setIsOpen(!isOpen)}
      >
        🐛 Debug {isOpen ? '✕' : '📱'}
      </button>
      
      {isOpen && (
        <div className={styles.debugContent}>
          <div className={styles.section}>
            <h3>Network Info</h3>
            {networkInfo && (
              <div className={styles.info}>
                <div><strong>Mobile:</strong> {networkInfo.isMobile ? 'Yes' : 'No'}</div>
                <div><strong>Online:</strong> {networkInfo.online ? 'Yes' : 'No'}</div>
                <div><strong>Platform:</strong> {networkInfo.platform}</div>
                <div><strong>API URL:</strong> {API_BASE_URL}</div>
                <div><strong>WS URL:</strong> {API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://')}/api/collab</div>
                <div><strong>User:</strong> {user ? user.username : 'Not logged in'}</div>
                <div><strong>Token:</strong> {token ? 'YES' : 'NO'}</div>
                {networkInfo.connection && (
                  <div><strong>Connection:</strong> {networkInfo.connection.effectiveType || 'Unknown'}</div>
                )}
              </div>
            )}
          </div>

          <div className={styles.section}>
            <h3>Connectivity Test</h3>
            <button onClick={runConnectivityTest} disabled={isLoading}>
              {isLoading ? 'Testing...' : 'Test Connection'}
            </button>
            {connectivity && (
              <div className={styles.connectivity}>
                <div className={connectivity.api ? styles.success : styles.error}>
                  API: {connectivity.api ? '✓ Working' : '✗ Failed'}
                  {connectivity.apiError && <div className={styles.errorDetail}>{connectivity.apiError}</div>}
                </div>
                <div className={connectivity.auth ? styles.success : styles.error}>
                  Auth: {connectivity.auth ? '✓ Working' : '✗ Failed'}
                  {connectivity.authError && <div className={styles.errorDetail}>{connectivity.authError}</div>}
                </div>
                <div className={connectivity.websocket ? styles.success : styles.error}>
                  WebSocket: {connectivity.websocket ? '✓ Working' : '✗ Failed'}
                  {connectivity.wsError && <div className={styles.errorDetail}>{connectivity.wsError}</div>}
                </div>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <h3>Debug Log</h3>
            <div className={styles.logControls}>
              <button onClick={refreshDebugLog}>Refresh</button>
              <button onClick={clearLogs}>Clear</button>
            </div>
            <div className={styles.logContainer}>
              {debugLog.slice(-10).map((entry, index) => (
                <div key={index} className={styles.logEntry}>
                  <div className={styles.logTime}>{new Date(entry.timestamp).toLocaleTimeString()}</div>
                  <div className={styles.logPrefix}>[{entry.prefix}]</div>
                  <div className={styles.logInfo}>{entry.info}</div>
                </div>
              ))}
              {debugLog.length === 0 && (
                <div className={styles.noLogs}>No debug logs yet</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 