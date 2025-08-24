#!/usr/bin/env node

import { program } from 'commander';
import { TipTapYjsBuilder } from '../src/TipTapYjsBuilder.js';
import { DatabaseService } from '../src/DatabaseService.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

program
  .name('import-script-v2')
  .description('Import a script using TipTap to create proper YJS documents')
  .version('2.0.0')
  .argument('<json-file>', 'Path to the JSON file containing script data')
  .argument('<username>', 'Username or email of the user')
  .option('-d, --database <url>', 'Database connection URL', process.env.DATABASE_URL)
  .action(async (jsonFile, username, options) => {
    const db = new DatabaseService(options.database);
    
    try {
      // Read JSON file
      const jsonPath = path.resolve(jsonFile);
      const jsonContent = await fs.readFile(jsonPath, 'utf-8');
      const scriptData = JSON.parse(jsonContent);
      
      console.log(`\n📚 Importing script with TipTap: ${jsonFile}`);
      console.log(`👤 User: ${username}`);
      
      // Get user ID
      const userId = await db.getUserId(username);
      
      // Generate script ID
      const scriptId = uuidv4();
      
      // Create script record
      if (scriptData.metadata) {
        await db.createScript(scriptId, userId, scriptData.metadata);
      }
      
      // Build YJS document using TipTap
      console.log('🔨 Building YJS document with TipTap...');
      const { update, stateVector } = TipTapYjsBuilder.buildFromScript(scriptData);
      
      // Store as initial state
      await db.storeInitialYjsState(scriptId, update, stateVector);
      
      console.log('\n✅ Script imported successfully!');
      console.log(`📝 Script ID: ${scriptId}`);
      console.log(`📊 YJS update size: ${update.length} bytes`);
      console.log(`💬 Script ready to edit in TipTap!`);
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      await db.close();
    }
  });

program.parse();