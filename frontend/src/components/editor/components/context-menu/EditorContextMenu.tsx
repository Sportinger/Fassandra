import React from 'react';
import { MessageSquareQuoteIcon } from '../../icons';
import type { ContextMenuAction, ContextMenuState, InsertSubmenuState } from './contextMenuTypes';
import type { ViewMode } from '../../types';

interface EditorContextMenuProps {
  menu: ContextMenuState;
  insertMenu: InsertSubmenuState;
  rehearsalMode: boolean;
  viewMode: ViewMode;
  editorHasSelection: boolean;
  onAction: (action: ContextMenuAction) => void;
  onInsertOpen: (rect: DOMRect) => void;
  onInsertClose: () => void;
}

export const EditorContextMenu: React.FC<EditorContextMenuProps> = ({
  menu,
  insertMenu,
  rehearsalMode,
  viewMode,
  editorHasSelection,
  onAction,
  onInsertOpen,
  onInsertClose,
}) => {
  if (!menu.visible) {
    return null;
  }

  return (
    <>
      <div 
        className="context-menu"
        style={{
          position: 'fixed',
          left: `${menu.x}px`,
          top: `${menu.y}px`,
          background: 'var(--color-background)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
          zIndex: 1000,
          minWidth: '200px',
          overflow: 'hidden',
        }}
      >
        {rehearsalMode && menu.hasWordTarget && (
          <div 
            className="context-menu-item"
            style={{
              padding: '10px 14px',
              cursor: 'pointer',
              borderBottom: '1px solid var(--color-border)',
              fontWeight: 'bold',
              color: '#ff6b6b',
            }}
            onClick={() => onAction('jump')}
          >
            Jump
          </div>
        )}
        {(menu.onPageBackground || editorHasSelection) && (
          <>
            {editorHasSelection && (
              <>
                <div
                  className="context-menu-item"
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                  onClick={() => onAction('add-comment')}
                >
                  💬 Add Comment
                </div>
                <div
                  className="context-menu-item"
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{ marginRight: '8px' }}>🖍️ Highlight</span>
                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); onAction('highlight-yellow'); }}
                      style={{ width: '20px', height: '20px', backgroundColor: '#fef08a', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer' }}
                      title="Yellow"
                    />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); onAction('highlight-green'); }}
                      style={{ width: '20px', height: '20px', backgroundColor: '#bbf7d0', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer' }}
                      title="Green"
                    />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); onAction('highlight-blue'); }}
                      style={{ width: '20px', height: '20px', backgroundColor: '#bfdbfe', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer' }}
                      title="Blue"
                    />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); onAction('highlight-pink'); }}
                      style={{ width: '20px', height: '20px', backgroundColor: '#fbcfe8', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer' }}
                      title="Pink"
                    />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); onAction('highlight-orange'); }}
                      style={{ width: '20px', height: '20px', backgroundColor: '#fed7aa', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer' }}
                      title="Orange"
                    />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); onAction('highlight-remove'); }}
                      style={{ width: '20px', height: '20px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}
                      title="Remove highlight"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </>
            )}
            <div 
              className="context-menu-item"
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                onInsertOpen(e.currentTarget.getBoundingClientRect());
              }}
              onMouseLeave={() => {
                /* keep submenu open */
              }}
            >
              <span>➕ Insert</span>
              <span style={{ opacity: 0.6 }}>▶</span>
            </div>
            <div 
              className="context-menu-item"
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
              }}
              onClick={() => onAction('toggle-view')}
            >
              {viewMode === 'single-page' ? '📄 Multiple Pages View' : '📃 Single Page View'}
            </div>
          </>
        )}
        
        {menu.onSpeakerName && (
          <>
            <div 
              className="context-menu-item"
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
              }}
              onClick={() => onAction('format-speakers')}
            >
              🗣️ Format All Speaker Names
            </div>
            <div 
              className="context-menu-item"
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
              }}
              onClick={() => onAction('change-speaker-color')}
            >
              🎨 Change Speaker Color
            </div>
          </>
        )}
      </div>

      {insertMenu.open && (
        <div
          className="context-submenu"
          style={{
            position: 'fixed',
            left: `${insertMenu.x}px`,
            top: `${insertMenu.y}px`,
            background: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
            zIndex: 1001,
            minWidth: '180px',
            padding: '4px 0',
          }}
          onMouseLeave={onInsertClose}
        >
          <div 
            className="context-menu-item" 
            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }} 
            onClick={() => onAction('insert-paragraph')}
          >
            📝 Free Text
          </div>
          <div 
            className="context-menu-item" 
            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }} 
            onClick={() => onAction('insert-dialogue')}
          >
            <MessageSquareQuoteIcon size={14} /> Dialogue
          </div>
          <div 
            className="context-menu-item" 
            style={{ padding: '10px 14px', cursor: 'pointer' }} 
            onClick={() => onAction('insert-scene')}
          >
            🎬 Scene
          </div>
        </div>
      )}
    </>
  );
};
