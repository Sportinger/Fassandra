#!/usr/bin/env node

import * as Y from 'yjs';
import fs from 'fs/promises';

const SCRIPT_ID = '7ed36524-dfb5-4c29-8240-a3ffa4b984ed';

async function main() {
  try {
    // 1. Load the binary YJS state
    console.log('Loading YJS binary state from file...');
    const baseState = await fs.readFile('/tmp/marquise_yjs_state.bin');
    console.log(`Loaded ${baseState.length} bytes`);

    // 2. Create YJS document and load state
    const doc = new Y.Doc();
    Y.applyUpdate(doc, baseState);

    console.log('Document loaded successfully.\n');

    // 3. Analyze current structure
    const defaultFragment = doc.getXmlFragment('default');
    console.log(`Current document has ${defaultFragment.length} top-level nodes.\n`);

    let sceneCount = 0;
    let dialogueCount = 0;
    let paragraphCount = 0;
    const issues = [];

    defaultFragment.forEach((node, index) => {
      if (node instanceof Y.XmlElement) {
        if (node.nodeName === 'sceneBlock') {
          sceneCount++;
          const attrs = node.getAttributes();
          console.log(`Scene ${sceneCount}: number="${attrs.sceneNumber}", name="${attrs.sceneName}"`);
        } else if (node.nodeName === 'dialogueBlock') {
          dialogueCount++;
        } else if (node.nodeName === 'paragraph') {
          paragraphCount++;
          const text = node.toString();
          // Check if it's a fake scene
          if (text.includes('[SCENE]') || text.startsWith('SCENE')) {
            issues.push({ index, type: 'fake-scene', text: text.substring(0, 80) });
          }
          // Check if it has speaker pattern
          const speakerMatch = text.match(/^([A-ZÄÖÜ][^:]{0,50}):\s*(.+)$/s);
          if (speakerMatch) {
            issues.push({ index, type: 'speaker-in-paragraph', speaker: speakerMatch[1], text: text.substring(0, 80) });
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
      console.log('Sample issues (first 5):');
      issues.slice(0, 5).forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.index}] ${issue.type}: "${issue.text}..."`);
      });
      console.log('');
    }

    // 4. Create repaired document
    console.log('Creating repaired document...\n');
    const newDoc = new Y.Doc();
    const newFragment = newDoc.getXmlFragment('default');

    let currentSceneNumber = 1;
    const processedNodes = [];
    let conversions = {
      scenesFixed: 0,
      scenesCreated: 0,
      dialoguesCreated: 0,
      unchanged: 0
    };

    defaultFragment.forEach((node, index) => {
      if (!(node instanceof Y.XmlElement)) {
        processedNodes.push(node);
        return;
      }

      if (node.nodeName === 'paragraph') {
        const text = node.toString();

        // Check for [SCENE] pattern
        const sceneMatch = text.match(/^\[SCENE\]\s*(.+)$/);
        if (sceneMatch) {
          const sceneBlock = new Y.XmlElement('sceneBlock');
          sceneBlock.setAttribute('sceneNumber', currentSceneNumber.toString());
          sceneBlock.setAttribute('sceneName', sceneMatch[1].trim() || 'Szene');
          const sceneText = new Y.XmlText(sceneMatch[1].trim() || 'Szene');
          sceneBlock.insert(0, [sceneText]);
          processedNodes.push(sceneBlock);
          console.log(`  ✓ Created scene ${currentSceneNumber}: "${sceneMatch[1].trim()}"`);
          currentSceneNumber++;
          conversions.scenesCreated++;
          return;
        }

        // Check for speaker pattern (NAME: text)
        const speakerMatch = text.match(/^([A-ZÄÖÜ][^:]{0,50}):\s*(.+)$/s);
        if (speakerMatch) {
          const dialogueBlock = new Y.XmlElement('dialogueBlock');
          dialogueBlock.setAttribute('layout', 'default');

          const speaker = new Y.XmlElement('speaker');
          const speakerText = new Y.XmlText(speakerMatch[1].trim());
          speaker.insert(0, [speakerText]);

          const dialogueText = new Y.XmlElement('dialogueText');
          const paragraph = new Y.XmlElement('paragraph');
          const dialogueContent = new Y.XmlText(speakerMatch[2].trim());
          paragraph.insert(0, [dialogueContent]);
          dialogueText.insert(0, [paragraph]);

          dialogueBlock.insert(0, [speaker, dialogueText]);
          processedNodes.push(dialogueBlock);
          console.log(`  ✓ Created dialogue: "${speakerMatch[1]}" → "${speakerMatch[2].substring(0, 40)}..."`);
          conversions.dialoguesCreated++;
          return;
        }

        // Keep as regular paragraph
        processedNodes.push(node);
        conversions.unchanged++;
      } else if (node.nodeName === 'sceneBlock') {
        // Fix scene numbering
        const newSceneBlock = new Y.XmlElement('sceneBlock');
        newSceneBlock.setAttribute('sceneNumber', currentSceneNumber.toString());
        const sceneName = node.getAttribute('sceneName') || node.toString() || 'Szene';
        newSceneBlock.setAttribute('sceneName', sceneName);

        // Copy content
        const content = node.toString();
        if (content) {
          const sceneText = new Y.XmlText(content);
          newSceneBlock.insert(0, [sceneText]);
        }

        processedNodes.push(newSceneBlock);
        console.log(`  ✓ Fixed scene ${currentSceneNumber}: "${sceneName}"`);
        currentSceneNumber++;
        conversions.scenesFixed++;
      } else {
        // Keep other nodes as-is
        processedNodes.push(node);
        conversions.unchanged++;
      }
    });

    // Insert nodes one by one to avoid YJS integration issues
    processedNodes.forEach((node, index) => {
      newFragment.insert(index, [node]);
    });

    // Copy metadata
    const metadata = doc.getMap('metadata');
    const newMetadata = newDoc.getMap('metadata');
    metadata.forEach((value, key) => {
      newMetadata.set(key, value);
    });

    console.log(`\n✅ Repaired document created!`);
    console.log(`\nConversions:`);
    console.log(`- Scenes created from paragraphs: ${conversions.scenesCreated}`);
    console.log(`- Scenes renumbered: ${conversions.scenesFixed}`);
    console.log(`- Dialogues created from paragraphs: ${conversions.dialoguesCreated}`);
    console.log(`- Unchanged nodes: ${conversions.unchanged}`);
    console.log(`\nTotal scenes: ${currentSceneNumber - 1}`);
    console.log(`Total nodes: ${processedNodes.length}`);

    // 5. Export the new state
    const newUpdate = Y.encodeStateAsUpdate(newDoc);
    const newStateVector = Y.encodeStateVector(newDoc);

    await fs.writeFile('/tmp/marquise_repaired_state.bin', newUpdate);
    await fs.writeFile('/tmp/marquise_repaired_vector.bin', newStateVector);

    console.log('\n📁 Files written:');
    console.log('  - /tmp/marquise_repaired_state.bin');
    console.log('  - /tmp/marquise_repaired_vector.bin');

    console.log('\n✅ Repair complete! Now run the upload script to update the database.');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

main().catch(console.error);
