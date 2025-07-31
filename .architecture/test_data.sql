-- Test data for improved schema with C4 support
BEGIN TRANSACTION;

-- Insert systems
INSERT INTO systems (name, description, type) VALUES
('Pessoa Theater Platform', 'Collaborative script editing platform', 'software_system'),
('Google Gemini', 'AI-powered script analysis service', 'external_system');

-- Insert test components with C4 fields
INSERT INTO components (name, type, purpose, technology_stack, layer, container_type, external, system_boundary) VALUES
('backend-service', 'service', 'Main REST API server', 'Rust, Axum, Tokio', 'backend', 'api', FALSE, 'Pessoa Theater Platform'),
('frontend-app', 'webapp', 'React-based collaborative editor', 'React, TypeScript, Vite', 'frontend', 'spa', FALSE, 'Pessoa Theater Platform'),
('websocket-service', 'service', 'Real-time collaboration', 'Rust, Axum, Yjs', 'backend', 'api', FALSE, 'Pessoa Theater Platform'),
('postgres-db', 'database', 'Primary data store', 'PostgreSQL 15', 'infrastructure', 'database', FALSE, 'Pessoa Theater Platform'),
('gemini-api', 'external_service', 'AI analysis service', 'Google AI', 'external', 'api', TRUE, 'Google Gemini');

-- Insert relationships with C4 details
INSERT INTO relationships (source_component_id, target_component_id, relationship_type, direction, protocol, technology, data_flow) VALUES
((SELECT id FROM components WHERE name = 'frontend-app'), (SELECT id FROM components WHERE name = 'backend-service'), 'api-call', 'frontend->backend', 'HTTPS', 'REST', 'JSON requests/responses'),
((SELECT id FROM components WHERE name = 'frontend-app'), (SELECT id FROM components WHERE name = 'websocket-service'), 'websocket', 'bidirectional', 'WSS', 'WebSocket', 'Yjs CRDT updates'),
((SELECT id FROM components WHERE name = 'backend-service'), (SELECT id FROM components WHERE name = 'postgres-db'), 'database', 'backend->database', 'TCP', 'PostgreSQL', 'SQL queries'),
((SELECT id FROM components WHERE name = 'backend-service'), (SELECT id FROM components WHERE name = 'gemini-api'), 'external-api', 'backend->external', 'HTTPS', 'REST', 'Script analysis requests'),
((SELECT id FROM components WHERE name = 'websocket-service'), (SELECT id FROM components WHERE name = 'backend-service'), 'integrated', 'websocket->backend', 'In-Process', 'Function calls', 'Shared memory');

-- Insert deployments
INSERT INTO deployments (component_id, environment, host, port, replicas, infrastructure_type) VALUES
((SELECT id FROM components WHERE name = 'backend-service'), 'prod', 'api.pessoa.theater', 443, 2, 'docker-compose'),
((SELECT id FROM components WHERE name = 'frontend-app'), 'prod', 'app.pessoa.theater', 443, 1, 'docker-compose'),
((SELECT id FROM components WHERE name = 'postgres-db'), 'prod', 'db.internal', 5432, 1, 'docker-compose');

-- Insert API endpoints for backend-service
INSERT INTO api_endpoints (component_id, method, path, description, is_authenticated, auth_type) VALUES
((SELECT id FROM components WHERE name = 'backend-service'), 'POST', '/login', 'User authentication', FALSE, 'NONE'),
((SELECT id FROM components WHERE name = 'backend-service'), 'POST', '/register', 'User registration', FALSE, 'NONE'),
((SELECT id FROM components WHERE name = 'backend-service'), 'GET', '/scripts', 'Get user scripts', TRUE, 'JWT'),
((SELECT id FROM components WHERE name = 'backend-service'), 'POST', '/scripts', 'Create new script', TRUE, 'JWT'),
((SELECT id FROM components WHERE name = 'backend-service'), 'GET', '/scripts/:id', 'Get script details', TRUE, 'JWT'),
((SELECT id FROM components WHERE name = 'backend-service'), 'PUT', '/scripts/:id/page-breaks', 'Update page breaks', TRUE, 'JWT');

-- Insert parameters
INSERT INTO api_parameters (endpoint_id, name, location, data_type, required, description) VALUES
((SELECT id FROM api_endpoints WHERE path = '/login'), 'username', 'body', 'string', TRUE, 'User email or username'),
((SELECT id FROM api_endpoints WHERE path = '/login'), 'password', 'body', 'string', TRUE, 'User password'),
((SELECT id FROM api_endpoints WHERE path = '/scripts/:id'), 'id', 'path', 'integer', TRUE, 'Script ID'),
((SELECT id FROM api_endpoints WHERE path = '/scripts'), 'page', 'query', 'integer', FALSE, 'Page number for pagination'),
((SELECT id FROM api_endpoints WHERE path = '/scripts'), 'limit', 'query', 'integer', FALSE, 'Items per page');

-- Insert WebSocket events
INSERT INTO websocket_events (component_id, event_name, direction, description) VALUES
((SELECT id FROM components WHERE name = 'websocket-service'), 'sync', 'bidirectional', 'Yjs document synchronization'),
((SELECT id FROM components WHERE name = 'websocket-service'), 'awareness', 'bidirectional', 'User cursor and presence info'),
((SELECT id FROM components WHERE name = 'websocket-service'), 'connect', 'incoming', 'Client connection request');

-- Insert observations
INSERT INTO observations (observation_type, description, confidence, evidence, component_id) VALUES
('pattern', 'Backend follows clean architecture with clear separation of concerns', 0.9, 'Directory structure: handlers/, services/, repositories/', (SELECT id FROM components WHERE name = 'backend-service')),
('pattern', 'Real-time collaboration using CRDT via Yjs', 0.95, 'Yjs integration in both frontend and backend', NULL),
('architecture', 'System ready for microservices migration', 0.8, 'Clear service boundaries, containerized deployment', NULL);

COMMIT;

-- Test queries
SELECT '=== C4 Container View ===' as section;
SELECT * FROM c4_container;

SELECT '=== Deployment Info ===' as section;
SELECT * FROM c4_deployment;

SELECT '=== Generate Mermaid Diagram ===' as section;
SELECT line FROM c4_mermaid_container; 