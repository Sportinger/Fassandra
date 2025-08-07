# Pessoa - Theater Script Editor

A modern web-based theater script editor with real-time collaboration, AI integration, and mobile support. Built with React, Rust, and PostgreSQL.

## Features

- 📝 **Advanced Script Editing** - TipTap-based editor with speaker names, dialogue, cues, and scene blocks
- 👥 **Real-time Collaboration** - Multiple users can edit scripts simultaneously with Yjs
- 🤖 **AI-Powered PDF Parsing** - Claude CLI parses uploaded PDF scripts into structured database format
- 📱 **Mobile Support** - Android app built with Capacitor
- 📄 **PDF Import** - Upload and parse theater scripts from PDFs
- 🎨 **Multi-view Modes** - Single page and multi-page views
- 🔍 **Search & Navigation** - Quick search through scripts
- 🔒 **Authentication** - JWT-based secure user authentication
- 📸 **Script Snapshots** - Version control and history tracking

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **TipTap Editor** - Rich text editing with custom extensions
- **Yjs** - Real-time collaboration
- **Capacitor** - Mobile app framework
- **Vite** - Build tool and dev server
- **PWA Support** - Progressive Web App capabilities

### Backend
- **Rust** with Axum web framework
- **PostgreSQL** - Primary database
- **WebSocket** - Real-time communication
- **JWT** - Authentication
- **Docker** - Containerization

## Getting Started

### Prerequisites
- Node.js 18+
- Rust 1.70+
- PostgreSQL 15+
- Docker & Docker Compose

### Configuration Files

#### Environment Files
- `.env.dev` - Development environment variables
- `.env.prod` - Production environment variables
- `env.example` - Template for environment configuration
- `env.production` - Production-specific settings

#### Docker Configurations
- `docker-compose.dev.yml` - Development environment setup
- `docker-compose.prod.yml` - Production deployment
- `backend/Dockerfile.dev` - Backend development container
- `backend/Dockerfile.prod` - Backend production build
- `frontend/Dockerfile.dev` - Frontend development container
- `frontend/Dockerfile.prod` - Frontend production build

#### Vite Configurations
- `frontend/vite.config.dev.ts` - Development-specific settings
- `frontend/vite.config.prod.ts` - Production build settings

#### Server Configuration
- `Caddyfile` - Production Caddy server configuration
- `frontend/Caddyfile` - Frontend-specific Caddy config

### Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/pessoa.git
cd pessoa
```

2. **Set up environment variables**
```bash
cp env.example .env.dev
# Edit .env.dev with your configuration
```

3. **Start development environment with Docker**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

This will start:
- PostgreSQL database on port 5432
- Rust backend on port 3000  
- React frontend on port 5173
- Caddy reverse proxy on ports 80/443

4. **Install frontend dependencies**
```bash
cd frontend
npm install
npm run dev
```

### Production Deployment

1. **Set up production environment**
```bash
cp env.example .env.prod
# Configure production settings
```

2. **Build Docker images**
```bash
# Build backend
docker build -f backend/Dockerfile.prod -t mylayer-backend:latest ./backend

# Build frontend
docker build -f frontend/Dockerfile.prod -t mylayer-frontend:latest ./frontend
```

3. **Deploy with Docker Compose**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

4. **Quick deployment scripts**
```bash
# Development deployment
./scripts/deploy.dev.sh

# Production deployment
./scripts/deploy.prod.sh

# Production with database reset
./scripts/deploy.prod.reset.sh
```

## Mobile App

### Android Development

1. **Build APK**
```bash
cd frontend
npm run android:build
```

2. **Run on device**
```bash
npm run android:dev
```

3. **Production build**
```bash
./frontend/build-android-prod.sh
```

## Testing

### E2E Tests with Playwright
```bash
npm run test:e2e
npm run test:e2e:ui  # With UI
```

### Unit Tests
```bash
# Frontend
cd frontend
npm test

# Backend
cd backend
cargo test
```

## Project Structure

```
pessoa/
├── backend/           # Rust backend service
│   ├── src/          # Source code
│   ├── migrations/   # Database migrations
│   └── Dockerfile.*  # Docker configurations
├── frontend/         # React frontend
│   ├── src/         # Source code
│   ├── android/     # Android app
│   └── Dockerfile.* # Docker configurations
├── scripts/         # Deployment scripts
├── tests/          # E2E tests
├── docker-compose.dev.yml
└── docker-compose.prod.yml
```

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/scripts` - List user scripts
- `POST /api/scripts` - Create new script
- `GET /api/scripts/:id` - Get script details
- `POST /api/scripts/:id/upload` - Upload PDF
- `WS /ws` - WebSocket for real-time collaboration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions, please open an issue on GitHub.
