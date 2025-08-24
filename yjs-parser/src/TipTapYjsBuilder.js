import { JSDOM } from 'jsdom';
import * as Y from 'yjs';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Collaboration from '@tiptap/extension-collaboration';

// Set up DOM environment for TipTap
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = window.document;
global.DOMParser = window.DOMParser;

// Use window's navigator instead of trying to set global
if (!global.navigator) {
  Object.defineProperty(global, 'navigator', {
    value: dom.window.navigator,
    writable: true,
    configurable: true
  });
}

export class TipTapYjsBuilder {
  static buildFromScript(scriptData) {
    // Create YJS document
    const ydoc = new Y.Doc();
    
    // Create editor with Collaboration extension
    const editor = new Editor({
      extensions: [
        Document,
        Paragraph,
        Text,
        Bold,
        Italic,
        Collaboration.configure({
          document: ydoc,
          field: 'default', // Same field TipTap uses in frontend
        }),
      ],
    });
    
    // Build HTML content
    let html = '';
    
    // Add title
    if (scriptData.metadata?.title) {
      html += `<p><strong>${scriptData.metadata.title}</strong></p>`;
    }
    
    // Add author
    if (scriptData.metadata?.author) {
      html += `<p><em>By ${scriptData.metadata.author}</em></p>`;
    }
    
    // Add separator
    if (scriptData.metadata) {
      html += '<p>---</p>';
    }
    
    // Add content
    if (scriptData.content) {
      for (const item of scriptData.content) {
        switch (item.type || item.content_type) {
          case 'scene':
            html += `<p><strong>[SCENE] ${item.content}</strong></p>`;
            break;
            
          case 'stage_direction':
            html += `<p><em>(${item.content})</em></p>`;
            break;
            
          case 'dialogue':
          case 'monologue':
            if (item.speaker) {
              html += `<p><strong>${item.speaker}:</strong> ${item.content}</p>`;
            } else {
              html += `<p>${item.content}</p>`;
            }
            break;
            
          default:
            html += `<p>${item.content}</p>`;
            break;
        }
      }
    }
    
    // Set content in editor (this will update the YJS document)
    editor.commands.setContent(html);
    
    // Store metadata
    const metadata = ydoc.getMap('metadata');
    if (scriptData.metadata) {
      metadata.set('title', scriptData.metadata.title);
      metadata.set('author', scriptData.metadata.author || '');
      metadata.set('totalPages', scriptData.metadata.total_pages);
    }
    
    // Get the update
    const update = Y.encodeStateAsUpdate(ydoc);
    const stateVector = Y.encodeStateVector(ydoc);
    
    // Clean up editor
    editor.destroy();
    
    return { update, stateVector };
  }
}