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
          const textNode = node as Text;
          const data = textNode.data || '';
          const isWordChar = (ch: string) => /[\p{L}\p{N}'’_-]/u.test(ch);
          let start = Math.max(0, Math.min(offset, data.length));
          while (start > 0 && isWordChar(data.charAt(start - 1))) start--;
          let end = Math.max(0, Math.min(offset, data.length));
          while (end < data.length && isWordChar(data.charAt(end))) end++;
          if (end > start) {
            const range = document.createRange();
            range.setStart(textNode, start);
            range.setEnd(textNode, end);
            const rect = range.getBoundingClientRect();
            const cRect = container.getBoundingClientRect();
            const scrollTop = container.scrollTop || 0;
            const scrollLeft = container.scrollLeft || 0;
            mappedRect = {
              left: rect.left - cRect.left + scrollLeft,
              top: rect.top - cRect.top + scrollTop,
              width: rect.width,
              height: rect.height,
            };
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
        if (mappedRect) {
          broadcastRehearsalState({ rehearsalDocPos, rehearsalWordRect: mappedRect });
        } else {
          broadcastRehearsalState({ rehearsalDocPos });
        }
      }
    } catch {}
  }, [rehearsalDocPos, editor, broadcastRehearsalState]);

  useEffect(() => {
    if (!isBrowser) return;

    remoteStates.forEach((state, clientId) => {
      if (!state) return;

      const remotePos = typeof state.rehearsalLinePosition === 'number' ? state.rehearsalLinePosition : null;
      if (remotePos !== null) {
        const lastForClient = lastAwarenessPosRef.current.get(clientId);
        if (!(typeof lastForClient === 'number' && Math.abs(lastForClient - remotePos) <= 0.5)) {
          lastAwarenessPosRef.current.set(clientId, remotePos);
          debugLog('[Rehearsal Sync] Remote position', clientId, remotePos);
          isApplyingRemoteRehearsalRef.current = true;
          setRehearsalLinePosition(remotePos);
          pendingCenterRef.current = true;
          setTimeout(() => { isApplyingRemoteRehearsalRef.current = false; }, 0);
        }
      }

      try {
        const rect = state?.rehearsalWordRect;
        if (rect && typeof rect.left === 'number') {
          const key = JSON.stringify({ l: rect.left, t: rect.top, w: rect.width, h: rect.height });
          if (key !== lastAwarenessRectRef.current.get(clientId)) {
            lastAwarenessRectRef.current.set(clientId, key);
            setRehearsalWordBox({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
            if (typeof rect.top === 'number' && typeof rect.height === 'number' && remotePos === null) {
              setRehearsalLinePosition(rect.top + rect.height);
            }
          }
        } else if (editor && typeof state?.rehearsalDocPos === 'number') {
          const pos = state.rehearsalDocPos as number;
          setRehearsalDocPos(pos);
          const view: any = (editor as any).view;
          const containerElement = document.querySelector('.singlePageContainer') as HTMLElement | null;
          if (view && containerElement && typeof view.domAtPos === 'function') {
            let domInfo = view.domAtPos(pos);
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
              const textNode = node as Text;
              const data = textNode.data || '';
              const isWordChar = (ch: string) => /[\p{L}\p{N}'’_-]/u.test(ch);
              let start = Math.max(0, Math.min(offset, data.length));
              while (start > 0 && isWordChar(data.charAt(start - 1))) start--;
              let end = Math.max(0, Math.min(offset, data.length));
              while (end < data.length && isWordChar(data.charAt(end))) end++;
              if (end > start) {
                const range = document.createRange();
                range.setStart(textNode, start);
                range.setEnd(textNode, end);
                const rect = range.getBoundingClientRect();
                const containerRect = containerElement.getBoundingClientRect();
                const scrollTop = containerElement.scrollTop || 0;
                const scrollLeft = containerElement.scrollLeft || 0;
                const mapped = {
                  left: rect.left - containerRect.left + scrollLeft,
                  top: rect.top - containerRect.top + scrollTop,
                  width: rect.width,
                  height: rect.height,
                };
                const key2 = JSON.stringify({ l: mapped.left, t: mapped.top, w: mapped.width, h: mapped.height });
                if (key2 !== lastAwarenessRectRef.current.get(clientId)) {
                  lastAwarenessRectRef.current.set(clientId, key2);
                }
                setRehearsalWordBox(mapped);
                if (remotePos === null) {
                  setRehearsalLinePosition(mapped.top + mapped.height);
                }
              }
            }
          }
        }
      } catch {}
    });
  }, [remoteStates, debugLog, editor]);

  useEffect(() => {
    if (rehearsalLinePosition <= 0) return;
    if (isApplyingRemoteRehearsalRef.current) return;
    setRehearsalStateField('rehearsalLinePosition', rehearsalLinePosition);
  }, [rehearsalLinePosition, setRehearsalStateField]);

  useEffect(() => {
    if (!isBrowser) return;

    debugLog('[Rehearsal Line State]', rehearsalLinePosition, rehearsalMode, viewMode);

    if (suppressRehearsalAutoScroll) return;
    if (!pendingCenterRef.current) return;
    if (!rehearsalMode || (viewMode !== 'single-page' && viewMode !== 'borderless')) return;

    const containerElement = document.querySelector('.singlePageContainer');
    if (!containerElement) {
      debugLog('[Rehearsal Scroll] Container missing');
      return;
    }

    const containerRect = containerElement.getBoundingClientRect();
    const absoluteLinePosition = containerRect.top + window.scrollY + rehearsalLinePosition;
    const targetScrollPosition = absoluteLinePosition - (window.innerHeight / 2);

    window.scrollTo({
      top: targetScrollPosition,
      behavior: 'smooth',
    });

    lastCenteredRehearsalPosRef.current = rehearsalLinePosition;
    pendingCenterRef.current = false;
  }, [rehearsalLinePosition, rehearsalMode, viewMode, suppressRehearsalAutoScroll, shouldCenterOnRehearsalChange, debugLog]);

  const adoptRemotePosition = useCallback(() => {
    if (remoteStates.size === 0) return false;

    let sharedPos: number | null = null;
    let advancedState: any = null;

    remoteStates.forEach((state) => {
      if (!state) return;
      if (sharedPos === null && typeof state.rehearsalLinePosition === 'number' && state.rehearsalLinePosition > 0) {
        sharedPos = state.rehearsalLinePosition;
      }
      if (!advancedState && (state?.rehearsalWordRect || typeof state?.rehearsalDocPos === 'number')) {
        advancedState = state;
      }
    });

    if (sharedPos === null) return false;
    if (Math.abs(sharedPos - rehearsalLinePosition) <= 0.5) return false;

    isApplyingRemoteRehearsalRef.current = true;
    setRehearsalLinePosition(sharedPos);

    try {
      if (advancedState?.rehearsalWordRect) {
        const r = advancedState.rehearsalWordRect;
        if (typeof r.top === 'number') {
          setRehearsalLinePosition(r.top + (r.height || 0));
        }
        setRehearsalWordBox({ left: r.left, top: r.top, width: r.width, height: r.height });
      } else if (editor && typeof advancedState?.rehearsalDocPos === 'number' && isBrowser) {
        const pos = advancedState.rehearsalDocPos as number;
        const view: any = (editor as any).view;
        const containerElement = document.querySelector('.singlePageContainer') as HTMLElement | null;
        if (view && containerElement) {
          const coords = view.coordsAtPos(pos);
          if (coords) {
            const containerRect = containerElement.getBoundingClientRect();
            const containerScrollTop = containerElement.scrollTop || 0;
            const y = coords.top - containerRect.top + containerScrollTop;
            setRehearsalLinePosition(y);
            setRehearsalDocPos(pos);
          }
        }
      }
    } catch {}

    setTimeout(() => { isApplyingRemoteRehearsalRef.current = false; }, 0);
    pendingCenterRef.current = true;
    return true;
  }, [remoteStates, rehearsalLinePosition, editor]);

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
