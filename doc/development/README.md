# 🔧 Development Setup Guide

Welcome to Pessoa development! This guide will get you up and running with a local development environment in under 15 minutes.

## 🎯 Overview

Pessoa is built with:
- **Backend**: Rust + Axum + PostgreSQL
- **Frontend**: React + TypeScript + Vite + TipTap
- **Real-time**: WebSocket + YJS for collaboration
- **AI**: Google Gemini API integration
- **Infrastructure**: Docker + Docker Compose

## 📋 Prerequisites

### Required Tools
Make sure you have these installed:

```bash
# Check if you have the required tools
node --version    # Should be >= 18.0.0
npm --version     # Should be >= 9.0.0
docker --version  # Should be >= 20.0.0
docker-compose --version  # Should be >= 2.0.0
git --version     # Any recent version
```

### System Requirements
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 10GB free space
- **OS**: Linux, macOS, or Windows with WSL2

## 🚀 Quick Start (5 minutes)

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/pessoa.git
cd pessoa
```

### 2. Environment Setup
```bash
# Copy environment template
cp env.example .env

# Edit the .env file with your settings
nano .env
```

**Required Environment Variables:**
```env
# Database
DATABASE_URL=postgresql://pessoa:password@localhost:5432/pessoa

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-here

# Google Gemini API (optional for AI features)
GEMINI_API_KEY=your-gemini-api-key-here

# Development settings
RUST_LOG=debug
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

### 3. Start Development Environment
```bash
# Start all services (PostgreSQL, backend, frontend)
docker-compose up -d

# Check that everything is running
docker-compose ps
```

### 4. Initialize Database
```bash
# Run migrations
docker-compose exec backend cargo run --bin migrate

# Create test user (optional)
docker-compose exec backend cargo run --bin create_test_user
```

### 5. Open the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Database**: localhost:5432

🎉 **You're ready to develop!** The application should be running with hot-reload enabled.

## 🏗️ Detailed Setup

### Backend Development (Rust)

#### Native Development (without Docker)
If you prefer to run Rust natively:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install required tools
cargo install diesel_cli --no-default-features --features postgres
cargo install cargo-watch  # For hot-reload

# Start PostgreSQL (using Docker)
docker run --name pessoa-db -d \
  -e POSTGRES_DB=pessoa \
  -e POSTGRES_USER=pessoa \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15

# Run migrations
cd backend
diesel migration run

# Start backend with hot-reload
cargo watch -x run
```

#### Backend Development Commands
```bash
# Run tests
cargo test

# Run with logging
RUST_LOG=debug cargo run

# Format code
cargo fmt

# Check for issues
cargo clippy

# Run security audit
cargo audit

# Generate documentation
cargo doc --open
```

### Frontend Development (React)

#### Native Development (without Docker)
```bash
# Install Node.js dependencies
cd frontend
npm install

# Start development server
npm run dev

# Available at http://localhost:5173
```

#### Frontend Development Commands
```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Development

#### Using Docker (Recommended)
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Connect to database
docker-compose exec postgres psql -U pessoa -d pessoa

# View logs
docker-compose logs postgres
```

#### Database Commands
```bash
# Create new migration
cd backend
diesel migration generate migration_name

# Run migrations
diesel migration run

# Revert last migration
diesel migration revert

# Reset database
diesel database reset
```

#### Database Access
```bash
# Using psql
psql postgresql://pessoa:password@localhost:5432/pessoa

# Using pgAdmin (web interface)
docker run -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL=admin@pessoa.dev \
  -e PGADMIN_DEFAULT_PASSWORD=admin \
  -d dpage/pgadmin4
```

## 🔄 Development Workflow

### Daily Development
```bash
# Pull latest changes
git pull origin main

# Update dependencies
cd frontend && npm install
cd ../backend && cargo update

# Start development environment
docker-compose up -d

# Make your changes...

# Run tests before committing
npm test                    # Frontend tests
cargo test                  # Backend tests

# Format code
npm run lint:fix           # Frontend formatting
cargo fmt                  # Backend formatting

# Commit changes
git add .
git commit -m "feat: your feature description"
git push origin your-branch
```

### Hot Reload Setup
Both frontend and backend support hot-reload in development:

- **Frontend**: Vite automatically reloads on file changes
- **Backend**: Use `cargo watch -x run` for automatic restarts
- **Database**: Migrations are applied automatically

### Environment Switching
```bash
# Development (default)
docker-compose up -d

# Production simulation
docker-compose -f docker-compose.prod.yml up -d

# Testing environment
docker-compose -f docker-compose.test.yml up -d
```

## 🧪 Testing

### Running All Tests
```bash
# Run everything
./scripts/test-all.sh

# Or manually:
cd frontend && npm test
cd backend && cargo test
```

### Test Categories
```bash
# Frontend tests
cd frontend
npm test                    # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests

# Backend tests
cd backend
cargo test                 # Unit tests
cargo test --test integration  # Integration tests
cargo test --test e2e     # End-to-end tests
```

### Test Coverage
```bash
# Frontend coverage
cd frontend
npm run test:coverage

# Backend coverage
cd backend
cargo tarpaulin --out html
```

## 🐛 Debugging

### Frontend Debugging
```bash
# Browser DevTools
# Open Chrome DevTools -> Sources -> filesystem

# VS Code debugging
# Use the provided .vscode/launch.json configuration

# Debug specific test
npm test -- --debug ComponentName
```

### Backend Debugging
```bash
# Enable debug logging
RUST_LOG=debug cargo run

# Debug with GDB
rust-gdb target/debug/pessoa-backend

# Debug tests
cargo test -- --nocapture test_name
```

### Database Debugging
```bash
# View active connections
docker-compose exec postgres psql -U pessoa -d pessoa -c "SELECT * FROM pg_stat_activity;"

# View slow queries
docker-compose exec postgres psql -U pessoa -d pessoa -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Monitor logs
docker-compose logs -f postgres
```

## 🔧 IDE Configuration

### VS Code (Recommended)
Install these extensions:
```json
{
  "recommendations": [
    "rust-lang.rust-analyzer",
    "vadimcn.vscode-lldb",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ]
}
```

### IntelliJ IDEA / WebStorm
- Install Rust plugin
- Configure TypeScript service
- Set up database connection to PostgreSQL

## 📚 Architecture Deep Dive

### Project Structure
```
pessoa/
├── backend/          # Rust backend
│   ├── src/
│   │   ├── main.rs   # Application entry point
│   │   ├── api/      # REST API endpoints
│   │   ├── models/   # Database models
│   │   ├── services/ # Business logic
│   │   └── tests/    # Backend tests
│   ├── migrations/   # Database migrations
│   └── Cargo.toml    # Rust dependencies
├── frontend/         # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/      # Custom hooks
│   │   ├── utils/      # Utility functions
│   │   └── types/      # TypeScript types
│   ├── public/      # Static assets
│   └── package.json # Node.js dependencies
├── docker-compose.yml  # Development services
└── README.md          # Project documentation
```

### Key Technologies
- **Axum**: Modern async web framework for Rust
- **Diesel**: Type-safe ORM for PostgreSQL
- **TipTap**: Rich text editor for React
- **YJS**: Real-time collaborative editing
- **Vite**: Fast frontend build tool

## 🚨 Troubleshooting

### Common Issues

#### "Port already in use"
```bash
# Find process using port
lsof -i :8000  # Backend port
lsof -i :5173  # Frontend port

# Kill process
kill -9 <PID>

# Or use different ports
docker-compose down
docker-compose up -d
```

#### "Database connection failed"
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

#### "Frontend build fails"
```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force
```

#### "Rust compilation fails"
```bash
# Update Rust toolchain
rustup update

# Clear build cache
cargo clean

# Update dependencies
cargo update
```

### Performance Issues
```bash
# Check Docker resource usage
docker stats

# Increase Docker memory limit (Docker Desktop)
# Settings -> Resources -> Advanced -> Memory: 8GB

# Use release mode for better performance
cargo run --release
```

## 🤝 Contributing

### Before You Start
1. **Read the [Contributing Guide](contributing.md)**
2. **Check existing issues on GitHub**
3. **Join our Discord for discussions**

### Code Style
- **Rust**: Follow `rustfmt` and `clippy` suggestions
- **TypeScript**: Use ESLint and Prettier configurations
- **Git**: Use conventional commits (`feat:`, `fix:`, `docs:`)

### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 🎯 Next Steps

### Learn More
- **[Architecture Overview](../architecture/README.md)** - Understand the system design
- **[API Reference](../api/README.md)** - Explore the API endpoints
- **[Contributing Guide](contributing.md)** - How to contribute code

### Get Help
- **Discord**: [Community Server](https://discord.gg/your-invite)
- **GitHub Issues**: Report bugs or request features
- **Email**: dev@pessoa.theater

---

**Happy coding! 🚀**

*If you run into any issues with this setup guide, please let us know by creating an issue on GitHub.* 