import React from 'react';
import type { Editor as TipTapEditor } from '@tiptap/react';
import type { WebsocketProvider } from 'y-websocket';
import type * as Y from 'yjs';

import { EditorView } from '../EditorView';
import { CalendarMock } from './CalendarMock';
import { ScenesOverviewMock } from './ScenesOverviewMock';
import { WorkspaceMode } from './types';
import type { ConnectionStatus, ToolbarContext } from '../../types';

import './workspace.css';

interface WorkspaceContainerProps {
  mode: WorkspaceMode;
  editor: TipTapEditor | null;
  provider: WebsocketProvider | null;
  ydoc: Y.Doc | null;
  connectionStatus: ConnectionStatus;
  toolbarContext: ToolbarContext;
  debugLog: (...args: any[]) => void;
}

export const WorkspaceContainer: React.FC<WorkspaceContainerProps> = ({
  mode,
  editor,
  provider,
  ydoc,
  connectionStatus,
  toolbarContext,
  debugLog,
}) => {
  switch (mode) {
    case 'calendar':
      return (
        <div className="workspace-mode-content mode-calendar">
          <CalendarMock />
        </div>
      );
    case 'scenes':
      return (
        <div className="workspace-mode-content mode-scenes">
          <ScenesOverviewMock />
        </div>
      );
    case 'editor':
    default:
      return (
        <div className="workspace-mode-content mode-editor">
          <EditorView
            editor={editor}
            provider={provider}
            ydoc={ydoc}
            connectionStatus={connectionStatus}
            toolbarContext={toolbarContext}
            debugLog={debugLog}
          />
        </div>
      );
  }
};

export default WorkspaceContainer;
