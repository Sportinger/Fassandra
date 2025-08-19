import { useEffect } from 'react';
import * as Y from 'yjs';

/**
 * Hook to migrate content from prosemirror text field to proper editor format
 * This is a workaround for Rust YRS limitations in creating ProseMirror XML structures
 */
export function useContentMigration(ydoc: Y.Doc | null, editor: any) {
  useEffect(() => {
    if (!ydoc || !editor) return;

    // Check if we need to migrate content
    const checkAndMigrate = () => {
      const prosemirrorText = ydoc.getText('prosemirror');
      const defaultFragment = ydoc.getXmlFragment('default');
      
      // If prosemirror has content but default fragment is empty, migrate
      if (prosemirrorText && prosemirrorText.length > 0 && defaultFragment.length === 0) {
        const textContent = prosemirrorText.toString();
        console.log('[Migration] Found content in prosemirror field:', textContent.substring(0, 100));
        
        // Parse the text content and create proper editor content
        const lines = textContent.split('\n').filter(line => line.trim());
        let htmlContent = '';
        
        for (const line of lines) {
          if (line === '---') {
            continue; // Skip dividers
          } else if (line.startsWith('[SCENE]')) {
            const sceneText = line.replace('[SCENE]', '').trim();
            htmlContent += `<div data-type="scene-block"><p>${sceneText}</p></div>`;
          } else if (line.startsWith('(') && line.endsWith(')')) {
            const stageDirection = line.slice(1, -1);
            htmlContent += `<div data-type="cue-block"><p>${stageDirection}</p></div>`;
          } else if (line.includes(':')) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0 && colonIndex < line.length - 1) {
              const speaker = line.substring(0, colonIndex).trim();
              const dialogue = line.substring(colonIndex + 1).trim();
              if (speaker && dialogue) {
                htmlContent += `<div data-type="dialogue-block"><span data-type="speaker">${speaker}</span><span data-type="dialogue-text">${dialogue}</span></div>`;
              } else {
                htmlContent += `<p>${line}</p>`;
              }
            } else {
              htmlContent += `<p>${line}</p>`;
            }
          } else {
            htmlContent += `<p>${line}</p>`;
          }
        }
        
        // Set the content in the editor
        if (htmlContent) {
          console.log('[Migration] Setting migrated content:', htmlContent.substring(0, 200));
          editor.commands.setContent(htmlContent);
          console.log('[Migration] Content migrated successfully');
        }
      }
    };

    // Check immediately
    checkAndMigrate();

    // Also check when document updates
    const handleUpdate = () => {
      checkAndMigrate();
    };

    ydoc.on('update', handleUpdate);

    return () => {
      ydoc.off('update', handleUpdate);
    };
  }, [ydoc, editor]);
}