import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

export interface SpeakerBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    speakerBlock: {
      /**
       * Set speaker block layout
       */
      setSpeakerLayout: (layout: 'default' | 'sidebyside' | 'wrap') => ReturnType;
      /**
       * Insert a speaker block
       */
      insertSpeakerBlock: (speaker: string, content: string, layout?: 'default' | 'sidebyside' | 'wrap') => ReturnType;
    };
  }
}

export const SpeakerBlockExtension = Node.create<SpeakerBlockOptions>({
  name: 'speakerBlock',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  content: 'inline*',

  addAttributes() {
    return {
      speaker: {
        default: '',
        parseHTML: element => element.getAttribute('data-speaker'),
        renderHTML: attributes => {
          if (!attributes.speaker) {
            return {};
          }
          return {
            'data-speaker': attributes.speaker,
          };
        },
      },
      layout: {
        default: 'default',
        parseHTML: element => element.getAttribute('data-layout') || 'default',
        renderHTML: attributes => {
          return {
            'data-layout': attributes.layout || 'default',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-speaker]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const layout = node.attrs.layout || 'default';
    const speaker = node.attrs.speaker || '';
    
    // Create a simple container with layout class - content hole must be the only child
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `speaker-block speaker-layout-${layout}`,
        'data-layout': layout,
        'data-speaker': speaker,
        'data-speaker-name': speaker, // Store speaker name as data attribute for CSS
      }),
      0, // Content hole must be the only child
    ];
  },

  addCommands() {
    return {
      setSpeakerLayout:
        (layout: 'default' | 'sidebyside' | 'wrap') =>
        ({ commands, state, tr }) => {
          const { selection } = state;
          const { from, to } = selection;
          
          let foundSpeakerBlock = false;
          
          // Find speaker blocks in the current selection
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'speakerBlock') {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                layout,
              });
              foundSpeakerBlock = true;
            }
          });
          
          if (foundSpeakerBlock) {
            return commands.command(({ tr: transaction }) => {
              transaction.setMeta('speakerLayoutChange', true);
              return true;
            });
          }
          
          return false;
        },

      insertSpeakerBlock:
        (speaker: string, content: string, layout = 'default') =>
        ({ commands }) => {
          // Create the speaker block node with content
          const nodeData: any = {
            type: 'speakerBlock',
            attrs: {
              speaker,
              layout,
            },
          };
          
          // If there's content, add it; otherwise create an empty block
          if (content && content.trim()) {
            nodeData.content = [
              {
                type: 'text',
                text: content,
              },
            ];
          }
          
          return commands.insertContent(nodeData);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Convert regular paragraphs with speaker pattern to speaker blocks
      'Mod-Shift-s': () => {
        return this.editor.commands.command(({ state, tr }) => {
          const { selection } = state;
          const { $from } = selection;
          
          if ($from.parent.type.name === 'paragraph') {
            const text = $from.parent.textContent;
            const speakerMatch = text.match(/^([^:]+):\s*(.*)$/);
            
            if (speakerMatch) {
              const speaker = speakerMatch[1].trim();
              const content = speakerMatch[2].trim();
              
              // Replace the paragraph with a speaker block
              const start = $from.start();
              const end = $from.end();
              
              tr.replaceWith(start, end, this.type.create({
                speaker,
                layout: 'default',
              }, state.schema.text(content)));
              
              return true;
            }
          }
          
          return false;
        });
      },
    };
  },
}); 