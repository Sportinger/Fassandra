import * as Y from 'yjs';
import { prosemirrorToYDoc, yDocToProsemirrorJSON } from 'y-prosemirror';

export class DirectYjsBuilder {
  static buildFromScript(scriptData) {
    const ydoc = new Y.Doc();
    
    // This is the exact structure TipTap expects
    const xmlFragment = ydoc.getXmlFragment('default');
    
    // Create metadata
    const metadata = ydoc.getMap('metadata');
    if (scriptData.metadata) {
      metadata.set('title', scriptData.metadata.title);
      metadata.set('author', scriptData.metadata.author || '');
      metadata.set('totalPages', scriptData.metadata.total_pages);
    }
    
    // Build ProseMirror JSON structure (this is what TipTap actually uses)
    const doc = {
      type: 'doc',
      content: []
    };
    
    // Add title
    if (scriptData.metadata?.title) {
      doc.content.push({
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
    
    // Add author
    if (scriptData.metadata?.author) {
      doc.content.push({
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
      doc.content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: '---' }]
      });
    }
    
    // Add content
    if (scriptData.content) {
      for (const item of scriptData.content) {
        const paragraph = { type: 'paragraph', content: [] };
        
        switch (item.type || item.content_type) {
          case 'scene':
            paragraph.content.push({
              type: 'text',
              text: `[SCENE] ${item.content}`,
              marks: [{ type: 'bold' }]
            });
            break;
            
          case 'stage_direction':
            paragraph.content.push({
              type: 'text',
              text: `(${item.content})`,
              marks: [{ type: 'italic' }]
            });
            break;
            
          case 'dialogue':
          case 'monologue':
            if (item.speaker) {
              paragraph.content.push({
                type: 'text',
                text: `${item.speaker}: `,
                marks: [{ type: 'bold' }]
              });
              paragraph.content.push({
                type: 'text',
                text: item.content
              });
            } else {
              paragraph.content.push({
                type: 'text',
                text: item.content
              });
            }
            break;
            
          default:
            paragraph.content.push({
              type: 'text',
              text: item.content
            });
            break;
        }
        
        doc.content.push(paragraph);
      }
    }
    
    // Now we need to convert this ProseMirror JSON to YJS
    // This is the tricky part - we need to manually build the YJS structure
    
    // Create the doc element
    const docElement = new Y.XmlElement('doc');
    
    // Add each paragraph
    for (const node of doc.content) {
      if (node.type === 'paragraph') {
        const para = new Y.XmlElement('paragraph');
        
        // Add text content
        if (node.content) {
          for (const inline of node.content) {
            if (inline.type === 'text') {
              const text = new Y.XmlText();
              text.insert(0, inline.text);
              
              // Apply marks
              if (inline.marks) {
                for (const mark of inline.marks) {
                  if (mark.type === 'bold') {
                    text.format(0, inline.text.length, { bold: true });
                  } else if (mark.type === 'italic') {
                    text.format(0, inline.text.length, { italic: true });
                  }
                }
              }
              
              para.insert(para.length, [text]);
            }
          }
        }
        
        docElement.insert(docElement.length, [para]);
      }
    }
    
    // Insert the doc into the fragment
    xmlFragment.insert(0, [docElement]);
    
    // Get the update
    const update = Y.encodeStateAsUpdate(ydoc);
    const stateVector = Y.encodeStateVector(ydoc);
    
    return { update, stateVector };
  }
}