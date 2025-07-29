#!/usr/bin/env node

/**
 * Quick Test Runner for Dynamic Playwright Testing
 * Usage: node quick-test-runner.js [mode]
 * Modes: live, debug, quick, performance
 */

const { spawn } = require('child_process');
const path = require('path');

const mode = process.argv[2] || 'live';

const commands = {
  live: ['npx', 'playwright', 'test', 'tests/dynamic-feature-test.spec.js', '--headed', '--project=chrome-debug'],
  debug: ['npx', 'playwright', 'test', 'tests/dynamic-feature-test.spec.js', '--debug', '--project=chrome-debug'],
  quick: ['npx', 'playwright', 'test', 'tests/dynamic-feature-test.spec.js', '--grep', 'Quick Debug', '--headed', '--project=chrome-debug'],
  performance: ['npx', 'playwright', 'test', 'tests/dynamic-feature-test.spec.js', '--grep', 'Performance', '--headed', '--project=chrome-debug'],
  ui: ['npx', 'playwright', 'test', '--ui', '--project=chrome-debug']
};

if (!commands[mode]) {
  console.log('Available modes: live, debug, quick, performance, ui');
  process.exit(1);
}

console.log(`🎭 Starting Playwright in ${mode} mode...`);
console.log(`Command: ${commands[mode].join(' ')}`);

const child = spawn(commands[mode][0], commands[mode].slice(1), {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: false
});

child.on('close', (code) => {
  console.log(`Test completed with code ${code}`);
});

child.on('error', (error) => {
  console.error('Error running test:', error);
});