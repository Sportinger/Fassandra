#!/usr/bin/env node

import { TipTapYjsBuilder } from '../src/TipTapYjsBuilder.js';
import { DatabaseService } from '../src/DatabaseService.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Parse a theater script text file into structured content
 * Supports German theater script format with:
 * - Speaker names in UPPERCASE followed by text
 * - Stage directions (text without speakers or in parentheses)
 * - Scene headers (lines starting with numbers)
 */
function parseTheaterScript(text, title) {
  const lines = text.split('\n');
  const content = [];

  // Known speakers from the file
  const knownSpeakers = new Set([
    'FRANZ', 'KARL', 'SPIEGELBERG', 'AMALIA', 'MOOR',
    'ALLE', 'ALLE/JANEK'
  ]);

  // Pattern to match speaker lines: NAME followed by text
  const speakerPattern = /^([A-ZÄÖÜ][A-ZÄÖÜ\/\s]{1,30})\s{2,}(.+)$/;

  let currentSpeaker = null;
  let currentText = [];
  let pageNumber = 1;
  let sceneNumber = null;

  function flushCurrent() {
    if (currentSpeaker && currentText.length > 0) {
      content.push({
        type: 'dialogue',
        speaker: currentSpeaker.trim(),
        content: currentText.join(' ').trim(),
        page: pageNumber
      });
      currentText = [];
    } else if (currentText.length > 0) {
      const text = currentText.join(' ').trim();
      if (text) {
        // Check if it's a stage direction (usually shorter, descriptive)
        if (text.length < 200 && !text.includes('.')) {
          content.push({
            type: 'stage_direction',
            content: text,
            page: pageNumber
          });
        } else {
          content.push({
            type: 'text',
            content: text,
            page: pageNumber
          });
        }
      }
      currentText = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines but flush current content
    if (!trimmed) {
      flushCurrent();
      currentSpeaker = null;
      continue;
    }

    // Check for scene headers (lines starting with number or containing scene markers)
    const sceneMatch = trimmed.match(/^(\d+)\s+"([^"]+)"$/);
    if (sceneMatch) {
      flushCurrent();
      currentSpeaker = null;
      sceneNumber = sceneMatch[1];
      content.push({
        type: 'scene',
        content: `${sceneMatch[1]} "${sceneMatch[2]}"`,
        page: pageNumber,
        scene_number: sceneMatch[1]
      });
      continue;
    }

    // Check for speaker line
    const speakerMatch = trimmed.match(speakerPattern);
    if (speakerMatch) {
      const potentialSpeaker = speakerMatch[1].trim();
      const dialogue = speakerMatch[2].trim();

      // Check if this looks like a valid speaker name
      if (potentialSpeaker.length <= 20 && potentialSpeaker === potentialSpeaker.toUpperCase()) {
        flushCurrent();
        currentSpeaker = potentialSpeaker;
        currentText = [dialogue];
        continue;
      }
    }

    // Check for known speaker at start of line
    for (const speaker of knownSpeakers) {
      if (trimmed.startsWith(speaker + ' ') || trimmed.startsWith(speaker + '\t')) {
        flushCurrent();
        currentSpeaker = speaker;
        currentText = [trimmed.substring(speaker.length).trim()];
        break;
      }
    }

    // If we have a current speaker, continue their dialogue
    if (currentSpeaker) {
      // Check if this line is a continuation (indented or lowercase start)
      if (line.startsWith('\t') || line.startsWith('        ') ||
          (trimmed[0] && trimmed[0] === trimmed[0].toLowerCase())) {
        currentText.push(trimmed);
        continue;
      }
    }

    // Otherwise, it's stage direction or other text
    if (!currentSpeaker || trimmed[0] !== trimmed[0].toUpperCase() || trimmed.length > 100) {
      currentText.push(trimmed);
    } else {
      // Might be a new speaker we don't recognize - treat as stage direction
      flushCurrent();
      currentSpeaker = null;
      currentText = [trimmed];
    }
  }

  // Flush final content
  flushCurrent();

  return {
    mode: 'full',
    metadata: {
      title: title,
      author: 'Friedrich Schiller',
      total_pages: pageNumber
    },
    content: content
  };
}

/**
 * Simple text import - converts text file to paragraphs
 */
function parseSimpleText(text, title) {
  const paragraphs = text.split(/\n\n+/);
  const content = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed) {
      content.push({
        type: 'text',
        content: trimmed.replace(/\n/g, ' ')
      });
    }
  }

  return {
    mode: 'full',
    metadata: {
      title: title,
      total_pages: 1
    },
    content: content
  };
}

// Main script
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
📜 Import Plain Text Script

Usage: node import-text.js <text-file> <username> [options]

Options:
  --title <title>     Script title (default: filename)
  --mode <mode>       Parse mode: 'theater' or 'simple' (default: theater)
  --database <url>    Database URL (default: DATABASE_URL env var)

Example:
  node import-text.js "Die Räuber.txt" admin --title "Die Räuber"
`);
  process.exit(0);
}

const textFile = args[0];
const username = args[1];

// Parse options
let title = path.basename(textFile, path.extname(textFile));
let mode = 'theater';
let databaseUrl = process.env.DATABASE_URL;

for (let i = 2; i < args.length; i += 2) {
  if (args[i] === '--title') title = args[i + 1];
  else if (args[i] === '--mode') mode = args[i + 1];
  else if (args[i] === '--database') databaseUrl = args[i + 1];
}

console.log(`
📚 Importing text file: ${textFile}
👤 User: ${username}
📖 Title: ${title}
🎭 Mode: ${mode}
`);

const db = new DatabaseService(databaseUrl);

try {
  // Read text file
  const textPath = path.resolve(textFile);
  const textContent = await fs.readFile(textPath, 'utf-8');

  console.log(`📄 File size: ${textContent.length} characters`);

  // Parse based on mode
  const scriptData = mode === 'theater'
    ? parseTheaterScript(textContent, title)
    : parseSimpleText(textContent, title);

  console.log(`📊 Parsed ${scriptData.content.length} content items`);

  // Get user ID
  const userId = await db.getUserId(username);
  console.log(`✓ Found user: ${userId}`);

  // Generate script ID
  const scriptId = uuidv4();

  // Create script record
  await db.createScript(scriptId, userId, scriptData.metadata);

  // Build YJS document using TipTap
  console.log('🔨 Building YJS document with TipTap...');
  const { update, stateVector } = TipTapYjsBuilder.buildFromScript(scriptData);

  // Store as initial state
  await db.storeInitialYjsState(scriptId, update, stateVector);

  console.log(`
✅ Script imported successfully!
📝 Script ID: ${scriptId}
📊 YJS update size: ${update.length} bytes
💬 Script ready to edit in TipTap!
`);

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  await db.close();
}
