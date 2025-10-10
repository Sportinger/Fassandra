#!/usr/bin/env node

import * as Y from 'yjs';
import fs from 'fs/promises';

const SCRIPT_ID = '4c65e973-21cf-4738-928c-abe4393cf2a6';

async function main() {
  try {
    console.log('Loading real Marquise von O script...');
    const baseState = await fs.readFile('/tmp/marquise_real_state.bin');
    console.log(`Loaded ${baseState.length} bytes\n`);

    const doc = new Y.Doc();
    Y.applyUpdate(doc, baseState);

    const defaultFragment = doc.getXmlFragment('default');
    console.log(`Document has ${defaultFragment.length} nodes\n`);

    // Analyze structure
    let sceneCount = 0;
    let dialogueCount = 0;
    let paragraphCount = 0;
    const issues = [];

    defaultFragment.forEach((node, index) => {
      if (node instanceof Y.XmlElement) {
        if (node.nodeName === 'sceneBlock') {
          sceneCount++;
          const num = node.getAttribute('sceneNumber');
          const name = node.getAttribute('sceneName');
          if (index < 10) {
            console.log(`Scene ${sceneCount}: number="${num}", name="${name}"`);
          }
        } else if (node.nodeName === 'dialogueBlock') {
          dialogueCount++;
        } else if (node.nodeName === 'paragraph') {
          paragraphCount++;
          const text = node.toString();
          if (text.includes('[SCENE]') || text.startsWith('SCENE')) {
            issues.push({ index, type: 'fake-scene', text: text.substring(0, 80) });
          }
          const speakerMatch = text.match(/^([A-ZÄÖÜ][^:]{0,50}):\s*(.+)$/s);
          if (speakerMatch) {
            issues.push({ index, type: 'speaker-in-paragraph', speaker: speakerMatch[1] });
          }
        }
      }
    });

    console.log(`\nAnalysis:`);
    console.log(`- Scene blocks: ${sceneCount}`);
    console.log(`- Dialogue blocks: ${dialogueCount}`);
    console.log(`- Paragraphs: ${paragraphCount}`);
    console.log(`- Issues found: ${issues.length}\n`);

    if (issues.length > 0) {
      console.log('Issues (first 5):');
      issues.slice(0, 5).forEach(i => console.log(`  - ${i.type}: ${i.text || i.speaker}`));
      console.log('');
    }

    // Fix scenes
    let sceneNumber = 1;
    let fixedCount = 0;

    doc.transact(() => {
      defaultFragment.forEach((node) => {
        if (node instanceof Y.XmlElement && node.nodeName === 'sceneBlock') {
          const currentNumber = node.getAttribute('sceneNumber');
          const currentName = node.getAttribute('sceneName') || node.toString() || 'Szene';

          node.setAttribute('sceneNumber', sceneNumber.toString());
          if (!node.getAttribute('sceneName')) {
            node.setAttribute('sceneName', currentName);
          }

          if (sceneNumber <= 5 || currentNumber === 'undefined' || currentNumber === '1') {
            console.log(`✓ Fixed scene ${sceneNumber}: "${currentName}" (was: ${currentNumber})`);
          }
          sceneNumber++;
          fixedCount++;
        }
      });
    });

    console.log(`\n✅ Fixed ${fixedCount} scenes (renumbered 1-${sceneNumber - 1})`);

    const newUpdate = Y.encodeStateAsUpdate(doc);
    const newStateVector = Y.encodeStateVector(doc);

    await fs.writeFile('/tmp/marquise_real_repaired_state.bin', newUpdate);
    await fs.writeFile('/tmp/marquise_real_repaired_vector.bin', newStateVector);

    console.log(`\n📁 Exported: ${newUpdate.length} bytes`);
    console.log('✅ Ready to upload!');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

main().catch(console.error);
