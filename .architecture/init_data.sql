-- Initialize architectural knowledge base with contexts and hierarchy

BEGIN TRANSACTION;

-- Define bounded contexts
INSERT INTO contexts (name, description, max_lines, entry_point) VALUES
('Authentication', 'User authentication, JWT, roles, permissions', 5000, 'backend/src/auth/mod.rs'),
('ScriptEditing', 'Editor components, blocks, page breaks, formatting', 15000, 'frontend/src/components/editor/'),
('Collaboration', 'Real-time sync, WebSocket, Yjs CRDT', 8000, 'backend/src/networking/websocket.rs'),
('DataPersistence', 'Database, repositories, models', 10000, 'backend/src/repositories/'),
('AIIntegration', 'Gemini API, prompt templates, analysis', 3000, 'backend/src/external/');

-- Define systems
INSERT INTO systems (name, description, type) VALUES
('Pessoa Theater Platform', 'Collaborative script editing platform', 'software_system'),
('Google Gemini', 'AI-powered script analysis service', 'external_system');

-- Root components (no parent)
INSERT INTO components (name, parent_id, context_id, type, purpose, technology_stack, layer, container_type, external, system_boundary) VALUES
('backend-service', NULL, NULL, 'service', 'Main REST API server', 'Rust, Axum, Tokio', 'backend', 'api', FALSE, 'Pessoa Theater Platform'),
('frontend-app', NULL, NULL, 'webapp', 'React-based collaborative editor', 'React, TypeScript, Vite', 'frontend', 'spa', FALSE, 'Pessoa Theater Platform'),
('postgres-db', NULL, NULL, 'database', 'Primary data store', 'PostgreSQL 15', 'infrastructure', 'database', FALSE, 'Pessoa Theater Platform'),
('gemini-api', NULL, NULL, 'external_service', 'AI analysis service', 'Google AI', 'external', 'api', TRUE, 'Google Gemini');

-- Backend modules (children of backend-service)
INSERT INTO components (name, parent_id, context_id, type, purpose, file_path, start_line, end_line, layer) VALUES
('auth-module', 1, 1, 'module', 'Authentication system', 'backend/src/auth/', 1, 1200, 'backend'),
('repositories', 1, 4, 'module', 'Data access layer', 'backend/src/repositories/', 1, 2500, 'backend'),
('handlers', 1, NULL, 'module', 'HTTP request handlers', 'backend/src/handlers/', 1, 2000, 'backend'),
('services', 1, NULL, 'module', 'Business logic services', 'backend/src/services/', 1, 3000, 'backend'),
('websocket-module', 1, 3, 'module', 'Real-time collaboration', 'backend/src/networking/', 1, 800, 'backend');

-- Auth subcomponents
INSERT INTO components (name, parent_id, context_id, type, purpose, file_path, start_line, end_line, layer) VALUES
('jwt-handler', 5, 1, 'component', 'JWT token generation/validation', 'backend/src/auth/core.rs', 50, 350, 'backend'),
('password-service', 5, 1, 'component', 'Argon2 password hashing', 'backend/src/auth/helpers.rs', 1, 180, 'backend'),
('auth-middleware', 5, 1, 'component', 'Request authentication', 'backend/src/infrastructure/middleware.rs', 20, 150, 'backend');

-- Repository subcomponents
INSERT INTO components (name, parent_id, context_id, type, purpose, file_path, start_line, end_line, layer) VALUES
('script-repository', 6, 4, 'component', 'Script CRUD operations', 'backend/src/repositories/script_repository.rs', 1, 450, 'backend'),
('block-repository', 6, 4, 'component', 'Block management', 'backend/src/repositories/block_repository.rs', 1, 380, 'backend'),
('user-repository', 6, 4, 'component', 'User data access', 'backend/src/repositories/user_repository.rs', 1, 320, 'backend');

-- Frontend modules
INSERT INTO components (name, parent_id, context_id, type, purpose, file_path, start_line, end_line, layer) VALUES
('editor-module', 2, 2, 'module', 'Script editor components', 'frontend/src/components/editor/', 1, 5000, 'frontend'),
('auth-components', 2, NULL, 'module', 'Login/register components', 'frontend/src/components/', 1, 800, 'frontend');

-- Editor subcomponents
INSERT INTO components (name, parent_id, context_id, type, purpose, file_path, start_line, end_line, layer) VALUES
('editor-core', 16, 2, 'component', 'TipTap editor instance', 'frontend/src/components/editor/components/Editor.tsx', 1, 450, 'frontend'),
('block-components', 16, 2, 'component', 'Cue, dialogue, scene blocks', 'frontend/src/components/editor/extensions/', 1, 1200, 'frontend'),
('toolbar', 16, 2, 'component', 'Editor toolbar', 'frontend/src/components/editor/components/toolbar/Toolbar.tsx', 1, 280, 'frontend');

-- Relationships
INSERT INTO relationships (source_component_id, target_component_id, relationship_type, direction, protocol, technology) VALUES
(2, 1, 'api-call', 'frontend->backend', 'HTTPS', 'REST'),
(1, 3, 'database', 'backend->database', 'TCP', 'PostgreSQL'),
(1, 4, 'external-api', 'backend->external', 'HTTPS', 'REST'),
(9, 3, 'websocket', 'websocket->database', 'TCP', 'PostgreSQL'),
(10, 3, 'queries', 'auth->database', 'TCP', 'SQL');

-- API Endpoints
INSERT INTO api_endpoints (component_id, method, path, description, is_authenticated, auth_type) VALUES
(1, 'POST', '/login', 'User authentication', FALSE, 'NONE'),
(1, 'POST', '/register', 'User registration', FALSE, 'NONE'),
(1, 'GET', '/scripts', 'Get user scripts', TRUE, 'JWT'),
(1, 'POST', '/scripts', 'Create new script', TRUE, 'JWT'),
(1, 'GET', '/scripts/:id', 'Get script with blocks', TRUE, 'JWT');

-- WebSocket Events
INSERT INTO websocket_events (component_id, event_name, direction, description) VALUES
(9, 'sync', 'bidirectional', 'Yjs document synchronization'),
(9, 'awareness', 'bidirectional', 'User cursor and selection state'),
(9, 'join', 'incoming', 'User joins collaboration session');

-- Observations
INSERT INTO observations (observation_type, description, confidence, evidence, context_id) VALUES
('pattern', 'Clean architecture with clear separation of concerns', 0.9, 'Directory structure follows domain/application/infrastructure pattern', NULL),
('architecture', 'Ready for microservice extraction', 0.8, 'Clear module boundaries, separate contexts', NULL),
('complexity', 'Auth module well-contained under 1.2k lines', 0.95, 'Line count analysis', 1),
('debt', 'Script service growing large (3k lines)', 0.9, 'Consider splitting into smaller services', 2);

COMMIT;

-- Show summary
SELECT '=== Contexts with Capacity ===' as info;
SELECT * FROM ai_context_capacity;

SELECT '=== Component Hierarchy ===' as info;
SELECT * FROM component_tree LIMIT 10;

SELECT '=== Context Overview for AI ===' as info;
SELECT * FROM ai_context_overview; 