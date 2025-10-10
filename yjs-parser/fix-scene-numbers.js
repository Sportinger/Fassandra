#!/usr/bin/env node

import * as Y from 'yjs';
import fs from 'fs/promises';

async function main() {
  try {
    console.log('Loading Marquise von O script...');
    const baseState = await fs.readFile('/tmp/marquise_real_state.bin');
    const doc = new Y.Doc();
    Y.applyUpdate(doc, baseState);

    const defaultFragment = doc.getXmlFragment('default');
    console.log(`Document has ${defaultFragment.length} nodes\n`);

    let fixedScenes = 0;
    let fixedSpeakers = 0;

    doc.transact(() => {
      defaultFragment.forEach((node) => {
        if (!(node instanceof Y.XmlElement)) return;

        // Fix scene blocks
        if (node.nodeName === 'sceneBlock') {
          const currentName = node.getAttribute('sceneName') || node.toString() || '';

          // Try to extract number from scene name
          // Patterns: "SZENE 1.2", "16.2.", "17.1. Erika Renner", "29. Monsieur Pelicot"
          let sceneNumber = null;
          let newSceneName = currentName;

          // Pattern 1: "SZENE X" or "SZENE X.Y"
          const pattern1 = currentName.match(/^SZENE\s+(\d+\.?\d*)/i);
          if (pattern1) {
            sceneNumber = pattern1[1];
            newSceneName = 'SZENE';
          } else {
            // Pattern 2: Just number at start "16.2." or "17.1. Name"
            const pattern2 = currentName.match(/^(\d+\.?\d*\.?)\s*(.*)/);
            if (pattern2) {
              sceneNumber = pattern2[1].replace(/\.$/, ''); // Remove trailing dot
              newSceneName = pattern2[2] || 'SZENE';
            }
          }

          if (sceneNumber) {
            node.setAttribute('sceneNumber', sceneNumber);
            node.setAttribute('sceneName', newSceneName);

            if (fixedScenes < 15) {
              console.log(`✓ Scene: number="${sceneNumber}", name="${newSceneName}"`);
            }
            fixedScenes++;
          }
        }

        // Fix dialogue blocks (speaker names)
        if (node.nodeName === 'dialogueBlock') {
          let speakerNode = null;
          let dialogueTextNode = null;

          node.forEach(child => {
            if (child.nodeName === 'speaker') speakerNode = child;
            if (child.nodeName === 'dialogueText') dialogueTextNode = child;
          });

          if (!speakerNode || !dialogueTextNode) return;

          let firstParagraph = null;
          dialogueTextNode.forEach(child => {
            if (!firstParagraph && child.nodeName === 'paragraph') {
              firstParagraph = child;
            }
          });

          if (!firstParagraph) return;

          // Extract text from paragraph
          let text = '';
          firstParagraph.forEach(child => {
            if (child instanceof Y.XmlText) {
              text += child.toString();
            }
          });

          const speakerMatch = text.match(/^([^:]+):\s*(.+)$/s);

          if (speakerMatch) {
            const speakerName = speakerMatch[1].trim();
            const actualText = speakerMatch[2].trim();

            // Set speaker name in speaker box
            speakerNode.delete(0, speakerNode.length);
            speakerNode.insert(0, [new Y.XmlText(speakerName)]);

            // Remove speaker from dialogue text
            firstParagraph.delete(0, firstParagraph.length);
            firstParagraph.insert(0, [new Y.XmlText(actualText)]);

            fixedSpeakers++;
          }
        }
      });
    });

    console.log(`\n✅ Complete fix:`);
    console.log(`  - Fixed ${fixedScenes} scenes (extracted numbers from names)`);
    console.log(`  - Fixed ${fixedSpeakers} dialogues (speaker names moved to box)`);

    const newUpdate = Y.encodeStateAsUpdate(doc);
    const newStateVector = Y.encodeStateVector(doc);

    await fs.writeFile('/tmp/marquise_final_state.bin', newUpdate);
    await fs.writeFile('/tmp/marquise_final_vector.bin', newStateVector);

    console.log(`\n📁 Exported: ${newUpdate.length} bytes`);
    console.log('✅ Ready to upload!');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

main().catch(console.error);
