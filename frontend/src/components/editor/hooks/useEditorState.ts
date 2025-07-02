import { useState, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { ScriptLayout } from '../../../types';
import { ContextMenu, ViewMode, ConnectionStatus } from '../types';

export const useEditorState = (initialTitle?: string) => {
  // Core document and provider state
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);

  // Script metadata state
  const [scriptTitle, setScriptTitle] = useState<string>(initialTitle || 'Loading...');
  const [scriptCreationDate, setScriptCreationDate] = useState<string | null>(null);

  // UI state
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ 
    x: 0, 
    y: 0, 
    visible: false, 
    onSpeakerName: false, 
    onPageBackground: false 
  });
  const [viewMode, setViewMode] = useState<ViewMode>('single-page');
  const [showRuler, setShowRuler] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Floating toolbar state
  const [toolbarContext, setToolbarContext] = useState<'default' | 'speaker-name' | 'empty-page' | 'speaker-selection'>('default');
  const [speakerNames, setSpeakerNames] = useState<Set<string>>(new Set());

  // Layout management state
  const [layouts, setLayouts] = useState<ScriptLayout[]>([]);
  const [currentLayout, setCurrentLayout] = useState<ScriptLayout | null>(null);

  // Connection and loading state
  const [status, setStatus] = useState<ConnectionStatus>('uninitialized');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMobileFallback, setIsMobileFallback] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);

  // Refs for cleanup and debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSaveRef = useRef<((editor: any) => void) | null>(null);

  return {
    // Document state
    ydoc,
    setYdoc,
    provider,
    setProvider,
    persistenceRef,

    // Script metadata
    scriptTitle,
    setScriptTitle,
    scriptCreationDate,
    setScriptCreationDate,

    // UI state
    contextMenu,
    setContextMenu,
    viewMode,
    setViewMode,
    showRuler,
    setShowRuler,
    isExiting,
    setIsExiting,

    // Toolbar state
    toolbarContext,
    setToolbarContext,
    speakerNames,
    setSpeakerNames,

    // Layout state
    layouts,
    setLayouts,
    currentLayout,
    setCurrentLayout,

    // Connection state
    status,
    setStatus,
    errorMessage,
    setErrorMessage,
    isMobileFallback,
    setIsMobileFallback,
    pendingContent,
    setPendingContent,

    // Refs
    saveTimeoutRef,
    debouncedSaveRef,
  };
}; 