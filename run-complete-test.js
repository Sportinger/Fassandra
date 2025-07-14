#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Running Pessoa Complete Test (Single Test)...\n');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getLastNSecondsFromLog(logFilePath, seconds = 15) {
  try {
    if (!fs.existsSync(logFilePath)) {
      return `Log file not found: ${logFilePath}`;
    }

    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
      return `No log entries found in ${logFilePath}`;
    }

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - (seconds * 1000));
    
    const recentLines = lines.filter(line => {
      const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
      if (timestampMatch) {
        const lineTime = new Date(timestampMatch[1]);
        return lineTime >= cutoffTime;
      }
      return false;
    });

    return recentLines.length > 0 ? recentLines.join('\n') : `No recent entries in the last ${seconds} seconds`;
  } catch (error) {
    return `Error reading log file: ${error.message}`;
  }
}

// Single test function
async function runSingleTest() {
  log('🎯 Running SINGLE Complete Test:', 'cyan');
  log('  • Login 500ms + Create 500ms + Write + Wait 1s + Back + Logout', 'blue');
  log('  • Database verification (content check)', 'blue');
  log('  • Cleanup (delete test script)', 'blue');

  const testCommand = 'npx playwright test tests/pessoa-complete-workflow-with-database-verification.spec.js --reporter=line --timeout=30000';
  
  try {
    log('\n🧪 Executing test...', 'yellow');
    const result = execSync(testCommand, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      cwd: process.cwd()
    });

    log('\n✅ TEST PASSED!', 'green');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
    log('🎉 Complete workflow with database verification successful!', 'green');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
    
    log('\n📋 TEST SUMMARY:', 'cyan');
    log('✅ Speed Test: Login, Create, Write, Wait, Back, Logout', 'green');
    log('✅ Database Verification: Content found in database', 'green');
    log('✅ Cleanup: Test script deleted (no leftover data)', 'green');
    
    return true;
  } catch (error) {
    log('\n❌ TEST FAILED!', 'red');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
    log(error.stdout || error.message, 'red');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
    
    // Show recent logs on failure
    log('\n📋 Recent logs for debugging:', 'yellow');
    
    const browserLog = getLastNSecondsFromLog('logs/browser-console.log');
    const errorLog = getLastNSecondsFromLog('logs/error.log');
    const backendLog = getLastNSecondsFromLog('backend/backend.log');
    
    log('\n🌐 Browser Console (last 15s):', 'cyan');
    log(browserLog, 'white');
    
    log('\n🔴 Error Log (last 15s):', 'cyan');
    log(errorLog, 'white');
    
    log('\n🖥️  Backend Log (last 15s):', 'cyan');
    log(backendLog, 'white');
    
    return false;
  }
}

// Main execution
async function main() {
  log('🏁 PESSOA COMPLETE TEST SUITE', 'bold');
  log('═══════════════════════════════════════════════════════════════════════════════════════════', 'blue');
  log('🎭 Theater Collaboration Platform - Complete Workflow Test', 'blue');
  log('═══════════════════════════════════════════════════════════════════════════════════════════', 'blue');
  
  const success = await runSingleTest();
  
  if (success) {
    log('\n🎉 ALL TESTS PASSED!', 'green');
    log('🧹 Database is clean (test data removed)', 'green');
    log('⚡ Lightning fast workflow verified!', 'green');
    process.exit(0);
  } else {
    log('\n💥 TEST FAILED!', 'red');
    log('🔍 Check logs above for debugging information', 'red');
    process.exit(1);
  }
}

main().catch(error => {
  log(`\n💥 Script execution failed: ${error.message}`, 'red');
  process.exit(1);
}); 