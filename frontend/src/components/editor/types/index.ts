/**
 * Editor Type Definitions
 * Comprehensive TypeScript types for the collaborative editor system
 */

import { Editor as TipTapEditor } from '@tiptap/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { ScriptLayout } from '../../../types';

// ===== CORE EDITOR TYPES =====

export interface EditorProps {
  scriptId: string;
  initialTitle?: string;
  onNavigateBack: () => void;
}

export interface EditorState {
  // Document state
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  
  // Script metadata
  scriptTitle: string;
  scriptCreationDate: string | null;
  
  // UI state
  viewMode: ViewMode;
  showRuler: boolean;
  isExiting: boolean;
  
  // Connection state
  status: ConnectionStatus;
  errorMessage: string | null;
  isMobileFallback: boolean;
  pendingContent: string | null;
}

// ===== RESPONSIVE DESIGN TYPES =====

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

export interface ResponsiveConfig {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  viewport: {
    width: number;
    height: number;
  };
}

export interface DimensionConfig {
  pageWidth: string;
  pageHeight: string;
  contentPaddingX: string;
  contentPaddingY: string;
  baseFontSize: string;
  lineHeight: string;
}

// ===== TOOLBAR TYPES =====

export type ToolbarContext = 
  | 'default'           // Shows cue/scene insertion buttons
  | 'text-formatting'   // Shows text formatting when text is selected
  | 'dialogue-layout'   // Shows layout options when in dialogue block
  | 'speaker-select'    // Shows speaker dropdown when speaker box is clicked
  | 'empty-page'
  | 'cue-select'        // Shows cue options when a cue block is selected
  | 'scene-select';     // Shows scene options when a scene block is selected

export interface ToolbarButton {
  id: string;
  icon: string;
  label: string;
  title: string;
  action: () => void;
  isActive?: boolean;
  isDisabled?: boolean;
  contexts: ToolbarContext[];
  order: number;
  variant?: 'button' | 'dropdown' | 'separator';
}

export interface ToolbarProps {
  editor: TipTapEditor | null;
  context: ToolbarContext;
  hasTextSelection: boolean;
  viewMode: ViewMode;
  showRuler: boolean;
  speakerNames: Set<string>;
  currentSpeakerName?: string | null;
  editAllSpeakers?: boolean;
  onToggleEditAllSpeakers?: () => void;
  onSetViewMode: (mode: ViewMode) => void;
  onToggleRuler: () => void;
  className?: string;
  rehearsalMode?: boolean;
  onToggleRehearsalMode?: () => void;
}

// ===== DROPDOWN TYPES =====

export interface DropdownProps {
  editor: TipTapEditor | null;
  isVisible: boolean;
  className?: string;
  position?: 'left' | 'right' | 'auto';
}

export interface DropdownItem {
  id: string;
  label: string;
  value?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
}

export interface FontSizeDropdownProps extends DropdownProps {
  transitionDelay?: string;
}

export interface SpeakerDropdownProps extends DropdownProps {
  speakerNames: Set<string>;
}

// ===== VIEW MODE TYPES =====

export type ViewMode = 'single-page' | 'multiple-pages' | 'virtual-page';

export interface ViewModeProps {
  editor: TipTapEditor | null;
  scriptCreationDate: string | null;
  isExiting: boolean;
  showRuler: boolean;
  onPageContextMenu: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onEditorClick: (e: React.MouseEvent) => void;
  className?: string;
}

export interface PageCanvasProps {
  children: React.ReactNode;
  showRuler: boolean;
  className?: string;
}

// ===== CONTEXT MENU TYPES =====

export interface ContextMenu {
  x: number;
  y: number;
  visible: boolean;
  onSpeakerName: boolean;
  onPageBackground: boolean;
}

export interface ContextMenuAction {
  label: string;
  action: () => void;
  disabled: boolean;
  active: boolean;
  icon?: string;
}

export interface ContextMenuProps {
  contextMenu: ContextMenu;
  actions: (ContextMenuAction | { label: 'separator' })[];
  className?: string;
}

// ===== CONNECTION TYPES =====

export type ConnectionStatus = 
  | 'uninitialized'
  | 'authenticating'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'disconnected'
  | 'error'
  | 'authentication failed';

export interface ConnectionConfig {
  scriptId: string;
  user: any;
  token: string;
  wsBaseUrl?: string;
  maxRetries?: number;
  reconnectDelay?: number;
}

// ===== LAYOUT MANAGEMENT TYPES =====

export interface LayoutManagementProps {
  layouts: ScriptLayout[];
  currentLayout: ScriptLayout | null;
  onLayoutChange: (layout: ScriptLayout) => void;
  onCreateNewLayout: () => Promise<void>;
  onSaveLayout: () => Promise<void>;
}

// ===== HOOK TYPES =====

export interface UseEditorCoreProps {
  scriptId: string;
  user: any;
  hasToken: boolean;
}

// Return type for useEditorCore hook
export interface UseEditorCoreReturn {
  // Core editor instance
  editor: TipTapEditor | null;
  
  // Document state
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  
  // Connection state
  connectionStatus: ConnectionStatus;
  availableSpeakers: string[];
  errorMessage: string | null;
  
  // UI state
  contextMenu: ContextMenu | null;
  toolbarContext: ToolbarContext;
  
  // Actions
  showContextMenu: (x: number, y: number, context: ToolbarContext) => void;
  hideContextMenu: () => void;
  
  // Collaboration
  activeUserCount: number;
}

export interface UseCollaborationProps {
  scriptId: string;
  user: any;
  token: string;
}

export interface UseCollaborationReturn {
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  status: ConnectionStatus;
  errorMessage: string | null;
  isMobileFallback: boolean;
  retry: () => void;
}

export interface UseResponsiveDesignReturn {
  config: ResponsiveConfig;
  dimensions: DimensionConfig;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  updateViewport: () => void;
}

export interface UseKeyboardShortcutsProps {
  editor: TipTapEditor | null;
  onSave?: () => void;
  onToggleRuler?: () => void;
  onToggleViewMode?: () => void;
  onPrint?: () => void;
}

// ===== COMPONENT PROPS TYPES =====

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  isLoading?: boolean;
  isActive?: boolean;
}

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

// ===== EXTENSION TYPES =====

export interface DialogueBlockAttributes {
  layout: 'default' | 'side-by-side';
}

export interface SpeakerAttributes {
  name?: string;
}

export interface DialogueTextAttributes {
  speakerName?: string;
}

export interface FontSizeAttributes {
  fontSize?: string;
}

// ===== UTILITY TYPES =====

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type EventHandler<T = HTMLElement, E = Event> = (event: E & { currentTarget: T }) => void;

// ===== STYLE TYPES =====

export interface StyleObject {
  [key: string]: string | number | undefined;
}

export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    surface: string;
    text: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
}

// ===== PERFORMANCE TYPES =====

export interface PerformanceMetrics {
  renderTime: number;
  updateTime: number;
  memoryUsage: number;
  bundleSize: number;
}

export interface OptimizationConfig {
  virtualScrolling: boolean;
  lazyLoading: boolean;
  debounceDelay: number;
  throttleDelay: number;
}

// ===== API TYPES =====

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface ScriptContent {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  blocks: Array<{
    id: string;
    type: string;
    content: string;
    order: number;
  }>;
}

// All types are already exported above individually 