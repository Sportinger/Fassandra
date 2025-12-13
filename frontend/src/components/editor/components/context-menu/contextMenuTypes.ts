type WordRect = { left: number; top: number; width: number; height: number };

export interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
  onSpeakerName: boolean;
  onPageBackground: boolean;
  rehearsalClickY?: number;
  rehearsalDocPos?: number;
  hasWordTarget?: boolean;
  wordLineY?: number;
  wordRect?: WordRect;
}

export interface InsertSubmenuState {
  open: boolean;
  x: number;
  y: number;
}

export type ContextMenuAction =
  | 'insert-paragraph'
  | 'add-comment'
  | 'insert-dialogue'
  | 'insert-scene'
  | 'toggle-view'
  | 'jump'
  | 'format-speakers'
  | 'change-speaker-color'
  | 'highlight-yellow'
  | 'highlight-green'
  | 'highlight-blue'
  | 'highlight-pink'
  | 'highlight-orange'
  | 'highlight-remove';

export type CloseContextMenu = () => void;
