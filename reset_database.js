#!/usr/bin/env node

/**
 * Database Reset Script
 * Deletes ALL data from the Pessoa database without confirmation
 * USE WITH EXTREME CAUTION - This cannot be undone!
 * 
 * Usage: node scripts/reset_database.js
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database configuration - supports both individual vars and DATABASE_URL
// For local development, replace 'db' with 'localhost' if running outside Docker
let dbConfig;
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL.replace('@db:', '@localhost:');
  dbConfig = { connectionString: dbUrl };
} else {
  dbConfig = {
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    database: process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'pessoa_db',
    user: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'password',
  };
}

const pool = new Pool(dbConfig);

async function resetDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🚨 DELETING ALL DATABASE DATA...');
    console.log('⚠️  This operation cannot be undone!');
    
    const startTime = Date.now();

    // Delete in order to respect foreign key constraints
    const deletionOrder = [
      'edits',                    // References blocks and users
      'script_shares',           // References scripts and users  
      'script_layouts',          // References scripts and users
      'versions',                // References scripts
      'blocks',                  // References scripts
      'script_snapshots_meta',   // References scripts and yjs_document_updates
      'yjs_document_updates',    // References scripts and users
      'scripts',                 // References users
      'users'                    // No dependencies
    ];

    let totalDeleted = 0;

    for (const table of deletionOrder) {
      const result = await client.query(`DELETE FROM ${table}`);
      const deletedCount = result.rowCount;
      totalDeleted += deletedCount;
      
      if (deletedCount > 0) {
        console.log(`✅ Deleted ${deletedCount} rows from ${table}`);
      } else {
        console.log(`📭 Table ${table} was already empty`);
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('');
    console.log('🎯 DATABASE RESET COMPLETE!');
    console.log(`⚡ Total rows deleted: ${totalDeleted}`);
    console.log(`⏱️  Operation completed in ${duration}ms`);
    console.log('');
    console.log('✅ Database is now clean and ready for fresh data');
    console.log('🎭 Theater professionals can start creating new scripts!');

  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Execute the reset
resetDatabase(); 