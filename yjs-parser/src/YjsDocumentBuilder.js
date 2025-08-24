import * as Y from 'yjs';
import { JSDOM } from 'jsdom';

// Set up DOM environment for ProseMirror
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = window.document;
global.navigator = window.navigator;

import { getSchema } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import { prosemirrorToYXmlFragment } from 'y-prosemirror';
import { Node as ProseMirrorNode } from 'prosemirror-model';

export class YjsDocumentBuilder {
  constructor() {
    this.extensions = [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
    ];
    
    this.schema = getSchema(this.extensions);
  }

  /**
   * Create a new YJS document with proper TipTap structure
   */
  createDocument() {
    const ydoc = new Y.Doc();
    
    // Create the standard YJS structures that TipTap expects
    const xmlFragment = ydoc.getXmlFragment('default');
    ydoc.getText('prosemirror');
    ydoc.getMap('metadata');
    
    return ydoc;
  }

  /**
   * Convert script content to YJS document
   * @param {Object} scriptData - Parsed script data
   * @returns {Uint8Array} - YJS update as binary
   */
  buildScriptDocument(scriptData) {
    const ydoc = this.createDocument();
    
    // Build ProseMirror document from script data
    const doc = this.buildProseMirrorDoc(scriptData);
    
    // Convert ProseMirror to YJS
    const xmlFragment = ydoc.getXmlFragment('default');
    prosemirrorToYXmlFragment(doc, xmlFragment);
    
    // Store metadata
    const metadata = ydoc.getMap('metadata');
    if (scriptData.metadata) {
      metadata.set('title', scriptData.metadata.title);
      metadata.set('author', scriptData.metadata.author || '');
      metadata.set('totalPages', scriptData.metadata.total_pages);
    }
    
    // Get the update as binary
    const stateVector = Y.encodeStateVector(ydoc);
    const update = Y.encodeStateAsUpdate(ydoc);
    
    return { update, stateVector };
  }

  /**
   * Build ProseMirror document from script content
   */
  buildProseMirrorDoc(scriptData) {
    const content = [];
    
    // Add title if present
    if (scriptData.metadata?.title) {
      content.push({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: scriptData.metadata.title,
            marks: [{ type: 'bold' }]
          }
        ]
      });
    }
    
    // Add author if present
    if (scriptData.metadata?.author) {
      content.push({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: `By ${scriptData.metadata.author}`,
            marks: [{ type: 'italic' }]
          }
        ]
      });
    }
    
    // Add separator
    if (scriptData.metadata) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: '---' }]
      });
    }
    
    // Process content items
    if (scriptData.content) {
      for (const item of scriptData.content) {
        const paragraph = this.contentItemToParagraph(item);
        if (paragraph) {
          content.push(paragraph);
        }
      }
    }
    
    // Create ProseMirror document
    const doc = this.schema.nodeFromJSON({
      type: 'doc',
      content: content
    });
    
    return doc;
  }

  /**
   * Convert a content item to ProseMirror paragraph
   */
  contentItemToParagraph(item) {
    let text = '';
    let marks = [];
    
    switch (item.type || item.content_type) {
      case 'scene':
        text = `[SCENE] ${item.content}`;
        marks = [{ type: 'bold' }];
        break;
        
      case 'stage_direction':
        text = `(${item.content})`;
        marks = [{ type: 'italic' }];
        break;
        
      case 'dialogue':
      case 'monologue':
        if (item.speaker) {
          // Create speaker line
          return {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `${item.speaker}: `,
                marks: [{ type: 'bold' }]
              },
              {
                type: 'text',
                text: item.content
              }
            ]
          };
        } else {
          text = item.content;
        }
        break;
        
      default:
        text = item.content;
        break;
    }
    
    return {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: text,
          marks: marks
        }
      ]
    };
  }

  /**
   * Process chunked script data
   */
  async processChunkedScript(chunks, scriptId) {
    const ydoc = this.createDocument();
    const updates = [];
    
    for (const chunk of chunks) {
      // Process each chunk and merge into document
      const chunkDoc = this.buildProseMirrorDoc(chunk);
      
      // Convert to YJS and merge
      const tempDoc = new Y.Doc();
      const tempFragment = tempDoc.getXmlFragment('default');
      prosemirrorToYXmlFragment(chunkDoc, tempFragment);
      
      // Get update from temp doc
      const update = Y.encodeStateAsUpdate(tempDoc);
      updates.push(update);
      
      // Apply update to main doc
      Y.applyUpdate(ydoc, update);
    }
    
    // Return final state
    const finalUpdate = Y.encodeStateAsUpdate(ydoc);
    return { update: finalUpdate, updates };
  }
}