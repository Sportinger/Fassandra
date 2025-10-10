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

    let fixedSpeakers = 0;
    let fixedScenes = 0;
    let sceneNumber = 1;

    doc.transact(() => {
      defaultFragment.forEach((node) => {
        if (!(node instanceof Y.XmlElement)) return;

        // Fix scene blocks
        if (node.nodeName === 'sceneBlock') {
          const currentName = node.getAttribute('sceneName') || node.toString() || 'Szene';
          node.setAttribute('sceneNumber', sceneNumber.toString());
          if (!node.getAttribute('sceneName')) {
            node.setAttribute('sceneName', currentName);
          }
          if (sceneNumber <= 3) {
            console.log(`✓ Scene ${sceneNumber}: "${currentName}"`);
          }
          sceneNumber++;
          fixedScenes++;
        }

        // Fix dialogue blocks
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

            if (fixedSpeakers < 3) {
              console.log(`✓ Dialogue: "${speakerName}" → "${actualText.substring(0, 40)}..."`);
            }
            fixedSpeakers++;
          }
        }
      });
    });

    console.log(`\n✅ Complete fix:`);
    console.log(`  - Fixed ${fixedScenes} scenes (renumbered 1-${sceneNumber - 1})`);
    console.log(`  - Fixed ${fixedSpeakers} dialogues (speaker names moved to box)`);

    const newUpdate = Y.encodeStateAsUpdate(doc);
    const newStateVector = Y.encodeStateVector(doc);

    await fs.writeFile('/tmp/marquise_complete_fixed_state.bin', newUpdate);
    await fs.writeFile('/tmp/marquise_complete_fixed_vector.bin', newStateVector);

    console.log(`\n📁 Exported: ${newUpdate.length} bytes`);
    console.log('✅ Ready to upload!');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

main().catch(console.error);
