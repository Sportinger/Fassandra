import * as Y from 'yjs';

export class SimpleYjsBuilder {
  /**
   * Create a YJS document with content directly in the format TipTap expects
   */
  static buildFromScript(scriptData) {
    const ydoc = new Y.Doc();
    
    // Get the xmlFragment that TipTap uses
    const xmlFragment = ydoc.getXmlFragment('default');
    
    // Also create other expected fields
    ydoc.getText('prosemirror');
    const metadata = ydoc.getMap('metadata');
    
    // Store metadata
    if (scriptData.metadata) {
      metadata.set('title', scriptData.metadata.title);
      metadata.set('author', scriptData.metadata.author || '');
      metadata.set('totalPages', scriptData.metadata.total_pages);
    }
    
    // Build content as Y.XmlElements
    // TipTap expects a doc with paragraphs
    const doc = new Y.XmlElement('doc');
    
    // Add title
    if (scriptData.metadata?.title) {
      const titlePara = new Y.XmlElement('paragraph');
      const titleText = new Y.XmlText();
      titleText.insert(0, scriptData.metadata.title);
      titleText.format(0, scriptData.metadata.title.length, { bold: true });
      titlePara.insert(0, [titleText]);
      doc.insert(doc.length, [titlePara]);
    }
    
    // Add content items as paragraphs
    if (scriptData.content) {
      for (const item of scriptData.content) {
        const para = new Y.XmlElement('paragraph');
        const text = new Y.XmlText();
        
        let content = '';
        switch (item.type || item.content_type) {
          case 'scene':
            content = `[SCENE] ${item.content}`;
            text.insert(0, content);
            text.format(0, content.length, { bold: true });
            break;
            
          case 'stage_direction':
            content = `(${item.content})`;
            text.insert(0, content);
            text.format(0, content.length, { italic: true });
            break;
            
          case 'dialogue':
          case 'monologue':
            if (item.speaker) {
              const speakerText = `${item.speaker}: `;
              text.insert(0, speakerText);
              text.format(0, speakerText.length, { bold: true });
              text.insert(speakerText.length, item.content);
            } else {
              text.insert(0, item.content);
            }
            break;
            
          default:
            text.insert(0, item.content);
            break;
        }
        
        para.insert(0, [text]);
        doc.insert(doc.length, [para]);
      }
    }
    
    // Insert the doc into the fragment
    xmlFragment.insert(0, [doc]);
    
    // Get the update as binary
    const update = Y.encodeStateAsUpdate(ydoc);
    const stateVector = Y.encodeStateVector(ydoc);
    
    return { update, stateVector };
  }
}