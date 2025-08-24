import * as Y from 'yjs';
import { DatabaseService } from './src/DatabaseService.js';

async function debugScript(scriptId) {
  const db = new DatabaseService();
  
  try {
    const baseState = await db.getBaseState(scriptId);
    
    if (!baseState || !baseState.baseState) {
      console.log('No base state found for script:', scriptId);
      return;
    }
    
    // Load the YJS document
    const doc = new Y.Doc();
    Y.applyUpdate(doc, baseState.baseState);
    
    console.log('\n=== YJS Document Debug for Script:', scriptId, '===\n');
    
    // Check all YJS types in the document
    const types = [];
    doc.share.forEach((value, key) => {
      types.push({ key, type: value.constructor.name });
    });
    
    console.log('YJS Types in document:');
    types.forEach(t => console.log(`  - ${t.key}: ${t.type}`));
    
    // Check xmlFragment('default')
    console.log('\n--- xmlFragment("default") ---');
    const defaultFragment = doc.getXmlFragment('default');
    console.log('Length:', defaultFragment.length);
    console.log('Content:', defaultFragment.toString().substring(0, 500));
    
    // Check xmlFragment('prosemirror')
    console.log('\n--- xmlFragment("prosemirror") ---');
    try {
      const prosemirrorFragment = doc.getXmlFragment('prosemirror');
      console.log('Length:', prosemirrorFragment.length);
      console.log('Content:', prosemirrorFragment.toString().substring(0, 500));
    } catch (e) {
      console.log('Does not exist');
    }
    
    // Check text('prosemirror')
    console.log('\n--- text("prosemirror") ---');
    const prosemirrorText = doc.getText('prosemirror');
    console.log('Length:', prosemirrorText.length);
    console.log('Content:', prosemirrorText.toString().substring(0, 500));
    
    // Check map('metadata')
    console.log('\n--- map("metadata") ---');
    const metadata = doc.getMap('metadata');
    const metaObj = {};
    metadata.forEach((value, key) => {
      metaObj[key] = value;
    });
    console.log('Metadata:', metaObj);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

// Get script ID from command line
const scriptId = process.argv[2];
if (!scriptId) {
  console.log('Usage: node debug-yjs.js <script-id>');
  process.exit(1);
}

debugScript(scriptId);