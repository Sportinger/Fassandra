import { SimpleYjsBuilder } from './src/SimpleYjsBuilder.js';
import { DatabaseService } from './src/DatabaseService.js';
import fs from 'fs';

// Test the simple builder
async function test() {
  const db = new DatabaseService();
  
  try {
    // Read test data
    const jsonData = JSON.parse(fs.readFileSync('../test.json', 'utf8'));
    
    // Build YJS document
    const { update, stateVector } = SimpleYjsBuilder.buildFromScript(jsonData);
    
    console.log('Created YJS document:');
    console.log('- Update size:', update.length, 'bytes');
    console.log('- First 100 bytes (hex):', Buffer.from(update.slice(0, 100)).toString('hex'));
    
    // Import to check structure
    const Y = await import('yjs');
    const testDoc = new Y.Doc();
    Y.applyUpdate(testDoc, update);
    
    const xmlFragment = testDoc.getXmlFragment('default');
    console.log('- XML Fragment length:', xmlFragment.length);
    console.log('- XML Fragment toString:', xmlFragment.toString());
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

test();