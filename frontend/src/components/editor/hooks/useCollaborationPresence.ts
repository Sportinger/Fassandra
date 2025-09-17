import { useCallback, useEffect, useState } from 'react';
import type { WebsocketProvider } from 'y-websocket';

type AwarenessState = Record<string, any> | undefined;

interface UseCollaborationPresenceReturn {
  remoteStates: Map<number, AwarenessState>;
  updateLocalState: (partial: Record<string, any>) => void;
  setLocalStateField: (key: string, value: any) => void;
}

const emptyMap = new Map<number, AwarenessState>();

export const useCollaborationPresence = (provider: WebsocketProvider | null): UseCollaborationPresenceReturn => {
  const [remoteStates, setRemoteStates] = useState<Map<number, AwarenessState>>(emptyMap);

  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness) {
      setRemoteStates(emptyMap);
      return undefined;
    }

    const handleChange = () => {
      const states = awareness.getStates();
      const next = new Map<number, AwarenessState>();
      states.forEach((state: AwarenessState, clientId: number) => {
        if (clientId === awareness.clientID) return;
        next.set(clientId, state);
      });
      setRemoteStates(next);
    };

    handleChange();
    awareness.on('change', handleChange);
    return () => {
      awareness.off('change', handleChange);
    };
  }, [provider]);

  const updateLocalState = useCallback((partial: Record<string, any>) => {
    const awareness = provider?.awareness;
    if (!awareness) return;
    const current = awareness.getLocalState?.() || {};
    awareness.setLocalState?.({ ...current, ...partial });
  }, [provider]);

  const setLocalStateField = useCallback((key: string, value: any) => {
    const awareness = provider?.awareness;
    if (!awareness) return;
    awareness.setLocalStateField?.(key, value);
  }, [provider]);

  return {
    remoteStates,
    updateLocalState,
    setLocalStateField,
  };
};

