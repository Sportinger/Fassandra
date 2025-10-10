#!/usr/bin/env node

import * as Y from 'yjs';
import fs from 'fs/promises';
import { DatabaseService } from './src/DatabaseService.js';

async function main() {
  // Read the base64 encoded state
  const base64Content = await fs.readFile('/tmp/marquise_base_state.txt', 'utf-8');

  // Extract just the base64 data (skip the header line)
  const lines = base64Content.trim().split('\n');
  const base64Data = lines.slice(2).join('').trim(); // Skip header and dashes

  console.log('Base64 length:', base64Data.length);

  // Decode from base64
  const buffer = Buffer.from(base64Data, 'base64');
  console.log('Buffer length:', buffer.length);

  // Create YJS document and apply the state
  const doc = new Y.Doc();
  Y.applyUpdate(doc, buffer);

  console.log('\n=== YJS Document Analysis ===\n');

  // Check all YJS types
  console.log('YJS Types in document:');
  doc.share.forEach((value, key) => {
    console.log(`  - ${key}: ${value.constructor.name}`);
  });

  // Check the default fragment (TipTap uses this)
  const defaultFragment = doc.getXmlFragment('default');
  console.log('\n--- Default Fragment ---');
  console.log('Length:', defaultFragment.length);

  // Iterate through the document structure
  let sceneCount = 0;
  let dialogueCount = 0;
  let paragraphCount = 0;

  function analyzeNode(node, depth = 0) {
    const indent = '  '.repeat(depth);

    if (node instanceof Y.XmlElement) {
      console.log(`${indent}<${node.nodeName}>`);

      if (node.nodeName === 'sceneBlock') {
        sceneCount++;
        const attrs = node.getAttributes();
        console.log(`${indent}  Scene #${sceneCount}:`, attrs);
      } else if (node.nodeName === 'dialogueBlock') {
        dialogueCount++;
      } else if (node.nodeName === 'paragraph') {
        paragraphCount++;
      }

      // Check attributes
      const attrs = node.getAttributes();
      if (Object.keys(attrs).length > 0) {
        console.log(`${indent}  Attributes:`, attrs);
      }

      // Check text content
      if (node.toString().length < 200) {
        const text = node.toString();
        if (text && text.trim()) {
          console.log(`${indent}  Text: "${text.substring(0, 100)}"`);
        }
      }

      // Recurse into children
      node.forEach((child) => analyzeNode(child, depth + 1));
    } else if (node instanceof Y.XmlText) {
      const text = node.toString();
      if (text && text.trim()) {
        console.log(`${indent}Text: "${text.substring(0, 100)}"`);
      }
    }
  }

  console.log('\n--- Document Structure (first 20 nodes) ---');
  let nodeCount = 0;
  defaultFragment.forEach((node) => {
    if (nodeCount < 20) {
      analyzeNode(node);
      nodeCount++;
    }
  });

  console.log('\n--- Summary ---');
  console.log(`Total nodes: ${defaultFragment.length}`);
  console.log(`Scene blocks: ${sceneCount}`);
  console.log(`Dialogue blocks: ${dialogueCount}`);
  console.log(`Paragraphs: ${paragraphCount}`);
}

main().catch(console.error);
