# Doctor Command

This command performs a comprehensive health check on your Pessoa project setup and development environment.

## What it checks:
- **Node.js & npm versions** - Ensures you have Node.js v18+ installed
- **Git configuration** - Verifies Git is configured with user name/email
- **Database connectivity** - Tests PostgreSQL connection and schema
- **Required dependencies** - Checks both root and frontend node_modules
- **Environment variables** - Validates required and optional .env settings
- **Port availability** - Checks if required ports are available or in use
- **File permissions** - Ensures proper read/write access to project files
- **Rust/Cargo environment** - Verifies backend build tools are installed
- **Docker setup** (optional) - Checks Docker installation and daemon status

## How to use:
```bash
# Via npm script (recommended)
npm run doctor

# Direct execution
node scripts/doctor.js

# Or simply type /doctor in Claude Code
/doctor
```

## Example output:
```
╔═══════════════════════════════════════════════════════════╗
║                   🏥 PESSOA DOCTOR                        ║
║         Health Check for Development Environment          ║
╚═══════════════════════════════════════════════════════════╝

═══ Node.js & npm Versions ═══
✓ Node.js version: v20.19.4
✓ npm version: 10.8.2

═══ Git Configuration ═══
✓ Git version: git version 2.43.0
✓ Git user.name: Your Name
✓ Git user.email: your.email@example.com
✓ Current branch: main
✓ Working directory clean

═══ Database Connectivity ═══
✓ Database connected successfully
✓ PostgreSQL version: 15.13
✓ All expected tables exist (10 tables)
ℹ Database record counts: users(34), scripts(29), blocks(59)...

═══ Dependencies ═══
✓ Root dependencies: 14 prod, 7 dev
✓ Root node_modules directory exists
✓ Frontend dependencies: 18 prod, 20 dev
✓ Frontend node_modules directory exists
✓ Critical dependency installed: pg
✓ Critical dependency installed: dotenv
✓ Critical dependency installed: @playwright/test

═══ Environment Variables ═══
✓ .env file exists
✓ DATABASE_URL = postgres://pessoa_user:****@db:5432/pessoa_db
✓ JWT_SECRET is set (hidden)
✓ BACKEND_PORT = 3001
✓ FRONTEND_PORT = 8080
✓ FRONTEND_HTTPS_PORT = 8443
✓ GEMINI_API_KEY is set (hidden)

═══ Port Availability ═══
✓ Port 3001 (Backend) is in use - expected for running services
✓ Port 8080 (Frontend HTTP) is in use - expected for running services
✓ Port 8443 (Frontend HTTPS) is in use - expected for running services
✓ Port 5432 (PostgreSQL) is in use - expected for running services
✓ Port 5050 (pgAdmin) is available

═══ File Permissions ═══
✓ Project root: read/write permissions OK
✓ Frontend directory: read/write permissions OK
✓ Backend directory: read/write permissions OK
✓ Scripts directory: read/write permissions OK
✓ .env file: read/write permissions OK

═══ Rust/Cargo Environment ═══
✓ Rust: rustc 1.88.0 (6b00bc388 2025-06-23)
✓ Cargo: cargo 1.88.0 (873a06493 2025-05-10)
✓ Backend target directory exists
✓ Debug build available

═══ Docker Environment (Optional) ═══
✓ Docker: Docker version 28.3.2
✓ Docker Compose: Docker Compose version v2.38.1
✓ Docker daemon is running

═══ Health Check Summary ═══
✅ All checks passed! Your development environment is healthy.

🎭 You're ready to develop theater scripts with Pessoa!

⏱️  Health check completed in 414ms
```

## Exit codes:
- **0** - All checks passed (healthy)
- **1** - Critical errors found (unhealthy)
- Warnings don't affect exit code but are shown in yellow

## Common issues:
1. **Missing .env file** - Copy `env.example` to `.env` and configure
2. **Database connection failed** - Ensure PostgreSQL is running
3. **Missing node_modules** - Run `npm install` in root and frontend directories
4. **Rust not installed** - Install from https://rustup.rs/
5. **Port conflicts** - Stop conflicting services or change ports in .env