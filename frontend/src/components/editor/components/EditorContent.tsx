import React, { type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Editor } from '@tiptap/react';
import type { ConnectionStatus, ToolbarContext } from '../types';
import type { WebsocketProvider } from 'y-websocket';
import { LoadingSpinner } from './ui/LoadingSpinner';
import type { CloseContextMenu } from './context-menu/contextMenuTypes';
import { useEditorCanvasClick } from '../hooks/useEditorCanvasClick';

interface EditorContentProps {
  editor: Editor | null;
  connectionStatus: ConnectionStatus;
  ydoc: any;
  provider: WebsocketProvider | null;
  onContextMenu: (event: React.MouseEvent) => void;
  closeContextMenu: CloseContextMenu;
  debugLog: (...args: any[]) => void;
  editAllSpeakers: boolean;
  setEditAllSpeakers: Dispatch<SetStateAction<boolean>>;
  setCurrentSpeakerName: (name: string | null) => void;
  liveRenameBaseRef: MutableRefObject<string | null>;
  hideContextMenu: () => void;
  showContextMenu: (x: number, y: number, context: ToolbarContext) => void;
}

export const EditorContent: React.FC<EditorContentProps> = ({
  editor,
  connectionStatus,
  ydoc,
  provider,
  onContextMenu,
  closeContextMenu,
  debugLog,
  editAllSpeakers,
  setEditAllSpeakers,
  setCurrentSpeakerName,
  liveRenameBaseRef,
  hideContextMenu,
  showContextMenu,
}) => {
  const handleCanvasClick = useEditorCanvasClick({
    editor,
    debugLog,
    editAllSpeakers,
    setEditAllSpeakers,
    setCurrentSpeakerName,
    liveRenameBaseRef,
    hideContextMenu,
    showContextMenu,
  });

  if (!editor) {
    return (
      <div className="editor-loading">
        <LoadingSpinner size="lg" />
        <div>
          <p>Initializing collaborative editor...</p>
          {ydoc && provider ? (
            <p style={{ fontSize: '14px', opacity: 0.7 }}>
              ✅ Collaboration ready - Creating editor...
            </p>
          ) : (
            <p style={{ fontSize: '14px', opacity: 0.7 }}>
              🔄 Status: {connectionStatus} - Setting up real-time sync...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="editor-content"
      onContextMenu={onContextMenu}
      onClick={(e) => {
        closeContextMenu();
        handleCanvasClick(e);
      }}
    >
      <div ref={(node) => {
        if (node && editor && !node.contains(editor.options.element)) {
          node.appendChild(editor.options.element);
        }
      }} />
    </div>
  );
};
