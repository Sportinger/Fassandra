import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const SpeakerNameExtension = Extension.create({
  name: 'speakerName',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('speakerName'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (node.type.name === 'paragraph' && node.textContent) {
                const text = node.textContent;
                
                // Pattern to match speaker names: text before a colon at the start of a line
                // This matches patterns like "MAREN:", "ALEXANDER/MAREN:", "ALLE (Stimme vom Band):"
                const speakerMatch = text.match(/^([^:]+):/);
                
                if (speakerMatch) {
                  const speakerName = speakerMatch[1];
                  const speakerLength = speakerName.length;
                  const startPos = pos + 1; // Start position (after paragraph start)
                  const endPos = pos + 1 + speakerLength; // End position (length of speaker name)
                  
                  // Check if there are already manual formatting marks on this text
                  const $start = state.doc.resolve(startPos);
                  const $end = state.doc.resolve(endPos);
                  
                  // Check for existing strong, em, or textStyle marks
                  const hasManualFormatting = $start.marks().some(mark => 
                    mark.type.name === 'strong' || 
                    mark.type.name === 'em' || 
                    mark.type.name === 'textStyle'
                  );
                  
                  // Only apply default bold styling if no manual formatting exists
                  if (!hasManualFormatting) {
                    const decoration = Decoration.inline(
                      startPos,
                      endPos,
                      {
                        style: 'font-weight: bold; color: var(--color-text);'
                      }
                    );
                    decorations.push(decoration);
                  }
                }
              }
              return true;
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
}); 