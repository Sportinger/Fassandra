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

    // Attempt migration from legacy text/XML fields to structured TipTap nodes
    // This supports scripts imported via the Rust YRS path that writes plain text into 'prosemirror'
    const checkAndMigrate = () => {
      // Access legacy 'prosemirror' as text safely; also look for alternatives.
      let prosemirrorText: Y.Text | null = null;
      try { prosemirrorText = ydoc.getText('prosemirror'); } catch {}
      let contentText: Y.Text | null = null;
      try { contentText = ydoc.getText('content'); } catch {}
      // 'prosemirror' might be a Text in legacy docs; guard the XML access
      let prosemirrorXml: Y.XmlFragment | null = null;
      try { prosemirrorXml = ydoc.getXmlFragment('prosemirror'); } catch {}
      const defaultFragment = ydoc.getXmlFragment('default');
      const meta = ydoc.getMap('metadata');
      const alreadyMigrated = (meta.get('migrated') as any) === true;

      // 🔧 FIXED: Only log during initial check, not on every keystroke
      if (import.meta.env.DEV) {
        logger.debug('useContentMigration', '[MIGRATION_CHECK] Initial migration check:', {
          hasProsemirrorField: !!prosemirrorText,
          alreadyMigrated
        });
      }

      // If legacy 'prosemirror' text has content and the current editor
      // document is effectively empty, migrate. Consider the document
      // empty when the TipTap editor reports empty (it may pre‑create
      // a single empty paragraph which makes defaultFragment.length > 0).
      const editorIsEffectivelyEmpty = !!editor?.isEmpty;
      const shouldMigrateFromText = prosemirrorText && prosemirrorText.length > 0;
      const shouldMigrateFromContentText = !shouldMigrateFromText && contentText && contentText.length > 0;
      const shouldMigrateFromXml = !shouldMigrateFromText && !shouldMigrateFromContentText && prosemirrorXml && prosemirrorXml.length > 0;

      // Detect server-side fallback content: only paragraphs and text nodes
      const contentJson = !editorIsEffectivelyEmpty ? (editor.getJSON?.() || null) : null;
      const hasOnlyParagraphs = (() => {
        if (!contentJson || !Array.isArray(contentJson.content)) return false;
        const stack: any[] = [...contentJson.content];
        while (stack.length) {
          const node = stack.pop();
          if (!node) continue;
          if (node.type && !['paragraph', 'text', 'doc'].includes(node.type)) return false;
          if (Array.isArray(node.content)) stack.push(...node.content);
        }
        return true;
      })();

      const shouldForceMigration = (shouldMigrateFromText || shouldMigrateFromContentText || shouldMigrateFromXml) && (editorIsEffectivelyEmpty || (hasOnlyParagraphs && !alreadyMigrated));
      if (!localMigrated && shouldForceMigration) {
        const textContent = shouldMigrateFromText
          ? prosemirrorText!.toString()
          : shouldMigrateFromContentText
            ? contentText!.toString()
            : prosemirrorXml!.toString();

        if (import.meta.env.DEV) {
          logger.info('useContentMigration', '[MIGRATION_START] Found content in prosemirror field:', textContent.substring(0, 200));
        }

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
          if (import.meta.env.DEV) {
            logger.info('useContentMigration', '[MIGRATION_APPLY] Applying structured content', {
              blocks: docContent.length,
            });
          }
          editor.commands.setContent(contentJson, false, { preserveWhitespace: true });
          if (import.meta.env.DEV) {
            logger.info('useContentMigration', '[MIGRATION_COMPLETE] Content migrated to TipTap nodes');
          }

          // Mark migrated and clear source text to avoid re-running
          try {
            ydoc.transact(() => {
              meta.set('migrated', true as any);
              if (prosemirrorText && prosemirrorText.length > 0) {
                prosemirrorText.delete(0, prosemirrorText.length);
              }
              if (contentText && contentText.length > 0) {
                contentText.delete(0, contentText.length);
              }
              // Don't modify XML fragment; leave as-is
            });
            localMigrated = true;
          } catch (e) {
            logger.warn('useContentMigration', 'Failed to mark migration or clear source text', e);
          }
        }
      }
    };

    // 🔧 CRITICAL FIX: Only run migration once on mount, NOT on every YJS update
    // Running on every update was causing lag on every keystroke
    checkAndMigrate();

    // No need to listen to updates - migration is a one-time operation
    // If we need to re-check, it will happen when the component remounts
  }, [ydoc, editor]);
}
