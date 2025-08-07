#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to skip
const SKIP_FILES = [
  'LoggingService.ts',
  'debug.ts',
  '.test.',
  '.spec.'
];

// Pattern to match console statements
const CONSOLE_PATTERN = /console\.(log|error|warn|debug|info)\(/g;

function shouldSkipFile(filePath) {
  const basename = path.basename(filePath);
  return SKIP_FILES.some(pattern => basename.includes(pattern));
}

function checkFile(filePath) {
  if (shouldSkipFile(filePath)) {
    return { hasConsole: false };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    if (CONSOLE_PATTERN.test(line)) {
      violations.push({
        line: index + 1,
        content: line.trim()
      });
    }
  });

  return {
    hasConsole: violations.length > 0,
    violations
  };
}

function main() {
  const args = process.argv.slice(2);
  let files = [];

  if (args.length > 0) {
    // Check specific files passed as arguments
    files = args;
  } else {
    // Check all TypeScript files in src
    const srcDir = path.join(__dirname, '../src');
    files = glob.sync(path.join(srcDir, '**/*.{ts,tsx}'));
  }

  let hasErrors = false;
  const results = [];

  files.forEach(file => {
    const result = checkFile(file);
    if (result.hasConsole) {
      hasErrors = true;
      results.push({
        file: path.relative(process.cwd(), file),
        violations: result.violations
      });
    }
  });

  if (hasErrors) {
    console.error('\n❌ Console statements found in the following files:\n');
    results.forEach(({ file, violations }) => {
      console.error(`  ${file}:`);
      violations.forEach(({ line, content }) => {
        console.error(`    Line ${line}: ${content}`);
      });
    });
    console.error('\n💡 Use the LoggingService instead of console statements.');
    console.error('   Example: logger.debug(\'ComponentName\', \'message\', data);\n');
    process.exit(1);
  } else {
    console.log('✅ No console statements found!');
    process.exit(0);
  }
}

// Handle both CommonJS and ES module environments
if (require.main === module) {
  main();
}

module.exports = { checkFile, shouldSkipFile };