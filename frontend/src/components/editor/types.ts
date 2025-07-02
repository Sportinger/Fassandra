import { Editor as EditorInstance } from '@tiptap/react';
import { ScriptLayout } from '../../types';

export interface FloatingToolbarProps {
  editor: EditorInstance | null;
  hasTextSelection: boolean;
  context: 'default' | 'speaker-name' | 'empty-page' | 'dialogue-block' | 'speaker-selection';
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  speakerNames: Set<string>;
}

export type ToolbarContext = 'text-selection' | 'speaker-name' | 'empty-page' | 'default' | 'dialogue-block' | 'speaker-selection';

export interface EditorProps {
  scriptId: string;
  initialTitle?: string;
  onNavigateBack: () => void;
}

export interface ContextMenu {
  x: number;
  y: number;
  visible: boolean;
  onSpeakerName: boolean;
  onPageBackground: boolean;
}

export type ViewMode = 'single-page' | 'multiple-pages';

export type ConnectionStatus = 'uninitialized' | 'disconnected' | 'connecting' | 'connected' | 'error' | 'syncing' | 'authenticating' | 'authentication failed';

export interface ContextMenuAction {
  label: string;
  action: () => void;
  disabled: boolean;
  active: boolean;
}

export interface ViewModeProps {
  editor: EditorInstance | null;
  scriptCreationDate: string | null;
  isExiting: boolean;
  handlePageContextMenu: (e: React.MouseEvent) => void;
  handleContextMenu: (e: React.MouseEvent) => void;
  handleEditorClick: (e: React.MouseEvent) => void;
  showRuler: boolean;
}

export interface LayoutManagementProps {
  layouts: ScriptLayout[];
  currentLayout: ScriptLayout | null;
  onLayoutChange: (layout: ScriptLayout) => void;
  onCreateNewLayout: () => Promise<void>;
  onSaveLayout: () => Promise<void>;
} 