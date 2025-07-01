import React from 'react';
import { ContextMenu as ContextMenuType, ContextMenuAction } from './types';
import styles from './Editor.module.css';

interface ContextMenuProps {
  contextMenu: ContextMenuType;
  actions: (ContextMenuAction | { label: 'separator' })[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ contextMenu, actions }) => {
  if (!contextMenu.visible) return null;

  return (
    <div
      className={styles.contextMenu}
      style={{ top: contextMenu.y, left: contextMenu.x }}
    >
      {actions.map((item, index) =>
        item.label === 'separator' ? (
          <div key={index} className={styles.contextMenuSeparator} />
        ) : (
          <button
            key={index}
            onClick={(item as ContextMenuAction).action}
            disabled={(item as ContextMenuAction).disabled}
            className={`${styles.contextMenuItem} ${(item as ContextMenuAction).active ? styles.active : ''}`}
          >
            {(item as ContextMenuAction).label}
          </button>
        )
      )}
    </div>
  );
}; 