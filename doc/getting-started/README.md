# 🚀 Quick Start

Get Pessoa running in 5 minutes with our automated setup scripts.

## Prerequisites

- Docker and Docker Compose installed
- Git installed
- 4GB RAM minimum

## Quick Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/pessoa.git
cd pessoa
```

### 2. Configure Environment
```bash
cp env.example .env
# Edit .env to add your GEMINI_API_KEY
```

### 3. Automated Setup
```bash
chmod +x scripts/*.sh
./scripts/clean_rebuild_with_fixes.sh
```

### 4. Access Application
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

## Need More Help?

For detailed instructions, troubleshooting, and common issues, see the **[Complete Installation Guide](installation-guide.md)**.

## What's Next?

1. Register a new account
2. Upload your first script (.docx file)
3. Start collaborating with real-time editing

---

**Having issues?** Check the [Installation Guide](installation-guide.md) for detailed troubleshooting. 