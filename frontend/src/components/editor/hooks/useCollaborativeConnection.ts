import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import logger from '../../../services/LoggingService';
import { yjsDocumentManager } from '../../../services/yjsDocumentManager';
import { getScriptWithYjs, getYjsState, getYjsUpdates } from '../../../api';
import type { ConnectionStatus, UseEditorCoreProps } from '../types';

interface UseCollaborativeConnectionArgs extends UseEditorCoreProps {
  token: string | null;
  wsBaseUrl: string;
  debugLog: (message: string, ...extra: any[]) => void;
}

interface UseCollaborativeConnectionResult {
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  connectionStatus: ConnectionStatus;
  errorMessage: string | null;
  activeUserCount: number;
}

export const useCollaborativeConnection = ({
  scriptId,
  user,
  hasToken,
  token,
  wsBaseUrl,
  debugLog,
}: UseCollaborativeConnectionArgs): UseCollaborativeConnectionResult => {
  const stableScriptId = useMemo(() => scriptId, [scriptId]);
  const stableUser = useMemo(() => user, [user]);
  const stableHasToken = useMemo(() => hasToken, [hasToken]);
  const stableToken = useMemo(() => token, [token]);

  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeUserCount, setActiveUserCount] = useState<number>(0);

  const providerRef = useRef<WebsocketProvider | null>(null);
  const previousScriptIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (providerRef.current && previousScriptIdRef.current === stableScriptId) {
      debugLog(`[Editor Core] Skipping re-initialization for script: ${stableScriptId}`);
      return;
    }

    if (!stableScriptId || !stableUser || !stableHasToken || !stableToken) {
      setConnectionStatus('authenticating');
      return;
    }

    logger.info('useEditorCore', `[EDITOR_INIT] Initializing for script: ${stableScriptId}, user: ${stableUser.username}`);

    const isScriptChange = previousScriptIdRef.current !== null && previousScriptIdRef.current !== stableScriptId;
    previousScriptIdRef.current = stableScriptId;

    const doc = yjsDocumentManager.getDocument(stableScriptId, isScriptChange);
    const docInfo = yjsDocumentManager.getDocumentInfo(stableScriptId);

    logger.info('useEditorCore', `[EDITOR_DOC] Using persistent Y.Doc from manager:`, {
      scriptId: stableScriptId,
      clientID: doc.clientID,
      refCount: docInfo.refCount,
      isNew: docInfo.refCount === 1,
    });

    const defaultField = doc.getXmlFragment('default');
    logger.info('useEditorCore', `[EDITOR_DOC_STATE] Initial document state:`, {
      defaultFieldExists: !!defaultField,
      defaultFieldLength: defaultField.length,
      defaultFieldType: defaultField.constructor.name,
    });

    setYdoc(doc);
    debugLog(`[Editor Core] Skipping IndexedDB persistence - always fetching from backend`);

    const initializeWebSocket = async () => {
      let wsToken = stableToken;
      if (stableToken === 'authenticated') {
        try {
          const response = await fetch('/api/ws-token', { credentials: 'include' });
          if (response.ok) {
            const data = await response.json();
            wsToken = data.token;
          } else {
            logger.error('useEditorCore', '[Editor Core] Failed to get WebSocket token:', response.status);
          }
        } catch (error) {
          logger.error('useEditorCore', '[Editor Core] Error fetching WebSocket token:', error);
        }
      }

      let websocketProvider: WebsocketProvider;
      try {
        const originalError = window.onerror;
        const originalUnhandledRejection = window.onunhandledrejection;

        window.onerror = (message, source, lineno, colno, error) => {
          if (message && message.toString().includes('Unexpected end of array')) {
            logger.error('useEditorCore', '[YJS_DECODE_ERROR] YJS decode error caught:', {
              message,
              source,
              error: error?.toString(),
            });
            return true;
          }
          if (originalError) {
            return originalError.call(window, message, source as string, lineno ?? 0, colno ?? 0, error as Error);
          }
          return false;
        };

        window.onunhandledrejection = (event) => {
          if (event.reason && event.reason.message && event.reason.message.includes('Unexpected end of array')) {
            logger.error('useEditorCore', '[YJS_DECODE_ERROR] YJS decode error in promise:', {
              reason: event.reason.message,
              stack: event.reason.stack,
            });
            event.preventDefault();
            return;
          }
          if (originalUnhandledRejection) {
            return originalUnhandledRejection.call(window, event);
          }
        };

        let bootstrapped = false;
        try {
          try {
            const baseUrl = (await import('../../../services/ApiService')).apiService.getBaseUrl();
            await fetch(`${baseUrl}/api/me`, { credentials: 'include' });
          } catch {}

          const stateBuffer = await getYjsState(stableScriptId);
          const state = new Uint8Array(stateBuffer);
          if (state.byteLength > 0) {
            Y.applyUpdate(doc, state);
            bootstrapped = true;
            logger.info('useEditorCore', '[BOOTSTRAP] Applied server Yjs state', { bytes: state.byteLength });
          } else {
            logger.info('useEditorCore', '[BOOTSTRAP] Server Yjs state empty');
          }
        } catch (e) {
          logger.warn('useEditorCore', '[BOOTSTRAP] Binary state fetch failed, will fallback:', e);
        }

        if (!bootstrapped) {
          try {
            const scriptData: any = await getScriptWithYjs(stableScriptId);
            const b64 = scriptData?.yjs_state as string | undefined;
            if (b64 && b64.length > 0) {
              const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
              if (bytes.byteLength > 0) {
                Y.applyUpdate(doc, bytes);
                bootstrapped = true;
                logger.info('useEditorCore', '[BOOTSTRAP] Applied base64 Yjs state from /api/scripts/:id');
              }
            }
          } catch (e) {
            logger.error('useEditorCore', '[BOOTSTRAP] Fallback base64 state fetch failed:', e);
          }
        }

        try {
          const updatesResp = await getYjsUpdates(stableScriptId);
          if (updatesResp && Array.isArray(updatesResp.updates)) {
            let applied = 0;
            for (const u of updatesResp.updates) {
              if (u?.data) {
                const bytes = Uint8Array.from(atob(u.data), (c) => c.charCodeAt(0));
                if (bytes.byteLength > 0) {
                  try {
                    Y.applyUpdate(doc, bytes);
                    applied++;
                  } catch {}
                }
              }
            }
            if (applied > 0) {
              logger.info('useEditorCore', `[BOOTSTRAP] Applied ${applied} recent updates from /api/scripts/:id/updates`);
              bootstrapped = true;
            }
          }
        } catch (e) {
          logger.warn('useEditorCore', '[BOOTSTRAP] Failed to apply recent updates:', e);
        }

        logger.info('useEditorCore', `[WS_PROVIDER_CREATE] Creating WebSocket provider for script: ${stableScriptId}`);

        websocketProvider = new WebsocketProvider(wsBaseUrl, stableScriptId, doc, {
          params: {
            token: wsToken?.trim() || '',
          },
          maxBackoffTime: 30000,
          resyncInterval: 5000,
          WebSocketPolyfill: WebSocket,
          connect: true,
        });

        logger.info('useEditorCore', `[WS_PROVIDER_CREATED] WebSocket provider created`, {
          url: wsBaseUrl,
          scriptId: stableScriptId,
          hasDoc: !!doc,
          docClientId: doc.clientID,
        });

        const setupMessageInterceptor = () => {
          if (websocketProvider.ws && websocketProvider.ws.send) {
            const originalSend = websocketProvider.ws.send.bind(websocketProvider.ws);
            websocketProvider.ws.send = function (data: any) {
              if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
                const bytes = new Uint8Array(data);
                const hex = Array.from(bytes.slice(0, Math.min(50, bytes.length)))
                  .map((b) => b.toString(16).padStart(2, '0'))
                  .join(' ');
                logger.info('useEditorCore', '[WS_SEND] Sending binary message:', {
                  size: bytes.length,
                  firstBytes: hex,
                  msgType: bytes[0],
                  isAwareness: bytes[0] === 0x04,
                });
              }
              return originalSend(data);
            };
            logger.info('useEditorCore', '[WS_INTERCEPTOR] Message interceptor installed');
          }
        };

        setupMessageInterceptor();
        websocketProvider.on('status', (event: { status: string }) => {
          if (event.status === 'connected') {
            setupMessageInterceptor();
          }
        });

        websocketProvider.on('sync', (synced: boolean) => {
          logger.info('useEditorCore', '[WS_SYNCED] WebSocket sync state changed:', { synced });
          if (synced) {
            const defaultFieldAfter = doc.getXmlFragment('default');
            logger.info('useEditorCore', '[WS_SYNCED_CONTENT] Content after sync:', {
              defaultFieldLength: defaultFieldAfter.length,
              hasContent: defaultFieldAfter.length > 0,
            });

            setTimeout(() => {
              doc.transact(() => {
                logger.info('useEditorCore', '[WS_SYNC_INIT] Forcing initial sync after connection');
              }, 'syncInit');
            }, 100);
          }
        });

        setProvider(websocketProvider);
        providerRef.current = websocketProvider;
      } catch (error) {
        logger.error('useEditorCore', '[Editor Core] Failed to create WebSocket provider:', error);
        setConnectionStatus('error');
        setErrorMessage('Failed to initialize collaboration');
        return;
      }

      websocketProvider.on('status', (event: { status: string }) => {
        switch (event.status) {
          case 'connecting':
            setConnectionStatus('connecting');
            setErrorMessage(null);
            break;
          case 'connected':
            setConnectionStatus('connected');
            setErrorMessage(null);
            debugLog('[Editor] WebSocket connected successfully');
            break;
          case 'disconnected':
            setConnectionStatus('disconnected');
            break;
          default:
            setConnectionStatus('error');
            setErrorMessage(`Connection error: ${event.status}`);
        }
      });

      websocketProvider.on('connection-error', (error: any) => {
        logger.error('useEditorCore', '[Editor] WebSocket connection error:', error);
        setConnectionStatus('error');
        setErrorMessage('Connection lost. Retrying...');

        setTimeout(() => {
          if (websocketProvider && !websocketProvider.wsconnected) {
            debugLog('[Editor] Attempting to reconnect WebSocket...');
            websocketProvider.connect();
          }
        }, 2000);
      });

      const trackAwareness = () => {
        if (websocketProvider.awareness) {
          const awarenessStates = websocketProvider.awareness.getStates();
          const userCount = Math.max(0, awarenessStates.size - 1);
          setActiveUserCount(userCount);
          debugLog(`[Collaboration] Active users: ${userCount} (excluding self)`);

          const activeUsers = Array.from(awarenessStates.values())
            .filter((state: any) => state.user && state.user.name !== stableUser?.username)
            .map((state: any) => ({
              name: state.user.name,
              color: state.user.color,
              lastSeen: Date.now(),
              isTyping: !!state.cursor,
            }));

          if (activeUsers.length > 0) {
            logger.debug(
              'useEditorCore',
              '🎭 [Theater Collaboration] Active team members:',
              activeUsers.map((u) => `${u.name}${u.isTyping ? ' (typing)' : ''}`).join(', '),
            );
          }
        }
      };

      if (websocketProvider.awareness) {
        websocketProvider.awareness.on('change', trackAwareness);
        trackAwareness();
      }
    };

    initializeWebSocket();

    return () => {
      debugLog('[Editor Core] Cleaning up WebSocket provider (keeping Yjs doc persistent)...');

      if (providerRef.current) {
        debugLog('[Editor Core] Disconnecting and destroying WebSocket provider, but keeping document');
        providerRef.current.disconnect();
        setTimeout(() => {
          if (providerRef.current) {
            providerRef.current.destroy();
            providerRef.current = null;
          }
        }, 100);
      }

      if (stableScriptId) {
        yjsDocumentManager.releaseDocument(stableScriptId);
        const docInfo = yjsDocumentManager.getDocumentInfo(stableScriptId);
        debugLog('[Editor Core] Released document reference (keeping for refresh):', {
          scriptId: stableScriptId,
          remainingRefCount: docInfo.refCount,
          stillExists: docInfo.exists,
        });
      }

      setProvider(null);
      setYdoc(null);
      setActiveUserCount(0);
    };
  }, [debugLog, stableHasToken, stableScriptId, stableToken, stableUser, wsBaseUrl]);

  return {
    ydoc,
    provider,
    connectionStatus,
    errorMessage,
    activeUserCount,
  };
};

