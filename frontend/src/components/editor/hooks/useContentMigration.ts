import { useEffect } from 'react';
import * as Y from 'yjs';
import logger from '../../../services/LoggingService';

/**
 * Hook to migrate content from prosemirror text field to proper editor format
 * This is a workaround for Rust YRS limitations in creating ProseMirror XML structures
 */
export function useContentMigration(ydoc: Y.Doc | null, editor: any) {
  useEffect(() => {
    if (!ydoc || !editor) return;

    // Prevent double migration: use a Yjs metadata flag and a local guard
    let localMigrated = false;

    // Attempt migration from 'prosemirror' text to structured TipTap nodes
    // This supports scripts imported via the Rust YRS path that writes plain text into 'prosemirror'
    const checkAndMigrate = () => {
      const prosemirrorText = ydoc.getText('prosemirror');
      const defaultFragment = ydoc.getXmlFragment('default');
      const meta = ydoc.getMap('metadata');
      const alreadyMigrated = (meta.get('migrated') as any) === true;

      logger.info('useContentMigration', '[MIGRATION_CHECK] Checking for content migration:', {
        hasProsemirrorField: !!prosemirrorText,
        prosemirrorLength: prosemirrorText?.length || 0,
        defaultFragmentLength: defaultFragment.length,
        editorEmpty: editor.isEmpty
      });

      // If prosemirror has content but default fragment is empty, migrate
      if (!localMigrated && !alreadyMigrated && prosemirrorText && prosemirrorText.length > 0 && defaultFragment.length === 0) {
        const textContent = prosemirrorText.toString();
        logger.info('useContentMigration', '[MIGRATION_START] Found content in prosemirror field:', textContent.substring(0, 200));

        // Split into blocks on blank lines to preserve paragraph grouping
        const blocks = textContent
          .split(/\n\s*\n/g)
          .map((b: string) => b.trim())
          .filter((b: string) => b.length > 0 && b !== '---');

        // Build TipTap JSON content using custom nodes
        const docContent: any[] = [];

        for (const block of blocks) {
          // Page indicator: [PAGE] N
          const pageMatch = block.match(/^\[PAGE\]\s*(\d+)/i);
          if (pageMatch) {
            const n = parseInt(pageMatch[1], 10) || 1;
            // Insert visible page indicator node with number
            docContent.push({ type: 'pageIndicator', attrs: { pageNumber: n } });
            continue;
          }

          // Scene headers: [SCENE] Title
          const sceneMatch = block.match(/^\[SCENE\]\s*(.+)$/i);
          if (sceneMatch) {
            const sceneName = sceneMatch[1].trim();
            docContent.push({
              type: 'sceneBlock',
              attrs: { sceneName },
              content: [{ type: 'text', text: sceneName }],
            });
            continue;
          }

          // Stage directions: (text)
          if (block.startsWith('(') && block.endsWith(')')) {
            const stageDirection = block.slice(1, -1).trim();
            docContent.push({
              type: 'paragraph',
              content: [
                { type: 'text', text: stageDirection, marks: [{ type: 'italic' }] },
              ],
            });
            continue;
          }

          // Dialogue: Speaker: text (may contain newlines)
          const colonIdx = block.indexOf(':');
          if (colonIdx > 0 && colonIdx < block.length - 1) {
            const speaker = block.substring(0, colonIdx).trim();
            const dialogueRaw = block.substring(colonIdx + 1).trim();
            if (speaker && dialogueRaw) {
              // Split dialogue into paragraphs by single newlines
              const paragraphs = dialogueRaw.split(/\n+/).map((l: string) => l.trim()).filter((l: string) => l);
              const dialogueParagraphs = paragraphs.map((p: string) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: p }],
              }));

              docContent.push({
                type: 'dialogueBlock',
                content: [
                  { type: 'speaker', content: [{ type: 'text', text: speaker }] },
                  { type: 'dialogueText', content: dialogueParagraphs.length > 0 ? dialogueParagraphs : [{ type: 'paragraph' }] },
                ],
              });
              continue;
            }
          }

          // Fallback: plain paragraph
          docContent.push({
            type: 'paragraph',
            content: [{ type: 'text', text: block }],
          });
        }

        if (docContent.length > 0) {
          const contentJson = { type: 'doc', content: docContent } as any;
          logger.info('useContentMigration', '[MIGRATION_APPLY] Applying structured content', {
            blocks: docContent.length,
          });
          editor.commands.setContent(contentJson, false, { preserveWhitespace: true });
          logger.info('useContentMigration', '[MIGRATION_COMPLETE] Content migrated to TipTap nodes');

          // Mark migrated and clear source text to avoid re-running
          try {
            ydoc.transact(() => {
              meta.set('migrated', true as any);
              prosemirrorText.delete(0, prosemirrorText.length);
            });
            localMigrated = true;
          } catch (e) {
            logger.warn('useContentMigration', 'Failed to mark migration or clear source text', e);
          }
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
