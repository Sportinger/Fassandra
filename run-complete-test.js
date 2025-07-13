#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting COMPLETE Pessoa Test Suite...\n');

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
    const lines = logContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return 'No log entries found';
    }

    const cutoffTime = new Date(Date.now() - (seconds * 1000));
    const recentLines = [];

    // Try to parse timestamps from different log formats
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Try different timestamp formats
      let lineTime = null;
      
      // ISO format: 2024-01-15T10:30:00.123Z
      const isoMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/);
      if (isoMatch) {
        lineTime = new Date(isoMatch[1]);
      }
      
      // Standard log format: 2024-01-15 10:30:00
      if (!lineTime) {
        const standardMatch = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
        if (standardMatch) {
          lineTime = new Date(standardMatch[1]);
        }
      }

      // If we can't parse timestamp, include recent lines anyway (last 100)
      if (!lineTime && recentLines.length < 100) {
        recentLines.unshift(line);
      } else if (lineTime && lineTime >= cutoffTime) {
        recentLines.unshift(line);
      } else if (lineTime && lineTime < cutoffTime) {
        break; // Stop looking at older logs
      }
    }

    return recentLines.length > 0 ? recentLines.join('\n') : 'No recent log entries found';
  } catch (error) {
    return `Error reading log file: ${error.message}`;
  }
}

function displayLogs() {
  log('\n' + '='.repeat(60), 'cyan');
  log('📋 COMPREHENSIVE LOG ANALYSIS (Last 15 seconds)', 'bold');
  log('='.repeat(60), 'cyan');

  // 1. Browser Console Logs (via MCP Playwright tools)
  log('\n🌐 BROWSER CONSOLE LOGS:', 'magenta');
  log('-'.repeat(40), 'cyan');
  try {
    // First, check for our new browser console log files
    const browserLogFiles = [
      'logs/browser-console.txt',
      'logs/browser-console.log'
    ];
    
    let foundBrowserLogs = false;
    
    browserLogFiles.forEach(logFile => {
      if (fs.existsSync(logFile)) {
        foundBrowserLogs = true;
        log(`📱 ${logFile}:`, 'yellow');
        
        if (logFile.endsWith('.txt')) {
          // Read the text file directly
          const content = fs.readFileSync(logFile, 'utf8');
          const lines = content.split('\n');
          
          // Show recent console messages (look for the "RECENT CONSOLE MESSAGES" section)
          let inRecentSection = false;
          let showedLines = 0;
          const maxLines = 15;
          
          lines.forEach(line => {
            if (line.includes('=== RECENT CONSOLE MESSAGES ===')) {
              inRecentSection = true;
              return;
            }
            if (line.includes('=== ERRORS ===')) {
              inRecentSection = false;
              log(`   🔴 ERRORS SECTION:`, 'red');
              return;
            }
            
            if (inRecentSection && line.trim() && showedLines < maxLines) {
              const color = line.includes('ERROR') || line.includes('🔴') ? 'red' :
                           line.includes('WARN') || line.includes('🟡') ? 'yellow' :
                           line.includes('INFO') || line.includes('LOG') ? 'green' : 'reset';
              log(`   ${line}`, color);
              showedLines++;
            } else if (!inRecentSection && line.trim() && (line.includes('ERROR:') || line.includes('PAGEERROR:') || line.includes('REQUESTFAILED:'))) {
              log(`   ${line}`, 'red');
            }
          });
          
        } else if (logFile.endsWith('.log')) {
          // Parse JSON format for structured data
          try {
            const jsonContent = fs.readFileSync(logFile, 'utf8');
            const logData = JSON.parse(jsonContent);
            
            log(`   📊 Summary:`, 'blue');
            log(`     Total logs: ${logData.totalLogs}`, 'reset');
            log(`     Total errors: ${logData.totalErrors}`, logData.totalErrors > 0 ? 'red' : 'green');
            log(`     Log types: ${logData.summary.logTypes.join(', ')}`, 'blue');
            
            if (logData.totalErrors > 0) {
              log(`     Error types: ${logData.summary.errorTypes.join(', ')}`, 'red');
            }
            
            // Show recent logs
            log(`   🎯 Recent Messages (last ${logData.logs.length}):`, 'cyan');
            logData.logs.slice(-10).forEach(logEntry => {
              const color = logEntry.type === 'error' ? 'red' :
                           logEntry.type === 'warn' ? 'yellow' :
                           logEntry.type === 'info' || logEntry.type === 'log' ? 'green' : 'reset';
              const time = new Date(logEntry.timestamp).toLocaleTimeString();
              log(`     [${time}] ${logEntry.type.toUpperCase()}: ${logEntry.text}`, color);
            });
            
            // Show errors separately
            if (logData.errors.length > 0) {
              log(`   🔴 Errors:`, 'red');
              logData.errors.forEach(error => {
                const time = new Date(error.timestamp).toLocaleTimeString();
                log(`     [${time}] ${error.type.toUpperCase()}: ${error.text}`, 'red');
              });
            }
            
          } catch (jsonError) {
            log(`   Error parsing JSON log: ${jsonError.message}`, 'red');
          }
        }
      }
    });
    
    if (!foundBrowserLogs) {
      log('Checking for test artifacts and Playwright data...', 'blue');
      
      // Check for recent browser console logs in test artifacts
      const testResultsPath = 'test-results';
      if (fs.existsSync(testResultsPath)) {
        const recentDirs = fs.readdirSync(testResultsPath)
          .map(dir => ({
            name: dir,
            path: path.join(testResultsPath, dir),
            mtime: fs.existsSync(path.join(testResultsPath, dir)) ? 
              fs.statSync(path.join(testResultsPath, dir)).mtime : new Date(0)
          }))
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 3); // Last 3 test runs
        
        recentDirs.forEach(dir => {
          try {
            const files = fs.readdirSync(dir.path);
            log(`   📂 ${dir.name} (${dir.mtime.toLocaleTimeString()}):`, 'yellow');
            
            // Look for console logs, video files, and screenshots
            const logFiles = files.filter(f => 
              f.includes('console') || f.includes('trace') || f.includes('video') || f.includes('.png')
            );
            
            if (logFiles.length > 0) {
              logFiles.forEach(file => {
                log(`     📄 ${file}`, 'reset');
              });
            } else {
              log('     No console artifacts found', 'yellow');
            }
          } catch (e) {
            log(`     Error reading ${dir.name}: ${e.message}`, 'red');
          }
        });
      } else {
        log('   No test-results directory - run test first', 'yellow');
      }
      
      // Try to get live browser console via Playwright report
      const reportPath = 'playwright-report/index.html';
      if (fs.existsSync(reportPath)) {
        log('   📊 Live browser data: ./playwright-report/index.html', 'blue');
      }
      
      if (!foundBrowserLogs) {
        log('   💡 Browser console logs will appear here after running tests', 'yellow');
        log('   💡 Logs are captured during test execution and saved to logs/', 'blue');
      }
    }
    
  } catch (error) {
    log(`   Error capturing browser logs: ${error.message}`, 'red');
  }

  // 2. Backend Logs (Real-time Docker logs)
  log('\n🔧 BACKEND LOGS (Real-time Docker):', 'magenta');
  log('-'.repeat(40), 'cyan');
  
  try {
    // Get live backend logs from Docker container
    log('📦 Docker Backend Logs (last 15 seconds):', 'yellow');
    try {
      const dockerLogs = execSync(
        'docker logs dev_pessoa_backend --since=15s --tail=20 2>&1', 
        { encoding: 'utf8', timeout: 1000 }
      );
      
      if (dockerLogs && dockerLogs.trim()) {
        const lines = dockerLogs.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          const color = line.includes('ERROR') || line.includes('❌') || line.includes('error') ? 'red' :
                       line.includes('WARN') || line.includes('⚠️') || line.includes('warn') ? 'yellow' :
                       line.includes('INFO') || line.includes('✅') || line.includes('info') ? 'green' : 'reset';
          log(`   ${line}`, color);
        });
      } else {
        log('   No recent Docker backend logs', 'yellow');
      }
    } catch (dockerError) {
      log(`   Docker backend error: ${dockerError.message}`, 'red');
      
      // Fallback to log files
      log('📁 Fallback to log files:', 'yellow');
      const backendLogPaths = [
        'backend/backend.log',
        'logs/combined.log', 
        'logs/error.log'
      ];
      
      backendLogPaths.forEach(logPath => {
        if (fs.existsSync(logPath)) {
          log(`   📄 ${logPath}:`, 'yellow');
          const recentLogs = getLastNSecondsFromLog(logPath, 15);
          const lines = recentLogs.split('\n').slice(-5); // Last 5 lines max
          lines.forEach(line => {
            if (line.trim()) {
              const color = line.includes('ERROR') || line.includes('❌') ? 'red' :
                           line.includes('WARN') || line.includes('⚠️') ? 'yellow' :
                           line.includes('INFO') || line.includes('✅') ? 'green' : 'reset';
              log(`     ${line}`, color);
            }
          });
        }
      });
    }
  } catch (error) {
    log(`   Error getting backend logs: ${error.message}`, 'red');
  }

  // 3. Frontend Logs (Real-time Docker logs)
  log('\n🎨 FRONTEND LOGS (Real-time Docker):', 'magenta');
  log('-'.repeat(40), 'cyan');
  
  try {
    // Get live frontend logs from Docker container  
    log('📦 Docker Frontend Logs (last 15 seconds):', 'yellow');
    try {
             const frontendDockerLogs = execSync(
         'docker logs dev_pessoa_frontend --since=15s --tail=20 2>&1',
         { encoding: 'utf8', timeout: 1000 }
       );
      
      if (frontendDockerLogs && frontendDockerLogs.trim()) {
        const lines = frontendDockerLogs.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          const color = line.includes('error') || line.includes('Error') || line.includes('ERROR') ? 'red' :
                       line.includes('warn') || line.includes('Warning') || line.includes('WARN') ? 'yellow' :
                       line.includes('info') || line.includes('ready') || line.includes('Local:') ? 'green' : 'reset';
          log(`   ${line}`, color);
        });
      } else {
        log('   No recent Docker frontend logs', 'yellow');
      }
    } catch (frontendDockerError) {
      log(`   Docker frontend error: ${frontendDockerError.message}`, 'red');
      log('   Frontend logs typically captured in browser console', 'blue');
    }
    
  } catch (error) {
    log(`   Error getting frontend logs: ${error.message}`, 'red');
  }

  // 4. System Status & Docker Status
  log('\n💻 SYSTEM STATUS:', 'magenta');
  log('-'.repeat(40), 'cyan');
  try {
    // Get basic system info
    const memUsage = process.memoryUsage();
    log(`   Memory: RSS ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`, 'blue');
    log(`   Node.js: ${process.version}`, 'blue');
    log(`   Platform: ${process.platform} ${process.arch}`, 'blue');
    
    // Enhanced Docker container status
    try {
             const dockerPs = execSync('docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"', { encoding: 'utf8', timeout: 1000 });
      log('   Docker containers:', 'blue');
      dockerPs.split('\n').forEach((line, index) => {
        if (line.trim()) {
          if (index === 0) {
            log(`     ${line}`, 'cyan'); // Header
          } else {
            const color = line.includes('Up') ? 'green' : 
                         line.includes('Restart') ? 'yellow' : 'red';
            log(`     ${line}`, color);
          }
        }
      });
      
      // Quick health check for key containers
      log('   Health check:', 'blue');
      const containers = ['dev_pessoa_db', 'dev_pessoa_backend', 'dev_pessoa_frontend'];
      containers.forEach(container => {
        try {
          const status = execSync(`docker inspect ${container} --format='{{.State.Status}}'`, { encoding: 'utf8' });
          const health = status.trim();
          const color = health === 'running' ? 'green' : 'red';
          log(`     ${container}: ${health}`, color);
        } catch (e) {
          log(`     ${container}: not found`, 'red');
        }
      });
      
    } catch (e) {
      log('   Docker: Not available or not running', 'yellow');
    }
  } catch (error) {
    log(`   Error getting system info: ${error.message}`, 'red');
  }

  log('\n' + '='.repeat(60), 'cyan');
}

function runTest(testFile, description) {
  log(`\n${colors.bold}=== ${description} ===${colors.reset}`, 'blue');
  
  try {
    const startTime = Date.now();
    
    // Run the test with enhanced logging
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
  
  // Display comprehensive logs before results
  displayLogs();
  
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
  log('  ✅ Comprehensive logs: Browser + Frontend + Backend');
  process.exit(0);
}

if (args.includes('--workflow')) {
  log('🎯 Running ONLY workflow + database verification...', 'yellow');
  const result = runTest(
    'tests/pessoa-complete-workflow-with-database-verification.spec.js --grep "Complete workflow \\+ Database verification in ONE test"',
    'Complete Workflow + Database Verification'
  );
  // Still display logs for workflow-only run
  displayLogs();
  process.exit(result.success ? 0 : 1);
}

if (args.includes('--performance')) {
  log('⚡ Running ONLY performance test...', 'yellow');
  const result = runTest(
    'tests/pessoa-complete-workflow-with-database-verification.spec.js --grep "Quick performance test"',
    'Performance Validation'
  );
  // Still display logs for performance-only run
  displayLogs();
  process.exit(result.success ? 0 : 1);
}

// Run main function
main().catch(error => {
  log(`❌ Test runner failed: ${error.message}`, 'red');
  process.exit(1);
}); 