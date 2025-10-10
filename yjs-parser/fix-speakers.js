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

    let fixedCount = 0;
    let dialogueCount = 0;

    doc.transact(() => {
      defaultFragment.forEach((node) => {
        if (!(node instanceof Y.XmlElement) || node.nodeName !== 'dialogueBlock') {
          return;
        }

        dialogueCount++;
        let speakerNode = null;
        let dialogueTextNode = null;

        node.forEach(child => {
          if (child.nodeName === 'speaker') speakerNode = child;
          if (child.nodeName === 'dialogueText') dialogueTextNode = child;
        });

        if (!dialogueTextNode) return;

        // Get the first paragraph in dialogueText
        let firstParagraph = null;
        dialogueTextNode.forEach(child => {
          if (!firstParagraph && child.nodeName === 'paragraph') {
            firstParagraph = child;
          }
        });

        if (!firstParagraph) return;

        const text = firstParagraph.toString();
        const speakerMatch = text.match(/^([^:]+):\s*(.+)$/s);

        if (speakerMatch) {
          const speakerInText = speakerMatch[1].trim();
          const actualText = speakerMatch[2].trim();
          const currentSpeaker = speakerNode?.toString() || '';

          // Update speaker node if empty or different
          if (!currentSpeaker || currentSpeaker === '') {
            speakerNode?.delete(0, speakerNode.length);
            speakerNode?.insert(0, [new Y.XmlText(speakerInText)]);
          }

          // Remove speaker from dialogue text
          firstParagraph.delete(0, firstParagraph.length);
          firstParagraph.insert(0, [new Y.XmlText(actualText)]);

          if (fixedCount < 10) {
            console.log(`✓ Fixed dialogue ${dialogueCount}: "${speakerInText}" → "${actualText.substring(0, 50)}..."`);
          }
          fixedCount++;
        }
      });
    });

    console.log(`\n✅ Fixed ${fixedCount} dialogues (removed speaker from text)`);
    console.log(`Total dialogues: ${dialogueCount}`);

    const newUpdate = Y.encodeStateAsUpdate(doc);
    const newStateVector = Y.encodeStateVector(doc);

    await fs.writeFile('/tmp/marquise_speakers_fixed_state.bin', newUpdate);
    await fs.writeFile('/tmp/marquise_speakers_fixed_vector.bin', newStateVector);

    console.log(`\n📁 Exported: ${newUpdate.length} bytes`);
    console.log('✅ Ready to upload!');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

main().catch(console.error);
