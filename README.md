# Pessoa - Theater Script Editor

A modern web-based theater script editor with real-time collaboration, AI integration, and mobile support. Built with React, Rust, and PostgreSQL.

## Features

- 📝 **Advanced Script Editing** - TipTap-based editor with speaker names, dialogue, cues, and scene blocks
- 👥 **Real-time Collaboration** - Multiple users can edit scripts simultaneously with Yjs
- 🤖 **AI Integration** - Claude-powered session monitoring and assistance
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
docker-compose up -d
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

1. **Build Docker images**
```bash
# Build backend
docker build -f backend/Dockerfile.prod -t mylayer-backend:latest ./backend

# Build frontend
docker build -f frontend/Dockerfile.prod -t mylayer-frontend:latest ./frontend
```

2. **Deploy with Docker Compose**
```bash
docker-compose -f docker-compose.production.yml up -d
```

3. **Quick deployment scripts**
```bash
# Development
./scripts/deploy.dev.sh

# Production
./scripts/deploy.prod.sh
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
└── docker-compose.yml
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
