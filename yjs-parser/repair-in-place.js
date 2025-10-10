#!/usr/bin/env node

import * as Y from 'yjs';
import fs from 'fs/promises';

async function main() {
  try {
    console.log('Loading YJS binary state from file...');
    const baseState = await fs.readFile('/tmp/marquise_yjs_state.bin');
    console.log(`Loaded ${baseState.length} bytes\n`);

    const doc = new Y.Doc();
    Y.applyUpdate(doc, baseState);

    const defaultFragment = doc.getXmlFragment('default');
    console.log(`Document has ${defaultFragment.length} nodes\n`);

    //  Fix all scene blocks in place
    let sceneNumber = 1;
    let fixedCount = 0;

    doc.transact(() => {
      defaultFragment.forEach((node) => {
        if (node instanceof Y.XmlElement && node.nodeName === 'sceneBlock') {
          const currentNumber = node.getAttribute('sceneNumber');
          const currentName = node.getAttribute('sceneName') || node.toString() || 'Szene';

          // Set the correct scene number
          node.setAttribute('sceneNumber', sceneNumber.toString());

          // Make sure sceneName is set
          if (!node.getAttribute('sceneName')) {
            node.setAttribute('sceneName', currentName);
          }

          console.log(`✓ Fixed scene ${sceneNumber}: "${currentName}" (was: ${currentNumber})`);
          sceneNumber++;
          fixedCount++;
        }
      });
    });

    console.log(`\n✅ Fixed ${fixedCount} scenes (renumbered 1-${sceneNumber - 1})`);

    // Export the repaired state
    const newUpdate = Y.encodeStateAsUpdate(doc);
    const newStateVector = Y.encodeStateVector(doc);

    await fs.writeFile('/tmp/marquise_repaired_state.bin', newUpdate);
    await fs.writeFile('/tmp/marquise_repaired_vector.bin', newStateVector);

    const stats = await fs.stat('/tmp/marquise_repaired_state.bin');
    console.log(`\n📁 Exported repaired state: ${stats.size} bytes`);
    console.log('  - /tmp/marquise_repaired_state.bin');
    console.log('  - /tmp/marquise_repaired_vector.bin');

    console.log('\n✅ Repair complete! Ready to upload to database.');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

main().catch(console.error);
