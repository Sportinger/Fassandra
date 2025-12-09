#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

/**
 * Parse "Die Räuber" Regiebuch into structured JSON format
 */
async function parseRaeuber(inputFile, outputFile) {
  const text = await fs.readFile(inputFile, 'utf-8');
  const lines = text.split('\n');

  const content = [];
  let currentPage = 1;
  let sceneCount = 0;

  // Known speakers
  const speakers = [
    'FRANZ', 'KARL', 'SPIEGELBERG', 'AMALIA', 'MOOR',
    'ALLE', 'ALLE/JANEK', 'AMALIA/ KARL', 'MATHILDA'
  ];

  // Scene pattern: number followed by quoted title
  const scenePattern = /^(\d+)\s+["„"]([^"„"]+)["„"]/;
  const scenePattern2 = /^(\d+)\.\s+(.+)$/;

  // Speaker pattern
  const speakerPattern = /^([A-ZÄÖÜ][A-ZÄÖÜ\s\/]+?)\s{2,}(.*)$/;

  let currentSpeaker = null;
  let currentDialogue = [];
  let lineNum = 0;

  function flushDialogue() {
    if (currentSpeaker && currentDialogue.length > 0) {
      const text = currentDialogue.join('\n').trim();
      if (text) {
        content.push({
          type: 'dialogue',
          speaker: currentSpeaker,
          content: text,
          page: currentPage
        });
      }
      currentDialogue = [];
    }
  }

  for (const line of lines) {
    lineNum++;
    const trimmed = line.trim();

    // Skip empty lines - flush current dialogue
    if (!trimmed) {
      flushDialogue();
      currentSpeaker = null;
      continue;
    }

    // Check for scene headers
    let sceneMatch = trimmed.match(scenePattern);
    if (!sceneMatch) {
      sceneMatch = trimmed.match(scenePattern2);
    }

    if (sceneMatch) {
      flushDialogue();
      currentSpeaker = null;
      sceneCount++;
      content.push({
        type: 'scene',
        content: trimmed,
        page: currentPage,
        scene_number: String(sceneCount)
      });
      continue;
    }

    // Check for horizontal rule (scene separator)
    if (trimmed.startsWith('________________')) {
      flushDialogue();
      currentSpeaker = null;
      continue;
    }

    // Check for speaker line
    const speakerMatch = trimmed.match(speakerPattern);
    if (speakerMatch) {
      const potentialSpeaker = speakerMatch[1].trim();
      const dialogue = speakerMatch[2].trim();

      // Verify it's a known speaker or looks like one
      const isKnownSpeaker = speakers.some(s =>
        potentialSpeaker === s || potentialSpeaker.startsWith(s)
      );

      if (isKnownSpeaker || (potentialSpeaker.length <= 15 && potentialSpeaker === potentialSpeaker.toUpperCase())) {
        flushDialogue();
        currentSpeaker = potentialSpeaker;
        if (dialogue) {
          currentDialogue.push(dialogue);
        }
        continue;
      }
    }

    // If we have a current speaker, this is continuation
    if (currentSpeaker) {
      currentDialogue.push(trimmed);
      continue;
    }

    // Otherwise it's a stage direction
    // Skip metadata lines at the start
    if (lineNum < 75 && (trimmed.includes('=') || trimmed.startsWith('«') || trimmed === 'DIE RÄUBER.')) {
      continue;
    }

    content.push({
      type: 'stage_direction',
      content: trimmed,
      page: currentPage
    });
  }

  // Flush any remaining dialogue
  flushDialogue();

  const scriptData = {
    mode: 'full',
    metadata: {
      title: 'Die Räuber - Regiebuch',
      author: 'Friedrich Schiller (Fassung: 01.12.25)',
      total_pages: currentPage
    },
    content: content
  };

  await fs.writeFile(outputFile, JSON.stringify(scriptData, null, 2));
  console.log(`Parsed ${content.length} items to ${outputFile}`);
  console.log(`  - Scenes: ${content.filter(c => c.type === 'scene').length}`);
  console.log(`  - Dialogues: ${content.filter(c => c.type === 'dialogue').length}`);
  console.log(`  - Stage directions: ${content.filter(c => c.type === 'stage_direction').length}`);

  return scriptData;
}

// Run
const inputFile = process.argv[2] || '/app/script.txt';
const outputFile = process.argv[3] || '/tmp/raeuber.json';

parseRaeuber(inputFile, outputFile).catch(console.error);
