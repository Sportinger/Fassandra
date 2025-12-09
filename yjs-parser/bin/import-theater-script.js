#!/usr/bin/env node

import { TheaterScriptBuilder } from '../src/TheaterScriptBuilder.js';
import { DatabaseService } from '../src/DatabaseService.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Parse "Die Räuber" Regiebuch into structured content with proper types
 */
function parseTheaterScript(text, title) {
  // Normalize line endings (remove \r)
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n');
  const content = [];
  let sceneCount = 0;

  // Scene pattern: number followed by title (quoted or not)
  // Quote characters: " U+0022, " U+201C, " U+201D, „ U+201E, « U+00AB, » U+00BB
  const quoteChars = '"\u201C\u201D\u201E\u00AB\u00BB';
  const quoteRegex = `[${quoteChars}]`;
  const notQuoteRegex = `[^${quoteChars}]`;

  const scenePatterns = [
    new RegExp(`^(\\d+)\\s+${quoteRegex}(${notQuoteRegex}+)${quoteRegex}`),     // 1 "scene name"
    /^(\d+)\.\s+(.+)$/,                                                          // 1. scene name
    new RegExp(`^(\\d+)\\s{2,}${quoteRegex}(${notQuoteRegex}+)${quoteRegex}`),  // 1    "scene name"
    /^(\d+)\s{2,}([A-Z].+)$/,                                                    // 6    In den böhmischen
  ];

  // Speaker pattern: UPPERCASE NAME followed by spaces and text
  const speakerPattern = /^([A-ZÄÖÜ][A-ZÄÖÜ\s\/]+?)\s{2,}(.*)$/;

  // Known speakers for validation
  const knownSpeakers = new Set([
    'FRANZ', 'KARL', 'SPIEGELBERG', 'AMALIA', 'MOOR',
    'ALLE', 'ALLE/JANEK', 'AMALIA/ KARL', 'MATHILDA', 'PB'
  ]);

  let currentSpeaker = null;
  let currentDialogue = [];
  let lineNum = 0;
  let inCastList = true; // Skip cast list at beginning

  function flushDialogue() {
    if (currentSpeaker && currentDialogue.length > 0) {
      const text = currentDialogue.join(' ').replace(/\s+/g, ' ').trim();
      if (text) {
        content.push({
          type: 'dialogue',
          speaker: currentSpeaker,
          content: text,
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

    // Skip cast list and metadata (before first scene)
    if (inCastList) {
      // Check if this is the first scene marker
      let isScene = false;
      for (const pattern of scenePatterns) {
        if (pattern.test(trimmed)) {
          isScene = true;
          break;
        }
      }
      if (isScene) {
        inCastList = false;
      } else {
        continue; // Skip cast list lines
      }
    }

    // Check for scene separators
    if (trimmed.startsWith('________________')) {
      flushDialogue();
      currentSpeaker = null;
      continue;
    }

    // Check for scene headers
    let sceneMatch = null;
    for (const pattern of scenePatterns) {
      sceneMatch = trimmed.match(pattern);
      if (sceneMatch) break;
    }

    if (sceneMatch) {
      flushDialogue();
      currentSpeaker = null;
      sceneCount++;
      content.push({
        type: 'scene',
        scene_number: String(sceneCount),
        scene_name: sceneMatch[2].trim(),
        content: sceneMatch[2].trim(),
      });
      continue;
    }

    // Check for speaker line
    const speakerMatch = trimmed.match(speakerPattern);
    if (speakerMatch) {
      const potentialSpeaker = speakerMatch[1].trim();
      const dialogue = speakerMatch[2].trim();

      // Verify it's a valid speaker
      const isKnownSpeaker = knownSpeakers.has(potentialSpeaker) ||
        [...knownSpeakers].some(s => potentialSpeaker.startsWith(s));

      const looksLikeSpeaker = potentialSpeaker.length <= 20 &&
        potentialSpeaker === potentialSpeaker.toUpperCase() &&
        !potentialSpeaker.includes('.');

      if (isKnownSpeaker || looksLikeSpeaker) {
        flushDialogue();
        currentSpeaker = potentialSpeaker;
        if (dialogue) {
          currentDialogue.push(dialogue);
        }
        continue;
      }
    }

    // If we have a current speaker, continuation lines are dialogue
    if (currentSpeaker) {
      currentDialogue.push(trimmed);
      continue;
    }

    // Otherwise it's a stage direction
    content.push({
      type: 'stage_direction',
      content: trimmed,
    });
  }

  // Flush any remaining dialogue
  flushDialogue();

  return {
    metadata: {
      title: title,
      author: 'Friedrich Schiller (Fassung: 04.12.)',
      total_pages: 1
    },
    content: content
  };
}

// Main script
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
📜 Import Theater Script

Usage: node import-theater-script.js <text-file> <username> [--title <title>]

This creates proper dialogueBlock, sceneBlock, and paragraph nodes.
`);
  process.exit(0);
}

const textFile = args[0];
const username = args[1];

// Parse options
let title = path.basename(textFile, path.extname(textFile));
for (let i = 2; i < args.length; i += 2) {
  if (args[i] === '--title') title = args[i + 1];
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

console.log(`
📚 Importing theater script: ${textFile}
👤 User: ${username}
📖 Title: ${title}
`);

const db = new DatabaseService(databaseUrl);
const builder = new TheaterScriptBuilder();

try {
  // Read and parse text file
  const textPath = path.resolve(textFile);
  const textContent = await fs.readFile(textPath, 'utf-8');

  console.log(`📄 File size: ${textContent.length} characters`);

  const scriptData = parseTheaterScript(textContent, title);

  const scenes = scriptData.content.filter(c => c.type === 'scene').length;
  const dialogues = scriptData.content.filter(c => c.type === 'dialogue').length;
  const directions = scriptData.content.filter(c => c.type === 'stage_direction').length;

  console.log(`📊 Parsed content:`);
  console.log(`   - Scenes: ${scenes}`);
  console.log(`   - Dialogues: ${dialogues}`);
  console.log(`   - Stage directions: ${directions}`);

  // Get user ID
  const userId = await db.getUserId(username);
  console.log(`✓ Found user: ${userId}`);

  // Generate script ID
  const scriptId = uuidv4();

  // Create script record
  await db.createScript(scriptId, userId, scriptData.metadata);

  // Build YJS document
  console.log('🔨 Building YJS document with proper TipTap nodes...');
  const { update, stateVector } = builder.buildScriptDocument(scriptData);

  // Store as initial state
  await db.storeInitialYjsState(scriptId, update, stateVector);

  console.log(`
✅ Script imported successfully!
📝 Script ID: ${scriptId}
📊 YJS update size: ${update.length} bytes
💬 Script ready with proper dialogue blocks!
`);

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  await db.close();
}
