import React from 'react';
import type { Editor } from '@tiptap/react';

import logger from '../../../../services/LoggingService';
import type { ToolbarContext, ViewMode } from '../../types';
import {
  BoldIcon,
  ClapperboardIcon,
  CornerDownLeftIcon,
  GoalIcon,
  ItalicIcon,
  LayoutListIcon,
  LayoutPanelTopIcon,
  MessageSquareQuoteIcon,
  PrinterIcon,
  SearchIcon,
  TextAlignCenterIcon,
  TextAlignEndIcon,
  TextAlignStartIcon,
  Trash2Icon,
} from '../../icons';

export interface ToolbarButton {
  id: string;
  icon: string | React.ReactElement;
  title: string;
  action: () => void;
  isActive?: boolean;
  contexts: ToolbarContext[];
  order: number;
  isSpecial?: boolean;
  isMobileOnly?: boolean;
}

interface BuildToolbarButtonsArgs {
  editor: Editor | null;
  autoFollowActive: boolean;
  onToggleAutoFollow?: () => void;
  editAllSpeakers: boolean;
  onToggleEditAllSpeakers?: () => void;
  focusIfNeeded: () => void;
  viewMode: ViewMode;
  rehearsalMode: boolean;
  onToggleRehearsalMode?: () => void;
  requestDefaultContext: () => void;
}

export const buildToolbarButtons = ({
  editor,
  autoFollowActive,
  onToggleAutoFollow,
  editAllSpeakers,
  onToggleEditAllSpeakers,
  focusIfNeeded,
  viewMode,
  rehearsalMode,
  onToggleRehearsalMode,
  requestDefaultContext,
}: BuildToolbarButtonsArgs): ToolbarButton[] => [
  {
    id: 'auto-follow',
    icon: autoFollowActive ? '🎤⏹' : '🎤▶',
    title: autoFollowActive ? 'Stop Auto-Follow' : 'Start Auto-Follow',
    action: () => { onToggleAutoFollow && onToggleAutoFollow(); },
    isActive: autoFollowActive,
    contexts: ['default', 'text-formatting', 'dialogue-layout', 'speaker-select', 'empty-page', 'cue-select', 'scene-select'],
    order: 0,
  },
  {
    id: 'bold',
    icon: <BoldIcon />,
    title: 'Bold',
    action: () => { focusIfNeeded(); editor?.chain().toggleBold().run(); },
    isActive: editor?.isActive('bold'),
    contexts: ['text-formatting'],
    order: 1,
  },
  {
    id: 'italic',
    icon: <ItalicIcon />,
    title: 'Italic',
    action: () => { focusIfNeeded(); editor?.chain().toggleItalic().run(); },
    isActive: editor?.isActive('italic'),
    contexts: ['text-formatting'],
    order: 2,
  },
  {
    id: 'font-size',
    icon: '16',
    title: 'Font Size',
    action: () => {},
    contexts: ['text-formatting'],
    order: 4,
    isSpecial: true,
  },
  {
    id: 'align-left',
    icon: <TextAlignStartIcon />,
    title: 'Align Left',
    action: () => { focusIfNeeded(); editor?.chain().setTextAlign('left').run(); },
    isActive: editor?.isActive({ textAlign: 'left' }),
    contexts: ['text-formatting'],
    order: 6,
  },
  {
    id: 'align-center',
    icon: <TextAlignCenterIcon />,
    title: 'Align Center',
    action: () => { focusIfNeeded(); editor?.chain().setTextAlign('center').run(); },
    isActive: editor?.isActive({ textAlign: 'center' }),
    contexts: ['text-formatting'],
    order: 7,
  },
  {
    id: 'align-right',
    icon: <TextAlignEndIcon />,
    title: 'Align Right',
    action: () => { focusIfNeeded(); editor?.chain().setTextAlign('right').run(); },
    isActive: editor?.isActive({ textAlign: 'right' }),
    contexts: ['text-formatting'],
    order: 8,
  },
  {
    id: 'dialogue-layout-dropdown',
    icon: <LayoutListIcon />,
    title: 'Dialogue Layout',
    action: () => {},
    contexts: ['dialogue-layout', 'speaker-select'],
    order: 1,
    isSpecial: true,
  },
  {
    id: 'edit-all-toggle',
    icon: editAllSpeakers ? '👥' : '👤',
    title: editAllSpeakers ? 'Edit All Speakers (ON)' : 'Edit Single Speaker (OFF)',
    action: () => {
      logger.debug('Toolbar', 'Toggling edit all speakers mode');
      onToggleEditAllSpeakers?.();
    },
    isActive: editAllSpeakers,
    contexts: ['speaker-select'],
    order: 2,
  },
  {
    id: 'strike-through',
    icon: '⸺',
    title: 'Toggle Strike-through',
    action: () => {
      logger.debug('Toolbar', 'Toggling strike-through');
      focusIfNeeded();
      editor?.chain().toggleDialogueStrikeThrough().run();
    },
    isActive: (() => {
      let selection: any = null;
      try {
        selection = (editor as any)?.state?.selection || null;
      } catch {
        selection = null;
      }
      const $from = selection?.$from;
      if (!$from) return false;
      for (let depth = $from.depth; depth >= 0; depth--) {
        const node = $from.node(depth);
        if (node && node.type.name === 'dialogueBlock') {
          return node.attrs.struckThrough || false;
        }
      }
      return false;
    })(),
    contexts: ['dialogue-layout', 'speaker-select'],
    order: 3,
  },
  {
    id: 'speaker-dropdown',
    icon: '🗣️',
    title: 'Select Speaker',
    action: () => {},
    contexts: ['dialogue-layout', 'speaker-select'],
    order: 4,
    isSpecial: true,
  },
  {
    id: 'speaker-color-picker',
    icon: '🎨',
    title: 'Speaker Color',
    action: () => {},
    contexts: ['speaker-select'],
    order: 5,
    isSpecial: true,
  },
  {
    id: 'font-style',
    icon: 'Aa',
    title: 'Font Style',
    action: () => {},
    contexts: ['speaker-select', 'dialogue-layout'],
    order: 6,
    isSpecial: true,
  },
  {
    id: 'clear-speaker',
    icon: <Trash2Icon />,
    title: 'Delete Speaker + Dialogue',
    action: () => {
      logger.debug('Toolbar', 'Deleting speaker and dialogue block');
      focusIfNeeded();
      try {
        if (!editor) return;
        const { state } = editor;
        const $from = state.selection.$from;
        let blockPos: number | null = null;
        let blockNode: any = null;
        for (let d = $from.depth; d >= 0; d--) {
          const n = $from.node(d);
          if (n.type?.name === 'dialogueBlock') {
            blockPos = $from.before(d);
            blockNode = n;
            break;
          }
        }
        if (typeof blockPos === 'number' && blockNode) {
          const endPos = blockPos + blockNode.nodeSize;
          editor.chain().deleteRange({ from: blockPos, to: endPos }).run();
          requestDefaultContext();
          return;
        }
      } catch {
        // Ignore fallback attempt
      }
      editor?.chain().deleteSelection().insertContent('').run();
    },
    contexts: ['speaker-select'],
    order: 7,
  },
  {
    id: 'exit-dialogue',
    icon: <CornerDownLeftIcon />,
    title: 'Exit Dialogue Block (Create Normal Text)',
    action: () => {
      logger.debug('Toolbar', 'Exiting dialogue block');
      focusIfNeeded();
      editor?.chain().exitDialogueBlock().run();
      requestDefaultContext();
    },
    contexts: ['dialogue-layout', 'speaker-select'],
    order: 8,
  },
  {
    id: 'dialogue-layout-side-by-side',
    icon: '⇆',
    title: 'Side-by-side Layout',
    action: () => {
      focusIfNeeded();
      editor?.commands.setDialogueLayout('side-by-side');
    },
    isActive: editor?.isActive('dialogueBlock', { layout: 'side-by-side' }),
    contexts: ['dialogue-layout'],
    order: 9,
  },
  {
    id: 'dialogue-layout-centered',
    icon: '⬍',
    title: 'Centered Layout',
    action: () => {
      focusIfNeeded();
      editor?.commands.setDialogueLayout('centered');
    },
    isActive: editor?.isActive('dialogueBlock', { layout: 'centered' }),
    contexts: ['dialogue-layout'],
    order: 10,
  },
  {
    id: 'dialogue-layout-vertical',
    icon: '↕',
    title: 'Vertical Layout',
    action: () => {
      focusIfNeeded();
      editor?.commands.setDialogueLayout('vertical');
    },
    isActive: editor?.isActive('dialogueBlock', { layout: 'vertical' }),
    contexts: ['dialogue-layout'],
    order: 11,
  },
  {
    id: 'insert-dialogue',
    icon: <MessageSquareQuoteIcon />,
    title: 'Insert Dialogue Block',
    action: () => {
      logger.debug('Toolbar', 'Inserting dialogue block');
      focusIfNeeded();
      editor?.chain().insertDialogueBlock().run();
    },
    contexts: ['empty-page', 'default'],
    order: 1,
  },
  {
    id: 'split-page',
    icon: '⎘',
    title: 'Split Page',
    action: () => {
      logger.debug('Toolbar', 'Split page');
      focusIfNeeded();
      editor?.chain().insertContent('<hr>').run();
    },
    contexts: ['empty-page'],
    order: 2,
  },
  {
    id: 'view-mode-dropdown',
    icon: <LayoutPanelTopIcon />,
    title: viewMode === 'single-page' ? 'Single Page View' : (viewMode === 'borderless' ? 'Borderless View' : 'Multiple Pages View'),
    action: () => {},
    contexts: ['default'],
    order: 1,
    isSpecial: true,
  },
  {
    id: 'print',
    icon: <PrinterIcon />,
    title: 'Print / Export PDF',
    action: () => {
      try {
        const editorHtml: string = (editor && (editor as any).getHTML) ? (editor as any).getHTML() : '';
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          window.print();
          return;
        }
        const css = `
          @page { size: A4 portrait; margin: 12mm 15mm; }
          html, body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; padding: 0; }
          .print-container { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 12pt; line-height: 1.4; color: #111; }
          .page-indicator { break-before: page; page-break-before: always; }
          .page-indicator:first-of-type { break-before: auto; page-break-before: auto; }
          .page-indicator { margin: 0 0 8mm 0; }
          .page-indicator .page-label { font-weight: 700; font-size: 11pt; }
          [data-type="dialogue-block"] { margin: 8pt 0 12pt 0; }
          [data-type="speaker"] { font-weight: 700; margin: 0 0 3pt 0; }
          [data-type="dialogue-text"] p { margin: 0 0 6pt 0; }
          [data-type="dialogue-block"][data-layout="centered"] [data-type="speaker"] { text-align: center; }
          [data-type="dialogue-block"][data-layout="centered"] [data-type="dialogue-text"] { text-align: left; max-width: 60%; margin: 0 auto; }
          [data-type="dialogue-block"][data-layout="side-by-side"] { display: flex; gap: 8pt; align-items: flex-start; }
          [data-type="dialogue-block"][data-layout="side-by-side"] > [data-type="speaker"] { min-width: 25%; text-align: left; }
          [data-type="dialogue-block"][data-layout="side-by-side"] > [data-type="dialogue-text"] { flex: 1; }
          [data-type="dialogue-block"] { page-break-inside: avoid; }
        `;
        const doc = printWindow.document;
        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Script</title><style>${css}</style></head><body><div class="print-container">${editorHtml}</div></body></html>`);
        doc.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 100);
      } catch {
        window.print();
      }
    },
    contexts: ['default'],
    order: 4,
  },
  {
    id: 'delete-scene',
    icon: '🗑️',
    title: 'Delete Scene',
    action: () => {
      logger.debug('Toolbar', 'Deleting scene block');
      const state: any = (editor as any)?.state;
      const selection = state?.selection;
      const { $from } = selection;
      for (let depth = $from.depth; depth >= 0; depth--) {
        const node = $from.node(depth);
        if (node && node.type.name === 'sceneBlock') {
          const pos = $from.before(depth);
          const endPos = $from.after(depth);
          focusIfNeeded();
          editor?.chain().deleteRange({ from: pos, to: endPos }).run();
          setTimeout(() => {
            editor?.commands.renumberAllScenes();
          }, 50);
          break;
        }
      }
    },
    contexts: ['scene-select'],
    order: 1,
  },
  {
    id: 'ruler-adjust',
    icon: '📏',
    title: 'Adjust Margins',
    action: () => {},
    contexts: ['default'],
    order: 5,
    isSpecial: true,
  },
  {
    id: 'cue-dropdown',
    icon: '🎭',
    title: 'Insert Cue',
    action: () => {},
    contexts: ['default'],
    order: 10,
    isSpecial: true,
  },
  {
    id: 'add-scene',
    icon: <ClapperboardIcon />,
    title: 'Add Scene',
    action: () => { focusIfNeeded(); editor?.commands.insertSceneBlock(); },
    contexts: ['default'],
    order: 11,
  },
  {
    id: 'rehearsal-mode',
    icon: <GoalIcon />,
    title: rehearsalMode ? 'Exit Rehearsal Mode' : 'Enter Rehearsal Mode',
    action: () => { onToggleRehearsalMode?.(); },
    isActive: rehearsalMode,
    contexts: ['default'],
    order: 12,
  },
  {
    id: 'search-box',
    icon: <SearchIcon />,
    title: 'Search',
    action: () => {},
    contexts: ['default'],
    order: 13,
    isSpecial: true,
  },
  {
    id: 'cue-type-dropdown',
    icon: '🎭',
    title: 'Cue Type',
    action: () => {},
    contexts: ['cue-select'],
    order: 1,
    isSpecial: true,
  },
  {
    id: 'delete-cue',
    icon: '🗑️',
    title: 'Delete Cue',
    action: () => {
      logger.debug('Toolbar', 'Deleting cue block');
      focusIfNeeded();
      editor?.chain().deleteNode('cueBlock').run();
    },
    contexts: ['cue-select'],
    order: 2,
  },
  {
    id: 'exit-cue',
    icon: '↩',
    title: 'Exit Cue Block',
    action: () => {
      logger.debug('Toolbar', 'Exiting cue block');
      const { state } = editor!;
      const { selection } = state;
      const { from } = selection;
      let cueBlockPos = -1;
      let cueBlockNode: any = null;
      state.doc.nodesBetween(from, from, (node, pos) => {
        if (node.type.name === 'cueBlock') {
          cueBlockPos = pos;
          cueBlockNode = node;
          return false;
        }
        return undefined;
      });
      if (cueBlockPos >= 0 && cueBlockNode) {
        const endPos = cueBlockPos + cueBlockNode.nodeSize;
        focusIfNeeded();
        editor?.chain()
          .setTextSelection(endPos)
          .insertContent({ type: 'paragraph' })
          .run();
        requestDefaultContext();
      }
    },
    contexts: ['cue-select'],
    order: 3,
  },
];
