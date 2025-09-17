import React from 'react';
import type { Editor } from '@tiptap/react';
import type { ConnectionStatus } from '../types';
import type { WebsocketProvider } from 'y-websocket';
import { LoadingSpinner } from './ui/LoadingSpinner';
import type { CloseContextMenu } from './context-menu/contextMenuTypes';

interface EditorContentProps {
  editor: Editor | null;
  connectionStatus: ConnectionStatus;
  ydoc: any;
  provider: WebsocketProvider | null;
  onContextMenu: (event: React.MouseEvent) => void;
  closeContextMenu: CloseContextMenu;
  debugLog: (...args: any[]) => void;
  editAllSpeakers: boolean;
  setEditAllSpeakers: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentSpeakerName: (name: string | null) => void;
  liveRenameBaseRef: React.MutableRefObject<string | null>;
  hideContextMenu: () => void;
  showContextMenu: (x: number, y: number, context: any) => void;
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

        const target = e.target as HTMLElement;
        const speakerElement = target.closest('[data-type="speaker"]');
        const dialogueTextElement = target.closest('[data-type="dialogue-text"]');
        const dialogueBlockElement = target.closest('[data-type="dialogue-block"]');
        const cueBlockElement = target.closest('[data-type="cue-block"]');
        const sceneBlockElement = target.closest('[data-type="scene-block"]');

        const previouslySelectedSpeaker = document.querySelector('[data-type="speaker"].speaker-selected') as HTMLElement | null;
        const prevSpeakerBlock = previouslySelectedSpeaker?.closest('[data-type="dialogue-block"]');
        const currentClickBlock = target.closest('[data-type="dialogue-block"]');
        if (!previouslySelectedSpeaker || !prevSpeakerBlock || prevSpeakerBlock !== currentClickBlock) {
          document.querySelectorAll('[data-type="speaker"].speaker-selected').forEach(el => {
            el.classList.remove('speaker-selected');
            try { (el as HTMLElement).removeAttribute('data-speaker-selected'); } catch {}
            try {
              const hel = el as HTMLElement;
              hel.style.removeProperty('border');
              hel.style.removeProperty('outline');
              hel.style.removeProperty('outline-offset');
              hel.style.removeProperty('padding');
              hel.style.removeProperty('box-shadow');
            } catch {}
          });
          try {
            const anyEditor = editor as any;
            const { state, view } = anyEditor;
            let tr = state.tr;
            let changed = false;
            state.doc.descendants((node: any, position: number) => {
              if (node.type?.name === 'speaker' && node.attrs?.selected) {
                tr = tr.setNodeMarkup(position, undefined, { ...node.attrs, selected: false });
                changed = true;
              }
              return true;
            });
            if (changed) view.dispatch(tr);
          } catch {}
        }

        document.querySelectorAll('[data-type="cue-block"].cue-selected').forEach(el => el.classList.remove('cue-selected'));
        document.querySelectorAll('[data-type="scene-block"].scene-selected').forEach(el => el.classList.remove('scene-selected'));

        if (speakerElement) {
          debugLog('[Editor] Clicked on speaker element:', speakerElement);
          const speakerName = speakerElement.textContent?.trim() || '';
          setCurrentSpeakerName(speakerName);
          if (editAllSpeakers) liveRenameBaseRef.current = speakerName;

          try {
            const anyEditor = editor as any;
            const view: any = anyEditor.view;
            const { state } = editor;
            let targetPos: number | null = null;
            state.doc.descendants((node, position) => {
              if (node.type.name === 'speaker') {
                const domForNode = view.nodeDOM(position) as HTMLElement | null;
                if (domForNode && (domForNode === speakerElement || domForNode.contains(speakerElement))) {
                  targetPos = position;
                  return false;
                }
              }
              return true;
            });
            if (typeof targetPos === 'number') {
              const nodeAt = state.doc.nodeAt(targetPos);
              if (nodeAt) {
                let tr = state.tr;
                state.doc.descendants((node, position) => {
                  if (node.type.name === 'speaker' && node.attrs.selected) {
                    tr = tr.setNodeMarkup(position, undefined, { ...node.attrs, selected: false });
                  }
                  return true;
                });
                tr = tr.setNodeMarkup(targetPos, undefined, { ...nodeAt.attrs, selected: true });
                view.dispatch(tr);
                const end = targetPos + 1 + nodeAt.content.size;
                try {
                  (editor as any).chain().setTextSelection(end).focus().run();
                } catch {}
              }
            }
          } catch {}

          if (editAllSpeakers) {
            document.querySelectorAll('[data-type="speaker"]').forEach(el => {
              if (el.textContent?.trim() === speakerName) {
                el.classList.add('speaker-selected');
                try { el.setAttribute('data-speaker-selected', 'true'); } catch {}
              } else {
                el.classList.remove('speaker-selected');
                try { el.removeAttribute('data-speaker-selected'); } catch {}
              }
            });
          } else {
            speakerElement.classList.add('speaker-selected');
            try { speakerElement.setAttribute('data-speaker-selected', 'true'); } catch {}
          }

          showContextMenu(e.clientX, e.clientY, 'speaker-select');
          e.stopPropagation();
        } else if (dialogueTextElement && dialogueBlockElement) {
          debugLog('[Editor] Clicked on dialogue text element:', dialogueTextElement);

          const speakerInBlock = dialogueBlockElement.querySelector('[data-type="speaker"]');
          if (speakerInBlock) {
            const speakerName = speakerInBlock.textContent?.trim() || '';
            setCurrentSpeakerName(speakerName);
            if (editAllSpeakers) {
              document.querySelectorAll('[data-type="speaker"]').forEach(el => {
                if (el.textContent?.trim() === speakerName) {
                  el.classList.add('speaker-selected');
                }
              });
            }
          }

          showContextMenu(e.clientX, e.clientY, 'text-formatting');
          e.stopPropagation();
        } else if (cueBlockElement) {
          debugLog('[Editor] Clicked on cue block element:', cueBlockElement);
          cueBlockElement.classList.add('cue-selected');
          showContextMenu(e.clientX, e.clientY, 'cue-select');
          e.stopPropagation();
        } else if (sceneBlockElement) {
          debugLog('[Editor] Clicked on scene block element:', sceneBlockElement);
          sceneBlockElement.classList.add('scene-selected');
          try {
            const anyEditor = editor as any;
            const view: any = anyEditor.view;
            const posInNode = view.posAtDOM(sceneBlockElement, 0);
            if (typeof posInNode === 'number' && posInNode >= 0) {
              editor.chain().setTextSelection(Math.min(posInNode + 1, editor.state.doc.content.size - 1)).run();
            }
          } catch {}
          showContextMenu(e.clientX, e.clientY, 'scene-select');
          e.stopPropagation();
        } else {
          hideContextMenu();
          setEditAllSpeakers(false);
          setCurrentSpeakerName(null);
          try {
            const anyEditor = editor as any;
            const { state, view } = anyEditor;
            let tr = state.tr;
            let changed = false;
            state.doc.descendants((node: any, position: number) => {
              if (node.type?.name === 'speaker' && node.attrs?.selected) {
                tr = tr.setNodeMarkup(position, undefined, { ...node.attrs, selected: false });
                changed = true;
              }
              return true;
            });
            if (changed) view.dispatch(tr);
          } catch {}
        }
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
