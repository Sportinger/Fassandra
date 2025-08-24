#!/usr/bin/env node

import { program } from 'commander';
import { ScriptImporter } from '../src/ScriptImporter.js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

program
  .name('import-script')
  .description('Import a script JSON file into the database as YJS document')
  .version('1.0.0')
  .argument('<json-file>', 'Path to the JSON file containing script data')
  .argument('<username>', 'Username or email of the user')
  .option('-s, --script-id <id>', 'Script ID (for chunked imports)')
  .option('-d, --database <url>', 'Database connection URL', process.env.DATABASE_URL)
  .action(async (jsonFile, username, options) => {
    const importer = new ScriptImporter(options.database);
    
    try {
      // Read JSON file
      const jsonPath = path.resolve(jsonFile);
      const jsonContent = await fs.readFile(jsonPath, 'utf-8');
      
      console.log(`\n📚 Importing script from: ${jsonFile}`);
      console.log(`👤 User: ${username}`);
      
      // Import the script
      const result = await importer.importScript(
        jsonContent,
        username,
        options.scriptId
      );
      
      if (result.success) {
        console.log('\n✅ Script imported successfully!');
        console.log(`📝 Script ID: ${result.scriptId}`);
        console.log(`📊 Items processed: ${result.itemsProcessed}`);
        
        if (result.chunkNumber) {
          console.log(`📦 Chunk: ${result.chunkNumber}/${result.totalChunks}`);
        }
        
        console.log(`💬 ${result.message}`);
      } else {
        console.error('\n❌ Import failed:', result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      
      if (error.message.includes('User not found')) {
        console.error('\n💡 Tip: Make sure the username exists in the database');
      }
      
      process.exit(1);
    } finally {
      await importer.close();
    }
  });

// Show example if no arguments
if (process.argv.length === 2) {
  console.log('Script Importer - Import scripts as YJS documents\n');
  console.log('Usage: npm run import-script <json-file> <username>\n');
  console.log('Example for full script:');
  console.log('  npm run import-script script.json abc\n');
  console.log('Example for chunked script:');
  console.log('  npm run import-script chunk1.json abc');
  console.log('  npm run import-script chunk2.json abc -s <script-id-from-chunk1>');
  console.log('  npm run import-script chunk3.json abc -s <script-id-from-chunk1>\n');
  
  console.log('Example JSON structure (full mode):');
  console.log(JSON.stringify({
    mode: "full",
    metadata: {
      title: "My Script",
      author: "Author Name",
      total_pages: 10
    },
    content: [
      {
        type: "scene",
        content: "INT. OFFICE - DAY",
        page: 1,
        scene_number: "1"
      },
      {
        type: "dialogue",
        speaker: "JOHN",
        content: "Hello world!",
        page: 1
      }
    ]
  }, null, 2));
  
  process.exit(0);
}

program.parse();