# Theater Collaboration App - System Prompt

## Project Overview
Theater Collaboration App is a real-time, collaborative text editing platform specifically designed for theater productions. It enables multiple users to simultaneously edit scripts while maintaining proper theatrical formatting, version history, and role-based permissions. The app works offline and synchronizes when connectivity is restored.

## Architecture

### Frontend
- React + Vite PWA
- TipTap for rich text editing
- Yjs for CRDT-based collaboration
- Service Workers for offline capability
- IndexedDB for local storage

### Backend
- Axum (Rust) for API and WebSockets
- PostgreSQL for data persistence
- JWT for authentication
- CRDT synchronization and conflict resolution

## Data Model
- **Scripts**: Main document container with metadata
- **Blocks**: Script sections (character lines, stage directions, scenes)
- **Edits**: Historical changes to blocks with CRDT operations
- **Users**: User accounts with roles and permissions
- **Versions**: Named snapshots of scripts at specific points

## Rust Development Guidelines

### Core Principles
- Write idiomatic, expressive Rust code
- Embrace async programming with Tokio
- Optimize for both performance and readability
- Follow strict error handling patterns
- Use Rust type system for safety and correctness

### Async/Tokio Best Practices
- Use `async fn` for asynchronous operations
- Leverage `tokio::spawn` for concurrent task handling
- Implement timeouts for all I/O operations
- Use `tokio::select!` for managing multiple async tasks
- Prefer stream processing over collecting large result sets

When implementing block retrieval operations, ensure timeouts are applied to prevent long-running queries from blocking the event loop. This can be done by creating a timeout future that races against the primary operation using `tokio::select!`. If the timeout completes first, return an appropriate timeout error.

### Error Handling
- Use custom error types with `thiserror`
- Propagate errors with `?` operator in async functions
- Implement proper error conversion traits
- Return specific error types rather than generic errors

Design a comprehensive error type hierarchy for the application. Categories should include database errors, authentication failures, resource not found errors, and validation failures. Implement proper conversion traits to allow seamless error propagation with the `?` operator. Each error variant should provide meaningful context to aid in debugging and user feedback.

### Database Access
- Use `sqlx` with compile-time checked queries
- Implement transaction handling for multi-step operations
- Use connection pooling with appropriate sizing
- Separate database logic into dedicated modules

For database operations like creating a new script, use `sqlx` with compile-time query checking to ensure SQL validity before runtime. Provide the necessary parameters (like title and user ID) and return the created resource. Implement proper connection pooling to handle concurrent requests efficiently while not overwhelming the database server.

### WebSocket Handling
- Implement graceful connection handling and reconnection
- Use binary protocol for efficient CRDT operations
- Implement proper authorization for WebSocket connections
- Handle backpressure for slow clients

WebSocket connections should be authorized before processing any messages. After establishing a connection, split the socket into sender and receiver halves to process messages asynchronously. Subscribe to document updates from a central broadcast channel and forward them to the client. Use task cancellation patterns to ensure all resources are cleaned up when a connection terminates.

### Concurrency and Synchronization
- Use `tokio::sync::Mutex` for shared mutable state
- Implement `tokio::sync::broadcast` for real-time updates
- Keep lock durations minimal to avoid blocking
- Use atomic operations for simple counters/flags

### Performance Optimization
- Profile and identify bottlenecks with `tokio-console`
- Implement efficient batch operations for database queries
- Use connection pooling with appropriate sizing
- Implement caching for frequently accessed data

## Frontend Development Guidelines
- Implement reactive UI with React hooks
- Use Tiptap for rich text editing
- Implement offline-first with Service Workers
- Manage client-side state with Zustand or Redux
- Follow responsive design principles
- Implement progressive enhancement for older browsers

## Endpoint Structure
- `GET /api/scripts` - List scripts
- `POST /api/scripts` - Create new script
- `GET /api/scripts/:id` - Get script with blocks
- `PATCH /api/blocks/:id` - Update block
- `GET /api/blocks/:id/history` - Get block edit history
- `WS /api/collab/:script_id` - WebSocket for collaboration

## Authentication Flow
- JWT-based authentication
- Role-based permission system
- Secure WebSocket authentication
- Offline capability with cached credentials 