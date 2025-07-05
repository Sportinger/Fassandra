# 📦 Pessoa Archive

This directory contains development tools, documentation, and assets that are not essential for running the main application but are useful for development, testing, and historical reference.

## 📁 Directory Structure

### 🛠️ `development/`
Development tools and utilities that are not part of the core application:
- **`.VSCodeCounter/`** - IDE statistics and code metrics
- **`helper/`** - Development utility scripts (build helpers, shortcuts)

### 🧪 `testing/`
Testing tools and utilities:
- **`run_tests.sh`** - Comprehensive test runner script
- **`gemini_test/`** - AI integration testing tools and utilities

### 📚 `documentation/`
Historical documentation and development notes:
- **`doc/`** - Legacy documentation files
- **`doc-improvements/`** - Development improvement notes  
- **`prompt/`** - AI prompts and system prompts

### 🎨 `assets/`
Images, test files, and other assets:
- **`img/`** - Application logos and screenshots
- **`scripts_for_uplaod/`** - Test script files (.docx samples)
- **`src/`** - Standalone test applications

### 🚀 `deployment/`
Deployment scripts and configuration:
- **`scripts/`** - Production deployment and CI/CD scripts

### 📄 `docs/`
Previously organized documentation (already archived):
- **`archive/`** - Old Docker Compose files and environment templates
- **`deployment/`** - Deployment guides and setup documentation

## 🗂️ What's NOT in Archive

The following remain in the project root as they are essential for running the application:

**Core Application:**
- `backend/` - Rust backend application
- `frontend/` - React frontend application
- `docker-compose.yml` - Main development setup
- `docker-compose.prod.yml` - Production setup

**Configuration:**
- `env.example` - Development environment template
- `env.production` - Production environment template
- `.gitignore` - Git configuration

**Project Management:**
- `README.md` - Main project documentation
- `.github/` - CI/CD workflows
- `package.json` - Root dependencies
- `Cargo.toml` - Rust workspace configuration

## 🔄 Using Archived Items

If you need to use any archived items:

1. **Development Tools**: Copy from `development/` to project root temporarily
2. **Testing**: Run `archive/testing/run_tests.sh` from project root
3. **Deployment Scripts**: Reference `deployment/scripts/` for production setup
4. **Documentation**: Consult `documentation/` for historical context

## 🧹 Archive Maintenance

This archive was created to clean up the project structure while preserving useful development artifacts. Items here can be:
- **Referenced** when needed for development
- **Restored** to project root if they become essential again
- **Removed** if they become truly obsolete

The goal is to keep the main project directory clean and focused on the core application while preserving development history and tools. 