#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to skip
const SKIP_FILES = [
  'LoggingService.ts',
  'LoggingService.js',
  '*.test.ts',
  '*.test.tsx',
  '*.spec.ts',
  '*.spec.tsx'
];

// Map console methods to logger methods
const METHOD_MAP = {
  'console.log': 'logger.debug',
  'console.debug': 'logger.debug',
  'console.info': 'logger.info',
  'console.warn': 'logger.warn',
  'console.error': 'logger.error'
};

function shouldSkipFile(filePath) {
  const basename = path.basename(filePath);
  return SKIP_FILES.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(basename);
    }
    return basename === pattern;
  });
}

function extractComponentName(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  return basename.replace(/\.tsx?$/, '');
}

function processFile(filePath) {
  if (shouldSkipFile(filePath)) {
    console.log(`Skipping: ${filePath}`);
    return { skipped: true };
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const componentName = extractComponentName(filePath);
  let hasChanges = false;
  let needsImport = false;
  let replacementCount = 0;

  // Replace console statements
  Object.entries(METHOD_MAP).forEach(([consoleMethod, loggerMethod]) => {
    const regex = new RegExp(`${consoleMethod.replace('.', '\\.')}\\s*\\(`, 'g');
    const matches = content.match(regex);
    
    if (matches) {
      replacementCount += matches.length;
      hasChanges = true;
      needsImport = true;

      // Simple replacement for basic cases
      content = content.replace(regex, (match) => {
        const methodName = loggerMethod.split('.')[1];
        return `logger.${methodName}('${componentName}', `;
      });
    }
  });

  // Add import if needed and not already present
  if (needsImport && !content.includes("import logger from") && !content.includes("import { logger }")) {
    // Find the right place to add the import
    const importRegex = /^import\s+.*$/gm;
    const imports = content.match(importRegex);
    
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertPosition = lastImportIndex + lastImport.length;
      
      // Calculate relative path to LoggingService
      const relativePath = path.relative(
        path.dirname(filePath),
        path.join(__dirname, '../src/services/LoggingService')
      ).replace(/\\/g, '/');
      
      const importStatement = `\nimport logger from '${relativePath.startsWith('.') ? relativePath : './' + relativePath}';`;
      content = content.slice(0, insertPosition) + importStatement + content.slice(insertPosition);
    }
  }

  if (hasChanges) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Processed: ${filePath} (${replacementCount} replacements)`);
    return { processed: true, replacements: replacementCount };
  }

  return { unchanged: true };
}

function main() {
  const srcDir = path.join(__dirname, '../src');
  const pattern = path.join(srcDir, '**/*.{ts,tsx}');
  
  const files = glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });

  console.log(`Found ${files.length} TypeScript files to process\n`);

  let stats = {
    processed: 0,
    skipped: 0,
    unchanged: 0,
    totalReplacements: 0
  };

  files.forEach(file => {
    const result = processFile(file);
    if (result.skipped) stats.skipped++;
    else if (result.processed) {
      stats.processed++;
      stats.totalReplacements += result.replacements;
    }
    else if (result.unchanged) stats.unchanged++;
  });

  console.log('\n=== Summary ===');
  console.log(`Files processed: ${stats.processed}`);
  console.log(`Files skipped: ${stats.skipped}`);
  console.log(`Files unchanged: ${stats.unchanged}`);
  console.log(`Total replacements: ${stats.totalReplacements}`);
}

main();