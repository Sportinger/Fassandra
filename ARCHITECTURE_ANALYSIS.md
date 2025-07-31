# Pessoa Theater Platform - Architecture Analysis

## Executive Summary

The Pessoa Theater Collaboration Platform is a modern web application built with a clean, modular architecture that supports real-time collaborative script editing. The system demonstrates strong architectural patterns including clean architecture, event-driven design, and preparation for microservices evolution.

## System Architecture Overview

### Core Components

1. **Backend Service** (Rust/Axum)
   - REST API server running on port 3001
   - Clean architecture with clear separation of concerns
   - JWT-based authentication with Argon2 password hashing
   - Asynchronous event-driven persistence layer
   - WebSocket integration for real-time features

2. **Frontend Application** (React/TypeScript)
   - Single-page application with PWA capabilities
   - Real-time collaborative editor using TipTap and Yjs
   - Development server on port 8080
   - Modern build tooling with Vite

3. **PostgreSQL Database**
   - Version 15 running on port 5432
   - Primary data store for all application data
   - Connection pooling for performance
   - Managed migrations via SQLx

4. **External Integrations**
   - Google Gemini API for AI-powered script analysis
   - WebSocket service for real-time synchronization
   - pgAdmin for database administration

## Architectural Patterns & Decisions

### 1. Clean Architecture
The backend follows clean architecture principles with clear layer separation:
- **Handlers**: HTTP request handling and routing
- **Services**: Business logic and orchestration
- **Repositories**: Data access layer
- **Domain**: Core business entities
- **Infrastructure**: Cross-cutting concerns

### 2. Real-time Collaboration
- CRDT (Conflict-free Replicated Data Types) via Yjs
- WebSocket channels for synchronization
- Optimistic UI updates with eventual consistency

### 3. Event-Driven Persistence
- Asynchronous database writes through channel-based system
- Background workers handle persistence
- Improved performance and responsiveness

### 4. Microservices Ready
- Clear service boundaries
- API-first design
- Containerized deployment
- Currently deployed as modular monolith

## Technology Stack

### Backend
- **Language**: Rust
- **Framework**: Axum (async web framework)
- **Database**: PostgreSQL with SQLx
- **Authentication**: JWT with Argon2
- **Real-time**: Tokio, WebSockets, Yjs

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Editor**: TipTap
- **Real-time**: Yjs, WebSockets
- **Testing**: Vitest, Playwright

### Infrastructure
- **Containerization**: Docker, Docker Compose
- **Database Admin**: pgAdmin 4
- **Development**: Hot-reload enabled

## Recent Enhancements

### Scene Element Support (Latest)
- Added `Scene` struct to content model
- Enhanced script structure representation
- Better theatrical script organization
- AI integration updated for scene recognition

## Identified Concerns & Opportunities

### Technical Debt
1. **Frontend Structure**: Duplicate directory nesting (frontend/src/frontend/src)
2. **Test Coverage**: While testing infrastructure exists, coverage metrics not visible

### Performance Optimizations
- Connection pooling implemented
- Async I/O throughout
- Background task processing
- CRDT for efficient collaboration

### Security Implementation
- JWT authentication
- Argon2 password hashing
- CORS properly configured
- Security middleware layer

## System Communication Flow

```
Frontend App
    ├── REST API calls → Backend Service
    ├── WebSocket → Real-time Sync
    └── Static assets → Vite Dev Server

Backend Service
    ├── Database queries → PostgreSQL
    ├── AI requests → Gemini API
    └── WebSocket handler → Yjs Sync

pgAdmin → PostgreSQL (admin interface)
```

## Deployment Architecture

The application uses Docker Compose for orchestration with separate configurations for:
- Local development (docker-compose.yml)
- Production deployment (docker-compose.prod.yml)
- Custom layer deployment (docker-compose.mylayer.yml)

## Recommendations

1. **Refactor Frontend Structure**: Clean up the duplicate directory nesting
2. **Implement Metrics**: Add observability for performance monitoring
3. **Document API**: Consider OpenAPI/Swagger documentation
4. **Cache Layer**: Add Redis for session management and caching
5. **Load Testing**: Establish performance baselines for collaborative features

## Architecture Knowledge Base

A SQLite-based knowledge store has been created at `.architecture/knowledge.db` to track:
- Component definitions and relationships
- Architectural patterns and decisions
- System evolution and observations

This knowledge base will grow with the system and provide queryable insights into architectural decisions and system dependencies.