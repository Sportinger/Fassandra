# Scripts Directory

This directory contains various utility scripts for the Pessoa project.

## Available Scripts

### Development & Diagnostics

#### `doctor.js`
**Health check for your development environment**
```bash
npm run doctor
# or
node scripts/doctor.js
```

Performs comprehensive checks on:
- Node.js and npm versions
- Git configuration
- Database connectivity
- Required dependencies
- Environment variables
- Port availability
- File permissions
- Rust/Cargo environment
- Docker setup (optional)

#### `reset_database.js` - Nuclear Database Reset
**Instantly deletes ALL data from the Pessoa database without any confirmation prompts.**

```bash
npm run db:reset
# or
node scripts/reset_database.js
```

**What it deletes:**
- All users (including admin accounts)
- All scripts and their content
- All collaboration data
- All real-time updates
- All snapshots
- All edit history

**What it preserves:**
- Database schema and table structure
- Migration history

### Backend Scripts

#### `hash_password.rs`
Rust script for generating password hashes for the backend.

### Shell Scripts

#### `clean_rebuild_with_fixes.sh`
Cleans and rebuilds the entire project with necessary fixes.

#### `cursor_debug.sh`
Debug script for cursor-related functionality.

#### `deploy_hetzner.sh`
Deployment script for Hetzner cloud infrastructure.

#### `license_compliance_check.sh`
Checks the project for license compliance issues.

#### `monitor_blocks.sh` / `monitor_blocks_simple.sh`
Monitor database blocks and their changes.

#### `post_rebuild_fixes.sh`
Applies fixes after rebuilding the project.

#### `test_persistence.sh`
Tests data persistence functionality.

## Usage

Most scripts can be run directly:
```bash
./scripts/script_name.sh
```

Or through npm scripts defined in package.json:
```bash
npm run doctor
npm run db:reset
```

## Adding New Scripts

When adding new scripts:
1. Place them in this directory
2. Make shell scripts executable: `chmod +x script_name.sh`
3. Add npm script shortcuts to package.json if appropriate
4. Update this README with documentation

## Environment Variables

Scripts use environment variables from your `.env` file. See `env.example` for required variables.