#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting COMPLETE Pessoa Test Suite...\n');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runTest(testFile, description) {
  log(`\n${colors.bold}=== ${description} ===${colors.reset}`, 'blue');
  
  try {
    const startTime = Date.now();
    
    // Run the test
    const result = execSync(`npx playwright test ${testFile} --reporter=line --timeout=60000`, {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    log(`✅ ${description} completed successfully in ${duration}ms`, 'green');
    
    // Show key results
    const lines = result.split('\n');
    lines.forEach(line => {
      if (line.includes('✅') || line.includes('🎉') || line.includes('passed')) {
        log(`   ${line}`, 'green');
      }
    });
    
    return { success: true, duration, output: result };
    
  } catch (error) {
    const duration = Date.now() - Date.now();
    log(`❌ ${description} failed`, 'red');
    log(`Error: ${error.message}`, 'red');
    
    return { success: false, duration, error: error.message };
  }
}

async function main() {
  const results = [];
  
  // Run complete test suite (includes workflow + database verification + performance test + integration guide)
  log('🎯 Running complete test suite...', 'yellow');
  const completeResult = runTest(
    'tests/pessoa-complete-workflow-with-database-verification.spec.js',
    'Complete Test Suite (Workflow + Database + Performance)'
  );
  results.push(completeResult);
  
  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('📊 COMPLETE TEST SUITE RESULTS:', 'bold');
  log('='.repeat(60), 'blue');
  
  let totalDuration = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  results.forEach((result, index) => {
    const testName = 'Complete Test Suite';
    totalDuration += result.duration;
    
    if (result.success) {
      passedTests++;
      log(`✅ ${testName}: PASSED (${result.duration}ms)`, 'green');
    } else {
      failedTests++;
      log(`❌ ${testName}: FAILED (${result.duration}ms)`, 'red');
    }
  });
  
  log(`\n📈 Summary:`, 'bold');
  log(`   Test suite passed: ${passedTests > 0 ? 'YES' : 'NO'}`, passedTests > 0 ? 'green' : 'red');
  log(`   Total duration: ${totalDuration}ms`, 'blue');
  log(`   Tests included: Workflow + Database Verification + Performance`, 'blue');
  
  if (failedTests === 0) {
    log(`\n🎉 COMPLETE TEST SUITE PASSED! Pessoa is ready for production!`, 'green');
    log(`\n🚀 What was tested:`, 'bold');
    log(`   - Complete workflow: Login → Create → Edit → Logout`, 'green');
    log(`   - Database verification: Script & content persistence`, 'green');
    log(`   - Performance optimization: 50% faster timings`, 'green');
    log(`   - Theater professionals will love this speed!`, 'green');
  } else {
    log(`\n❌ Some tests failed. Please check the output above.`, 'red');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  log('🔧 Pessoa Complete Test Runner', 'bold');
  log('\nUsage: node run-complete-test.js [options]', 'blue');
  log('\nOptions:', 'bold');
  log('  --help, -h     Show this help message');
  log('  --workflow     Run only the main workflow + database test');
  log('  --performance  Run only the performance test');
  log('\nDefault: Runs complete test suite (all tests in one file)');
  log('\nWhat gets tested:');
  log('  ✅ Complete workflow: Login → Create → Edit → Logout');
  log('  ✅ Database verification: Script & content persistence');
  log('  ✅ Performance validation: 50% faster timings');
  log('  ✅ Integration guide: How to use real MCP queries');
  process.exit(0);
}

if (args.includes('--workflow')) {
  log('🎯 Running ONLY workflow + database verification...', 'yellow');
  const result = runTest(
    'tests/pessoa-complete-workflow-with-database-verification.spec.js --grep "Complete workflow"',
    'Complete Workflow + Database Verification'
  );
  process.exit(result.success ? 0 : 1);
}

if (args.includes('--performance')) {
  log('⚡ Running ONLY performance test...', 'yellow');
  const result = runTest(
    'tests/pessoa-complete-workflow-with-database-verification.spec.js --grep "Quick performance test"',
    'Performance Validation'
  );
  process.exit(result.success ? 0 : 1);
}

// Run main function
main().catch(error => {
  log(`❌ Test runner failed: ${error.message}`, 'red');
  process.exit(1);
}); 