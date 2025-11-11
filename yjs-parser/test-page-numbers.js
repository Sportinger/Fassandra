import { YjsDocumentBuilder } from './src/YjsDocumentBuilder.js';
import * as Y from 'yjs';
import { yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';

console.log('Testing page number preservation in YJS documents...\n');

// Create test data with page numbers
const testChunk = {
  mode: 'chunked',
  chunk: {
    number: 1,
    total: 1,
    pages_start: 1,
    pages_end: 2
  },
  content: [
    {
      type: 'scene',
      content: 'INT. OFFICE - DAY',
      page: 1,
      scene_number: '1'
    },
    {
      type: 'dialogue',
      speaker: 'JOHN',
      content: 'Hello, this is from page 1.',
      page: 1
    },
    {
      type: 'dialogue',
      speaker: 'JANE',
      content: 'And this is also from page 1.',
      page: 1
    },
    {
      type: 'stage_direction',
      content: 'Jane moves to page 2',
      page: 2
    },
    {
      type: 'dialogue',
      speaker: 'JANE',
      content: 'Now I am speaking on page 2.',
      page: 2
    }
  ]
};

// Build the document
const builder = new YjsDocumentBuilder();
const prosemirrorDoc = builder.buildProseMirrorDoc(testChunk);

console.log('1. Built ProseMirror document from test chunk');
console.log('   Content items:', testChunk.content.length);

// Convert to YJS XML Fragment
const ydoc = new Y.Doc();
const xmlFragment = ydoc.getXmlFragment('default');

const { prosemirrorToYXmlFragment } = await import('y-prosemirror');
prosemirrorToYXmlFragment(prosemirrorDoc, xmlFragment);

console.log('2. Converted to YXmlFragment');
console.log('   Fragment length:', xmlFragment.length);

// Convert back to ProseMirror JSON to inspect
const prosemirrorJSON = yXmlFragmentToProsemirrorJSON(xmlFragment);

console.log('\n3. Converted back to ProseMirror JSON:');
console.log(JSON.stringify(prosemirrorJSON, null, 2));

// Check if page numbers are preserved
console.log('\n4. Checking page number preservation:');
let pageNumbersFound = 0;
let pageNumbersMissing = 0;

if (prosemirrorJSON.content) {
  prosemirrorJSON.content.forEach((node, index) => {
    if (node.type === 'paragraph') {
      if (node.attrs && node.attrs.pageNumber) {
        pageNumbersFound++;
        console.log(`   ✓ Node ${index}: Page ${node.attrs.pageNumber} - ${node.content?.[0]?.text?.substring(0, 40)}...`);
      } else {
        pageNumbersMissing++;
        console.log(`   ✗ Node ${index}: NO PAGE NUMBER - ${node.content?.[0]?.text?.substring(0, 40)}...`);
      }
    }
  });
}

console.log(`\n5. Results:`);
console.log(`   Nodes with page numbers: ${pageNumbersFound}`);
console.log(`   Nodes missing page numbers: ${pageNumbersMissing}`);

if (pageNumbersFound > 0 && pageNumbersMissing === 0) {
  console.log('\n✅ SUCCESS: All page numbers preserved in YXmlFragment!');
} else if (pageNumbersFound > 0) {
  console.log('\n⚠️  PARTIAL: Some page numbers preserved, but some missing');
} else {
  console.log('\n❌ FAILED: Page numbers were lost during conversion');
}
