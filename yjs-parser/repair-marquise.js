#!/usr/bin/env node

import * as Y from 'yjs';
import pg from 'pg';
const { Pool } = pg;

const SCRIPT_ID = '7ed36524-dfb5-4c29-8240-a3ffa4b984ed';

async function main() {
  const pool = new Pool({
    host: 'localhost',
    port: 5433,
    database: 'pessoa_db',
    user: 'postgres',
    password: 'xKj9mP2sL4nB6vQ8',
  });

  try {
    // 1. Load the current YJS document from database
    console.log('Loading YJS document from database...');
    const result = await pool.query(
      'SELECT base_state FROM yjs_base_states WHERE script_id = $1',
      [SCRIPT_ID]
    );

    if (result.rows.length === 0) {
      console.error('No base state found for script:', SCRIPT_ID);
      process.exit(1);
    }

    const baseState = result.rows[0].base_state;

    // 2. Create YJS document and load current state
    const doc = new Y.Doc();
    Y.applyUpdate(doc, baseState);

    console.log('Document loaded successfully.');

    // 3. Analyze current structure
    const defaultFragment = doc.getXmlFragment('default');
    console.log(`\nCurrent document has ${defaultFragment.length} top-level nodes.`);

    let sceneCount = 0;
    let dialogueCount = 0;
    let paragraphCount = 0;
    const issues = [];

    defaultFragment.forEach((node, index) => {
      if (node instanceof Y.XmlElement) {
        if (node.nodeName === 'sceneBlock') {
          sceneCount++;
          const attrs = node.getAttributes();
          if (attrs.sceneNumber === '1' || !attrs.sceneNumber) {
            issues.push({ index, type: 'scene', issue: 'wrong number', attrs });
          }
        } else if (node.nodeName === 'dialogueBlock') {
          dialogueCount++;
        } else if (node.nodeName === 'paragraph') {
          paragraphCount++;
          const text = node.toString();
          // Check if it's a fake scene (starts with [SCENE])
          if (text.includes('[SCENE]') || text.includes('SCENE')) {
            issues.push({ index, type: 'fake-scene', text: text.substring(0, 100) });
          }
          // Check if it has speaker pattern (NAME:)
          const speakerMatch = text.match(/^([^:]+):/);
          if (speakerMatch) {
            issues.push({ index, type: 'speaker-in-paragraph', speaker: speakerMatch[1], text: text.substring(0, 100) });
          }
        }
      }
    });

    console.log(`\nAnalysis:`);
    console.log(`- Scene blocks: ${sceneCount}`);
    console.log(`- Dialogue blocks: ${dialogueCount}`);
    console.log(`- Paragraphs: ${paragraphCount}`);
    console.log(`- Issues found: ${issues.length}`);

    if (issues.length > 0) {
      console.log('\nFirst 10 issues:');
      issues.slice(0, 10).forEach(issue => {
        console.log(`  [${issue.index}] ${issue.type}:`, issue);
      });
    }

    // 4. Create a new repaired document
    console.log('\n\nCreating repaired document...');
    const newDoc = new Y.Doc();
    const newFragment = newDoc.getXmlFragment('default');

    let currentSceneNumber = 1;
    const processedNodes = [];

    defaultFragment.forEach((node, index) => {
      if (!(node instanceof Y.XmlElement)) {
        processedNodes.push(node);
        return;
      }

      if (node.nodeName === 'paragraph') {
        const text = node.toString();

        // Check if it's a fake scene paragraph
        const sceneMatch = text.match(/^\[SCENE\]\s*(.+)$/);
        if (sceneMatch) {
          // Convert to sceneBlock
          const sceneBlock = new Y.XmlElement('sceneBlock');
          sceneBlock.setAttribute('sceneNumber', currentSceneNumber.toString());
          sceneBlock.setAttribute('sceneName', sceneMatch[1] || 'Szene');
          const sceneText = new Y.XmlText(sceneMatch[1] || 'Szene');
          sceneBlock.insert(0, [sceneText]);
          processedNodes.push(sceneBlock);
          currentSceneNumber++;
          console.log(`  Converted paragraph to scene ${currentSceneNumber - 1}: "${sceneMatch[1]}"`);
          return;
        }

        // Check if paragraph has speaker pattern (should be dialogueBlock)
        const speakerMatch = text.match(/^([^:]+):\s*(.+)$/s);
        if (speakerMatch) {
          // Convert to dialogueBlock
          const dialogueBlock = new Y.XmlElement('dialogueBlock');
          dialogueBlock.setAttribute('layout', 'default');

          // Create speaker node
          const speaker = new Y.XmlElement('speaker');
          const speakerText = new Y.XmlText(speakerMatch[1].trim());
          speaker.insert(0, [speakerText]);

          // Create dialogueText node
          const dialogueText = new Y.XmlElement('dialogueText');
          const paragraph = new Y.XmlElement('paragraph');
          const dialogueContent = new Y.XmlText(speakerMatch[2].trim());
          paragraph.insert(0, [dialogueContent]);
          dialogueText.insert(0, [paragraph]);

          dialogueBlock.insert(0, [speaker, dialogueText]);
          processedNodes.push(dialogueBlock);
          console.log(`  Converted paragraph to dialogue: "${speakerMatch[1]}" → "${speakerMatch[2].substring(0, 50)}..."`);
          return;
        }

        // Keep as regular paragraph
        processedNodes.push(node);
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
        currentSceneNumber++;
        console.log(`  Fixed scene ${currentSceneNumber - 1}: "${sceneName}"`);
      } else {
        // Keep other nodes as-is
        processedNodes.push(node);
      }
    });

    // Insert all processed nodes into new document
    newFragment.insert(0, processedNodes);

    // Copy metadata
    const metadata = doc.getMap('metadata');
    const newMetadata = newDoc.getMap('metadata');
    metadata.forEach((value, key) => {
      newMetadata.set(key, value);
    });

    console.log(`\nRepaired document created with ${processedNodes.length} nodes.`);
    console.log(`Total scenes: ${currentSceneNumber - 1}`);

    // 5. Update database
    console.log('\nUpdating database...');
    const newUpdate = Y.encodeStateAsUpdate(newDoc);
    const newStateVector = Y.encodeStateVector(newDoc);

    await pool.query(
      'UPDATE yjs_base_states SET base_state = $1, state_vector = $2, updated_at = NOW() WHERE script_id = $3',
      [newUpdate, newStateVector, SCRIPT_ID]
    );

    console.log('✅ Database updated successfully!');
    console.log('\nThe Marquise von O script has been repaired:');
    console.log(`- All scenes are now properly numbered (1 to ${currentSceneNumber - 1})`);
    console.log('- Speaker names are now in separate dialogueBlocks');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
