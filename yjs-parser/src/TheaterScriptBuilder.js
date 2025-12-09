import * as Y from 'yjs';
import { JSDOM } from 'jsdom';

// Set up DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = window.document;
if (!global.navigator) {
  global.navigator = window.navigator;
}

import { getSchema } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import { Node, mergeAttributes } from '@tiptap/core';
import { prosemirrorToYXmlFragment } from 'y-prosemirror';

// Define the custom TipTap nodes to match the frontend schema

const Speaker = Node.create({
  name: 'speaker',
  content: 'text*',
  group: 'block',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="speaker"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'speaker' }), 0];
  },
});

const DialogueText = Node.create({
  name: 'dialogueText',
  content: 'paragraph+',
  group: 'block',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="dialogue-text"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'dialogue-text' }), 0];
  },
});

const DialogueBlock = Node.create({
  name: 'dialogueBlock',
  group: 'block',
  content: 'speaker dialogueText',
  draggable: true,

  addAttributes() {
    return {
      layout: {
        default: 'default',
      },
      struckThrough: {
        default: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="dialogue-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'dialogue-block' }), 0];
  },
});

const SceneBlock = Node.create({
  name: 'sceneBlock',
  group: 'block',
  content: 'inline*',
  draggable: true,

  addAttributes() {
    return {
      sceneNumber: {
        default: '1',
      },
      sceneName: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="scene-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'scene-block' }), 0];
  },
});

/**
 * Builder that creates YJS documents with proper TipTap theater script structure
 */
export class TheaterScriptBuilder {
  constructor() {
    this.extensions = [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Speaker,
      DialogueText,
      DialogueBlock,
      SceneBlock,
    ];

    this.schema = getSchema(this.extensions);
  }

  /**
   * Create a new YJS document
   */
  createDocument() {
    const ydoc = new Y.Doc();
    ydoc.getXmlFragment('default');
    ydoc.getText('prosemirror');
    ydoc.getMap('metadata');
    return ydoc;
  }

  /**
   * Build a complete script document from parsed content
   */
  buildScriptDocument(scriptData) {
    const ydoc = this.createDocument();
    const doc = this.buildProseMirrorDoc(scriptData);

    const xmlFragment = ydoc.getXmlFragment('default');
    prosemirrorToYXmlFragment(doc, xmlFragment);

    // Store metadata
    const metadata = ydoc.getMap('metadata');
    if (scriptData.metadata) {
      metadata.set('title', scriptData.metadata.title);
      metadata.set('author', scriptData.metadata.author || '');
      metadata.set('totalPages', scriptData.metadata.total_pages);
    }

    const stateVector = Y.encodeStateVector(ydoc);
    const update = Y.encodeStateAsUpdate(ydoc);

    return { update, stateVector };
  }

  /**
   * Build ProseMirror document from script content
   */
  buildProseMirrorDoc(scriptData) {
    const content = [];

    // Process each content item
    if (scriptData.content) {
      for (const item of scriptData.content) {
        const node = this.contentItemToNode(item);
        if (node) {
          content.push(node);
        }
      }
    }

    // Ensure we have at least one paragraph
    if (content.length === 0) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: ' ' }]
      });
    }

    const doc = this.schema.nodeFromJSON({
      type: 'doc',
      content: content
    });

    return doc;
  }

  /**
   * Convert a content item to the appropriate ProseMirror node
   */
  contentItemToNode(item) {
    switch (item.type) {
      case 'scene':
        return this.createSceneBlock(item);

      case 'dialogue':
        return this.createDialogueBlock(item);

      case 'stage_direction':
        return this.createStageDirection(item);

      default:
        // Regular paragraph
        return {
          type: 'paragraph',
          content: item.content ? [{ type: 'text', text: item.content }] : []
        };
    }
  }

  /**
   * Create a sceneBlock node
   */
  createSceneBlock(item) {
    return {
      type: 'sceneBlock',
      attrs: {
        sceneNumber: item.scene_number || '1',
        sceneName: item.scene_name || item.content || '',
      },
      content: item.scene_name ? [{ type: 'text', text: item.scene_name }] :
               item.content ? [{ type: 'text', text: item.content }] : []
    };
  }

  /**
   * Create a dialogueBlock node with speaker and dialogueText
   */
  createDialogueBlock(item) {
    // Clean up the dialogue text - replace multiple spaces
    const dialogueContent = (item.content || '').replace(/\s+/g, ' ').trim();

    return {
      type: 'dialogueBlock',
      attrs: {
        layout: 'default',
        struckThrough: false,
      },
      content: [
        {
          type: 'speaker',
          content: [{ type: 'text', text: item.speaker || 'SPEAKER' }]
        },
        {
          type: 'dialogueText',
          content: [
            {
              type: 'paragraph',
              content: dialogueContent ? [{ type: 'text', text: dialogueContent }] : []
            }
          ]
        }
      ]
    };
  }

  /**
   * Create a stage direction as italic paragraph
   */
  createStageDirection(item) {
    const text = (item.content || '').trim();

    return {
      type: 'paragraph',
      content: text ? [
        {
          type: 'text',
          text: text,
          marks: [{ type: 'italic' }]
        }
      ] : []
    };
  }
}
