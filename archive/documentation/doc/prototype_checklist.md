# Theater Collaboration App - Prototype Checklist

## Core Infrastructure
- [x] Set up monorepo structure (frontend, backend, infra)
- [x] Configure Docker Compose for local development
- [x] Set up PostgreSQL schema with migrations
- [ ] Configure GitHub Actions (build.yml, deploy.yml)
- [x] Create basic README with setup instructions

## Backend (Axum)
- [x] Basic server setup with health endpoint
- [x] Database models and connections (sqlx)
- [x] Authentication skeleton (JWT validation)
- [x] Script endpoints (GET, POST, PATCH)
  - [x] `/scripts/:id` - Get script with blocks
  - [x] `/scripts/:id/blocks` - Create new blocks
  - [x] `/scripts/create` - Create new script
- [x] Block management
  - [x] `/blocks/:id` - Update block with new version
  - [x] `/blocks/:id/history` - View edit history
- [x] WebSocket endpoint for Yjs collaboration
- [x] Error handling middleware

## Frontend (React + Vite)
- [x] PWA setup with service worker
- [x] Basic routing (script list, editor view)
- [x] Authentication UI (minimal for prototype)
- [x] Script editor component
  - [x] Tiptap integration
  - [x] Yjs collaboration binding
  - [ ] Custom theater/screenplay formats
- [ ] Block-level history view
- [x] Offline mode & sync
  - [x] IndexedDB persistence
  - [ ] Conflict resolution UI
- [x] Basic responsive design

## Format Templates
- [ ] Classic screenplay format
- [ ] Modern theater text layout (character in bold, text indented)
- [ ] Template switching mechanism

## Collaboration Features
- [x] Real-time cursors/presence
- [x] Block-level edit history
- [ ] Basic permissions system (reader, commenter, editor, admin)
- [ ] Named version snapshots

## Deployment
- [x] Docker image builds
- [x] Environment configuration (.env)
- [ ] Database backup script
- [ ] Initial deployment (local or Render) 