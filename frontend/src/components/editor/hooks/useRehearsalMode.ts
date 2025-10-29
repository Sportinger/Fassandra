import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Editor } from '@tiptap/react';
import type { WebsocketProvider } from 'y-websocket';

import type { ViewMode } from '../types';
import { useCollaborationPresence } from './useCollaborationPresence';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

interface UseRehearsalModeArgs {
  editor: Editor | null;
  provider: WebsocketProvider | null;
  scriptId: string;
  token: string | null;
  viewMode: ViewMode;
  debugLog: (...args: any[]) => void;
}

interface RehearsalWordBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface UseRehearsalModeReturn {
  rehearsalMode: boolean;
  setRehearsalMode: (value: boolean) => void;
  rehearsalLinePosition: number;
  setRehearsalLinePosition: (value: number) => void;
  rehearsalDocPos: number | null;
  setRehearsalDocPos: (value: number | null) => void;
  rehearsalWordBox: RehearsalWordBox | null;
  setRehearsalWordBox: (box: RehearsalWordBox | null) => void;
  suppressRehearsalAutoScroll: boolean;
  setSuppressRehearsalAutoScroll: (value: boolean) => void;
  shouldCenterOnRehearsalChange: boolean;
  setShouldCenterOnRehearsalChange: (value: boolean) => void;
  pendingCenterRef: MutableRefObject<boolean>;
  isApplyingRemoteRehearsalRef: MutableRefObject<boolean>;
  autoFollowActive: boolean;
  lastAsrText: string;
  startAutoFollow: () => Promise<void>;
  stopAutoFollow: () => Promise<void>;
  broadcastRehearsalState: (partial: Record<string, any>) => void;
  setRehearsalStateField: (key: string, value: any) => void;
  adoptRemotePosition: () => boolean;
}

export const useRehearsalMode = ({
  editor,
  provider,
  scriptId,
  token,
  viewMode,
  debugLog,
}: UseRehearsalModeArgs): UseRehearsalModeReturn => {
  const [rehearsalMode, setRehearsalMode] = useState(false);
  const [rehearsalLinePosition, setRehearsalLinePosition] = useState<number>(0);
  const [rehearsalDocPos, setRehearsalDocPos] = useState<number | null>(null);
  const [rehearsalWordBox, setRehearsalWordBox] = useState<RehearsalWordBox | null>(null);
  const [suppressRehearsalAutoScroll, setSuppressRehearsalAutoScroll] = useState(false);
  const [shouldCenterOnRehearsalChange, setShouldCenterOnRehearsalChange] = useState(false);
  const [autoFollowActive, setAutoFollowActive] = useState(false);
  const [lastAsrText, setLastAsrText] = useState('');

  const pendingCenterRef = useRef(false);
  const lastCenteredRehearsalPosRef = useRef<number | null>(null);
  const isApplyingRemoteRehearsalRef = useRef(false);
  const lastAwarenessPosRef = useRef<Map<number, number>>(new Map());
  const lastAwarenessRectRef = useRef<Map<number, string>>(new Map());
  const lastBroadcastedDocPosRef = useRef<number | null>(null);
  const autoFollowRef = useRef<any>(null);
  const asrTrailTimerRef = useRef<number | null>(null);

  const { remoteStates, updateLocalState, setLocalStateField } = useCollaborationPresence(provider);

  const broadcastRehearsalState = useCallback((partial: Record<string, any>) => {
    updateLocalState(partial);
  }, [updateLocalState]);

  const setRehearsalStateField = useCallback((key: string, value: any) => {
    setLocalStateField(key, value);
  }, [setLocalStateField]);

  const startAutoFollow = useCallback(async () => {
    if (!editor || autoFollowRef.current) return;
    const { AutoFollowService } = await import('../../../services/AutoFollowService');
    const svc = new AutoFollowService(editor as any, scriptId, token || 'authenticated', (msg: any) => {
      try {
        if (msg && msg.asr && typeof msg.asr.text === 'string') {
          setLastAsrText(msg.asr.text);
        }
        if (msg && msg.type === 'progress' && typeof msg.docPos === 'number') {
          setRehearsalDocPos(msg.docPos);
        }
        if (msg && Array.isArray(msg.wordDocPos) && msg.wordDocPos.length > 0) {
          if (asrTrailTimerRef.current) {
            window.clearTimeout(asrTrailTimerRef.current);
            asrTrailTimerRef.current = null;
          }
          const trail = msg.wordDocPos.slice(-6);
          let i = 0;
          const step = () => {
            if (i >= trail.length) return;
            setRehearsalDocPos(trail[i]);
            i += 1;
            asrTrailTimerRef.current = window.setTimeout(step, 60);
          };
          step();
        }
      } catch {}
    });
    autoFollowRef.current = svc;
    await svc.start();
    setAutoFollowActive(true);
    setRehearsalMode(true);
  }, [editor, scriptId, token]);

  const stopAutoFollow = useCallback(async () => {
    if (autoFollowRef.current) {
      await autoFollowRef.current.stop();
      autoFollowRef.current = null;
    }
    if (asrTrailTimerRef.current) {
      window.clearTimeout(asrTrailTimerRef.current);
      asrTrailTimerRef.current = null;
    }
    setAutoFollowActive(false);
    setLastAsrText('');
  }, []);

  useEffect(() => {
    if (!editor) return;
    if (typeof rehearsalDocPos !== 'number') return;
    if (!isBrowser) return;

    // Memoize expensive word boundary calculation
    const calculateWordBox = (textNode: Text, offset: number): RehearsalWordBox | null => {
      const data = textNode.data || '';
      const isWordChar = (ch: string) => /[\p{L}\p{N}''_-]/u.test(ch);
      let start = Math.max(0, Math.min(offset, data.length));
      while (start > 0 && isWordChar(data.charAt(start - 1))) start--;
      let end = Math.max(0, Math.min(offset, data.length));
      while (end < data.length && isWordChar(data.charAt(end))) end++;

      if (end <= start) return null;

      const container = document.querySelector('.singlePageContainer') as HTMLElement | null;
      if (!container) return null;

      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
      const rect = range.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop || 0;
      const scrollLeft = container.scrollLeft || 0;

      return {
        left: rect.left - cRect.left + scrollLeft,
        top: rect.top - cRect.top + scrollTop,
        width: rect.width,
        height: rect.height,
      };
    };

    try {
      const view: any = (editor as any).view;
      const container = document.querySelector('.singlePageContainer') as HTMLElement | null;
      if (!view || !container) return;

      let mappedY: number | null = null;
      let mappedRect: RehearsalWordBox | null = null;

      try {
        const domInfo = view.domAtPos(rehearsalDocPos);
        let node: any = domInfo.node;
        let offset: number = (domInfo.offset || 0) as number;

        if (node && node.nodeType !== Node.TEXT_NODE) {
          const child = node.childNodes?.[Math.min(offset, node.childNodes.length - 1)] || node.firstChild;
          if (child && child.nodeType === Node.TEXT_NODE) {
            node = child;
            offset = Math.max(0, Math.min((node as Text).data.length, 0));
          }
        }

        if (node && node.nodeType === Node.TEXT_NODE) {
          mappedRect = calculateWordBox(node as Text, offset);
          if (mappedRect) {
            mappedY = mappedRect.top + mappedRect.height;
          }
        }
      } catch {}

      if (mappedY === null) {
        const coords = view.coordsAtPos(rehearsalDocPos);
        if (coords) {
          const cRect = container.getBoundingClientRect();
          mappedY = coords.top - cRect.top + (container.scrollTop || 0) + 16;
        }
      }

      if (mappedY !== null) {
        setRehearsalLinePosition(mappedY);
        setRehearsalWordBox(mappedRect);
        pendingCenterRef.current = true;

        // Only broadcast if we're NOT applying a remote position (avoid feedback loop)
        // AND the position has actually changed
        if (!isApplyingRemoteRehearsalRef.current) {
          const lastBroadcasted = lastBroadcastedDocPosRef.current;
          if (lastBroadcasted === null || Math.abs(lastBroadcasted - rehearsalDocPos) >= 1) {
            broadcastRehearsalState({ rehearsalDocPos });
            lastBroadcastedDocPosRef.current = rehearsalDocPos;
          }
        }
      }
    } catch {}
  }, [rehearsalDocPos, editor, broadcastRehearsalState]);

  useEffect(() => {
    if (!isBrowser || !editor) return;

    // Process remote rehearsal states (throttled to avoid excessive updates)
    remoteStates.forEach((state, clientId) => {
      if (!state) return;

      // PRIORITY: Use rehearsalDocPos (document position) as source of truth
      try {
        if (typeof state?.rehearsalDocPos === 'number') {
          const pos = state.rehearsalDocPos as number;

          // Check if this is a new position from this client
          const lastPos = lastAwarenessPosRef.current.get(clientId);
          if (typeof lastPos === 'number' && Math.abs(lastPos - pos) < 1) {
            return; // No significant change
          }

          lastAwarenessPosRef.current.set(clientId, pos);
          setRehearsalDocPos(pos);

          // Simplified remote position handling - let the main effect compute the box
          isApplyingRemoteRehearsalRef.current = true;
          setTimeout(() => { isApplyingRemoteRehearsalRef.current = false; }, 100);
        }
      } catch {}
    });
  }, [remoteStates, editor]);

  // NOTE: We no longer broadcast rehearsalLinePosition as it's viewport-specific
  // Only rehearsalDocPos (document position) is broadcast and used for sync

  useEffect(() => {
    if (!isBrowser) return;

    if (suppressRehearsalAutoScroll) return;
    if (!pendingCenterRef.current) return;
    if (!rehearsalMode || (viewMode !== 'single-page' && viewMode !== 'borderless')) return;

    const containerElement = document.querySelector('.singlePageContainer');
    if (!containerElement) return;

    const containerRect = containerElement.getBoundingClientRect();
    const absoluteLinePosition = containerRect.top + window.scrollY + rehearsalLinePosition;
    const targetScrollPosition = absoluteLinePosition - (window.innerHeight / 2);

    window.scrollTo({
      top: targetScrollPosition,
      behavior: 'smooth',
    });

    lastCenteredRehearsalPosRef.current = rehearsalLinePosition;
    pendingCenterRef.current = false;
  }, [rehearsalLinePosition, rehearsalMode, viewMode, suppressRehearsalAutoScroll, shouldCenterOnRehearsalChange]);

  const adoptRemotePosition = useCallback(() => {
    if (remoteStates.size === 0) return false;
    if (!editor || !isBrowser) return false;

    // Find the first remote state with a document position
    let remoteDocPos: number | null = null;

    remoteStates.forEach((state) => {
      if (!state) return;
      if (remoteDocPos === null && typeof state?.rehearsalDocPos === 'number') {
        remoteDocPos = state.rehearsalDocPos;
      }
    });

    if (remoteDocPos === null) return false;
    if (rehearsalDocPos !== null && Math.abs(remoteDocPos - rehearsalDocPos) < 1) return false;

    // Set the document position - this will trigger the effect that computes local coordinates
    setRehearsalDocPos(remoteDocPos);
    return true;
  }, [remoteStates, rehearsalDocPos, editor]);

  return {
    rehearsalMode,
    setRehearsalMode,
    rehearsalLinePosition,
    setRehearsalLinePosition,
    rehearsalDocPos,
    setRehearsalDocPos,
    rehearsalWordBox,
    setRehearsalWordBox,
    suppressRehearsalAutoScroll,
    setSuppressRehearsalAutoScroll,
    shouldCenterOnRehearsalChange,
    setShouldCenterOnRehearsalChange,
    pendingCenterRef,
    isApplyingRemoteRehearsalRef,
    autoFollowActive,
    lastAsrText,
    startAutoFollow,
    stopAutoFollow,
    broadcastRehearsalState,
    setRehearsalStateField,
    adoptRemotePosition,
  };
};
