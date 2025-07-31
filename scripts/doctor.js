#!/usr/bin/env node

/**
 * Doctor Command - Health check for Pessoa development environment
 * 
 * This script performs comprehensive health checks on:
 * - Node.js and npm versions
 * - Git configuration
 * - Database connectivity
 * - Required dependencies
 * - Environment variables
 * - Port availability
 * - File permissions
 * 
 * Usage: node scripts/doctor.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { Pool } = require('pg');
require('dotenv').config();

// Color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Helper functions for colored output
const success = (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`);
const error = (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`);
const warning = (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
const info = (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`);
const header = (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}\n`);

// Track overall health status
let hasErrors = false;
let hasWarnings = false;

// Check Node.js version
async function checkNodeVersion() {
  header('Node.js & npm Versions');
  
  try {
    const nodeVersion = process.version;
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    
    // Parse version numbers
    const nodeMajor = parseInt(nodeVersion.split('.')[0].substring(1));
    
    if (nodeMajor >= 18) {
      success(`Node.js version: ${nodeVersion}`);
    } else {
      error(`Node.js version ${nodeVersion} is too old. Please upgrade to v18.0.0 or higher.`);
      hasErrors = true;
    }
    
    success(`npm version: ${npmVersion}`);
  } catch (err) {
    error(`Failed to check Node.js/npm versions: ${err.message}`);
    hasErrors = true;
  }
}

// Check Git configuration
async function checkGitConfig() {
  header('Git Configuration');
  
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
    const userName = execSync('git config user.name', { encoding: 'utf8' }).trim();
    const userEmail = execSync('git config user.email', { encoding: 'utf8' }).trim();
    
    success(`Git version: ${gitVersion}`);
    
    if (userName) {
      success(`Git user.name: ${userName}`);
    } else {
      warning('Git user.name not configured');
      hasWarnings = true;
    }
    
    if (userEmail) {
      success(`Git user.email: ${userEmail}`);
    } else {
      warning('Git user.email not configured');
      hasWarnings = true;
    }
    
    // Check if we're in a git repository
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    success(`Current branch: ${branch}`);
    
    if (gitStatus) {
      warning(`Uncommitted changes detected (${gitStatus.split('\n').filter(l => l).length} files)`);
      hasWarnings = true;
    } else {
      success('Working directory clean');
    }
  } catch (err) {
    error(`Git not configured or not in a git repository: ${err.message}`);
    hasErrors = true;
  }
}

// Check database connectivity
async function checkDatabase() {
  header('Database Connectivity');
  
  // Database configuration
  let dbConfig;
  if (process.env.DATABASE_URL) {
    // For local development, replace 'db' with 'localhost' if running outside Docker
    const dbUrl = process.env.DATABASE_URL.replace('@db:', '@localhost:');
    dbConfig = { connectionString: dbUrl };
    info(`Using DATABASE_URL: ${dbUrl.replace(/:[^:@]*@/, ':****@')}`); // Hide password
  } else {
    dbConfig = {
      host: process.env.DATABASE_HOST || 'localhost',
      port: process.env.DATABASE_PORT || 5432,
      database: process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'pessoa_db',
      user: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'password',
    };
    info(`Using individual DB config: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  }
  
  const pool = new Pool(dbConfig);
  
  try {
    const client = await pool.connect();
    
    // Test basic connectivity
    const result = await client.query('SELECT 1');
    success('Database connected successfully');
    
    // Check database version
    const versionResult = await client.query('SELECT version()');
    const version = versionResult.rows[0].version;
    success(`PostgreSQL version: ${version.split(' ')[1]}`);
    
    // Check if migrations have been run
    try {
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      const tables = tablesResult.rows.map(r => r.table_name);
      const expectedTables = ['users', 'scripts', 'blocks', 'edits', 'versions', 'script_shares', 'script_layouts', 'yjs_document_updates', 'script_snapshots_meta'];
      const missingTables = expectedTables.filter(t => !tables.includes(t));
      
      if (missingTables.length === 0) {
        success(`All expected tables exist (${tables.length} tables)`);
      } else {
        error(`Missing tables: ${missingTables.join(', ')}`);
        hasErrors = true;
        info('Run backend migrations to create missing tables');
      }
      
      // Check record counts
      const counts = {};
      for (const table of tables) {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        counts[table] = parseInt(countResult.rows[0].count);
      }
      
      info(`Database record counts: ${Object.entries(counts).map(([t, c]) => `${t}(${c})`).join(', ')}`);
      
    } catch (err) {
      warning(`Could not check database schema: ${err.message}`);
      hasWarnings = true;
    }
    
    client.release();
    await pool.end();
    
  } catch (err) {
    error(`Database connection failed: ${err.message}`);
    hasErrors = true;
    
    if (err.message.includes('ECONNREFUSED')) {
      info('Make sure PostgreSQL is running and accessible');
    } else if (err.message.includes('password authentication failed')) {
      info('Check your database credentials in .env file');
    }
  }
}

// Check dependencies
async function checkDependencies() {
  header('Dependencies');
  
  // Check root package.json dependencies
  try {
    const rootPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const rootDeps = Object.keys(rootPackage.dependencies || {}).length;
    const rootDevDeps = Object.keys(rootPackage.devDependencies || {}).length;
    
    success(`Root dependencies: ${rootDeps} prod, ${rootDevDeps} dev`);
    
    // Check if node_modules exists
    if (fs.existsSync('node_modules')) {
      success('Root node_modules directory exists');
    } else {
      error('Root node_modules missing - run: npm install');
      hasErrors = true;
    }
  } catch (err) {
    error(`Could not read root package.json: ${err.message}`);
    hasErrors = true;
  }
  
  // Check frontend dependencies
  try {
    const frontendPackage = JSON.parse(fs.readFileSync('frontend/package.json', 'utf8'));
    const frontendDeps = Object.keys(frontendPackage.dependencies || {}).length;
    const frontendDevDeps = Object.keys(frontendPackage.devDependencies || {}).length;
    
    success(`Frontend dependencies: ${frontendDeps} prod, ${frontendDevDeps} dev`);
    
    if (fs.existsSync('frontend/node_modules')) {
      success('Frontend node_modules directory exists');
    } else {
      error('Frontend node_modules missing - run: cd frontend && npm install');
      hasErrors = true;
    }
  } catch (err) {
    error(`Could not read frontend package.json: ${err.message}`);
    hasErrors = true;
  }
  
  // Check for critical dependencies
  const criticalDeps = ['pg', 'dotenv', '@playwright/test'];
  for (const dep of criticalDeps) {
    if (fs.existsSync(`node_modules/${dep}`)) {
      success(`Critical dependency installed: ${dep}`);
    } else {
      error(`Critical dependency missing: ${dep}`);
      hasErrors = true;
    }
  }
}

// Check environment variables
async function checkEnvironmentVariables() {
  header('Environment Variables');
  
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'BACKEND_PORT',
    'FRONTEND_PORT',
    'FRONTEND_HTTPS_PORT',
    'GEMINI_API_KEY'
  ];
  
  const optionalVars = [
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'APP_HOSTNAME',
    'VITE_API_BASE_URL',
    'VITE_WS_BASE_URL'
  ];
  
  // Check .env file exists
  if (fs.existsSync('.env')) {
    success('.env file exists');
  } else {
    error('.env file missing - copy env.example to .env and configure');
    hasErrors = true;
    return;
  }
  
  // Check required variables
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      if (varName.includes('SECRET') || varName.includes('PASSWORD') || varName.includes('API_KEY')) {
        success(`${varName} is set (hidden)`);
      } else {
        success(`${varName} = ${process.env[varName]}`);
      }
    } else {
      error(`Required environment variable missing: ${varName}`);
      hasErrors = true;
    }
  }
  
  // Check optional variables
  for (const varName of optionalVars) {
    if (process.env[varName]) {
      if (varName.includes('PASSWORD')) {
        info(`${varName} is set (hidden)`);
      } else {
        info(`${varName} = ${process.env[varName]}`);
      }
    } else {
      warning(`Optional environment variable not set: ${varName}`);
      hasWarnings = true;
    }
  }
  
  // Check for insecure defaults
  if (process.env.JWT_SECRET === 'JDrpHPHR16C6lgljx5VEQmf+Mzei3foIFcWKC1sSFFw=') {
    warning('Using default JWT_SECRET - generate a new one for production!');
    hasWarnings = true;
  }
}

// Check port availability
async function checkPorts() {
  header('Port Availability');
  
  const ports = [
    { port: parseInt(process.env.BACKEND_PORT) || 3001, name: 'Backend' },
    { port: parseInt(process.env.FRONTEND_PORT) || 8080, name: 'Frontend HTTP' },
    { port: parseInt(process.env.FRONTEND_HTTPS_PORT) || 8443, name: 'Frontend HTTPS' },
    { port: 5432, name: 'PostgreSQL' },
    { port: parseInt(process.env.PGADMIN_PORT) || 5050, name: 'pgAdmin' }
  ];
  
  for (const { port, name } of ports) {
    await new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          success(`Port ${port} (${name}) is in use - expected for running services`);
        } else {
          error(`Port ${port} (${name}) error: ${err.message}`);
          hasErrors = true;
        }
        resolve();
      });
      
      server.once('listening', () => {
        success(`Port ${port} (${name}) is available`);
        server.close();
        resolve();
      });
      
      server.listen(port, '127.0.0.1');
    });
  }
}

// Check file permissions
async function checkFilePermissions() {
  header('File Permissions');
  
  const pathsToCheck = [
    { path: '.', name: 'Project root' },
    { path: 'frontend', name: 'Frontend directory' },
    { path: 'backend', name: 'Backend directory' },
    { path: 'scripts', name: 'Scripts directory' },
    { path: '.env', name: '.env file' },
    { path: 'logs', name: 'Logs directory' }
  ];
  
  for (const { path: checkPath, name } of pathsToCheck) {
    try {
      const stats = fs.statSync(checkPath);
      
      // Check if we can read
      fs.accessSync(checkPath, fs.constants.R_OK);
      
      // Check if we can write (for directories and .env)
      if (stats.isDirectory() || checkPath === '.env') {
        fs.accessSync(checkPath, fs.constants.W_OK);
        success(`${name}: read/write permissions OK`);
      } else {
        success(`${name}: read permission OK`);
      }
      
      // Special check for .env file permissions
      if (checkPath === '.env') {
        const mode = '0' + (stats.mode & parseInt('777', 8)).toString(8);
        if (mode === '0644' || mode === '0600') {
          success(`.env file permissions are secure (${mode})`);
        } else {
          warning(`.env file permissions are ${mode} - consider using 0600 for better security`);
          hasWarnings = true;
        }
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        if (checkPath === 'logs') {
          warning(`${name} does not exist - will be created when needed`);
          hasWarnings = true;
        } else {
          error(`${name} does not exist`);
          hasErrors = true;
        }
      } else {
        error(`${name}: ${err.message}`);
        hasErrors = true;
      }
    }
  }
}

// Check Rust/Cargo for backend
async function checkRustEnvironment() {
  header('Rust/Cargo Environment');
  
  try {
    const rustVersion = execSync('rustc --version', { encoding: 'utf8' }).trim();
    const cargoVersion = execSync('cargo --version', { encoding: 'utf8' }).trim();
    
    success(`Rust: ${rustVersion}`);
    success(`Cargo: ${cargoVersion}`);
    
    // Check if backend is built
    if (fs.existsSync('backend/target')) {
      success('Backend target directory exists');
      
      // Check for debug/release builds
      const hasDebug = fs.existsSync('backend/target/debug/backend');
      const hasRelease = fs.existsSync('backend/target/release/backend');
      
      if (hasDebug) success('Debug build available');
      if (hasRelease) success('Release build available');
      if (!hasDebug && !hasRelease) {
        warning('No backend builds found - run: cd backend && cargo build');
        hasWarnings = true;
      }
    } else {
      warning('Backend not built yet - run: cd backend && cargo build');
      hasWarnings = true;
    }
  } catch (err) {
    error('Rust/Cargo not installed or not in PATH');
    hasErrors = true;
    info('Install Rust from: https://rustup.rs/');
  }
}

// Check Docker (optional)
async function checkDocker() {
  header('Docker Environment (Optional)');
  
  try {
    const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
    const dockerComposeVersion = execSync('docker compose version', { encoding: 'utf8' }).trim();
    
    success(`Docker: ${dockerVersion}`);
    success(`Docker Compose: ${dockerComposeVersion}`);
    
    // Check if Docker daemon is running
    try {
      execSync('docker ps', { encoding: 'utf8' });
      success('Docker daemon is running');
    } catch (err) {
      warning('Docker daemon is not running');
      hasWarnings = true;
    }
  } catch (err) {
    info('Docker not installed (optional for containerized deployment)');
  }
}

// Main doctor function
async function runDoctor() {
  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════════╗
║                   🏥 PESSOA DOCTOR                        ║
║         Health Check for Development Environment          ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);

  const startTime = Date.now();
  
  // Run all checks
  await checkNodeVersion();
  await checkGitConfig();
  await checkDatabase();
  await checkDependencies();
  await checkEnvironmentVariables();
  await checkPorts();
  await checkFilePermissions();
  await checkRustEnvironment();
  await checkDocker();
  
  const duration = Date.now() - startTime;
  
  // Summary
  console.log(`\n${colors.cyan}═══ Health Check Summary ═══${colors.reset}\n`);
  
  if (!hasErrors && !hasWarnings) {
    console.log(`${colors.green}✅ All checks passed! Your development environment is healthy.${colors.reset}`);
    console.log(`\n🎭 You're ready to develop theater scripts with Pessoa!`);
  } else if (hasErrors) {
    console.log(`${colors.red}❌ Health check failed with errors.${colors.reset}`);
    console.log(`\nPlease fix the errors above before proceeding.`);
    process.exit(1);
  } else {
    console.log(`${colors.yellow}⚠️  Health check passed with warnings.${colors.reset}`);
    console.log(`\nYour environment is functional but could be improved.`);
  }
  
  console.log(`\n⏱️  Health check completed in ${duration}ms`);
}

// Run the doctor
runDoctor().catch(err => {
  console.error(`\n${colors.red}Fatal error running doctor:${colors.reset}`, err);
  process.exit(1);
});