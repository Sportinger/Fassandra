-- Improved Architecture Knowledge Base Schema for Large Projects
-- Includes hierarchies and bounded contexts for AI navigation

-- Bounded Contexts for organizing large codebases
CREATE TABLE IF NOT EXISTS contexts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    max_lines INTEGER DEFAULT 10000, -- AI capacity limit
    entry_point TEXT, -- Where to start exploring this context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Components with hierarchy and code location
CREATE TABLE IF NOT EXISTS components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER, -- Hierarchical structure
    context_id INTEGER, -- Which bounded context
    type TEXT NOT NULL,
    purpose TEXT,
    technology_stack TEXT,
    -- Code location
    file_path TEXT,
    start_line INTEGER,
    end_line INTEGER,
    -- C4 specific fields
    layer TEXT, -- frontend, backend, infrastructure
    container_type TEXT, -- spa, api, database, queue, cache
    deployment_unit TEXT, -- docker, k8s-pod, lambda, vm
    external BOOLEAN DEFAULT FALSE,
    system_boundary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES components(id),
    FOREIGN KEY (context_id) REFERENCES contexts(id)
);

-- Create index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_components_parent ON components(parent_id);
CREATE INDEX IF NOT EXISTS idx_components_context ON components(context_id);
CREATE INDEX IF NOT EXISTS idx_components_file ON components(file_path);

-- AI workspace tracking (what the AI is currently working on)
CREATE TABLE IF NOT EXISTS ai_workspace (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    context_id INTEGER,
    total_lines_loaded INTEGER DEFAULT 0,
    files_loaded INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (context_id) REFERENCES contexts(id)
);

-- System boundaries for C4 Context diagrams
CREATE TABLE IF NOT EXISTS systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    type TEXT NOT NULL, -- software_system, external_system
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced relationships table
CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_component_id INTEGER NOT NULL,
    target_component_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    data_flow TEXT,
    communication_type TEXT,
    -- C4 specific fields
    protocol TEXT, -- HTTP, WebSocket, TCP, AMQP, gRPC
    port INTEGER,
    technology TEXT, -- REST, GraphQL, SOAP, RPC
    sla_characteristics TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_component_id) REFERENCES components(id),
    FOREIGN KEY (target_component_id) REFERENCES components(id),
    UNIQUE(source_component_id, target_component_id, relationship_type)
);

-- Deployment information
CREATE TABLE IF NOT EXISTS deployments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL,
    environment TEXT NOT NULL, -- dev, staging, prod
    host TEXT,
    port INTEGER,
    replicas INTEGER DEFAULT 1,
    infrastructure_type TEXT, -- aws, azure, on-premise, docker-compose
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (component_id) REFERENCES components(id)
);

-- Observations table
CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    observation_type TEXT NOT NULL,
    description TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    evidence TEXT,
    component_id INTEGER,
    context_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (component_id) REFERENCES components(id),
    FOREIGN KEY (context_id) REFERENCES contexts(id)
);

-- API endpoints as separate table
CREATE TABLE IF NOT EXISTS api_endpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL,
    method TEXT NOT NULL, -- GET, POST, PUT, DELETE, PATCH
    path TEXT NOT NULL,
    description TEXT,
    request_body_schema TEXT, -- JSON schema
    response_schema TEXT, -- JSON schema
    is_authenticated BOOLEAN DEFAULT TRUE,
    auth_type TEXT, -- JWT, API_KEY, BASIC, NONE
    rate_limit TEXT, -- e.g. "100/hour"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (component_id) REFERENCES components(id),
    UNIQUE(component_id, method, path)
);

-- Parameters for each endpoint
CREATE TABLE IF NOT EXISTS api_parameters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL, -- path, query, header, cookie
    data_type TEXT NOT NULL, -- string, integer, boolean, array, object
    required BOOLEAN DEFAULT FALSE,
    description TEXT,
    validation_rules TEXT, -- JSON with validation rules
    example_value TEXT,
    FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id),
    UNIQUE(endpoint_id, name, location)
);

-- WebSocket channels/events
CREATE TABLE IF NOT EXISTS websocket_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL,
    event_name TEXT NOT NULL,
    direction TEXT NOT NULL, -- incoming, outgoing, bidirectional
    payload_schema TEXT, -- JSON schema
    description TEXT,
    FOREIGN KEY (component_id) REFERENCES components(id)
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_component_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_component_id);
CREATE INDEX IF NOT EXISTS idx_observations_component ON observations(component_id);
CREATE INDEX IF NOT EXISTS idx_observations_context ON observations(context_id);
CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(observation_type);
CREATE INDEX IF NOT EXISTS idx_endpoints_component ON api_endpoints(component_id);
CREATE INDEX IF NOT EXISTS idx_endpoints_method ON api_endpoints(method);
CREATE INDEX IF NOT EXISTS idx_endpoints_path ON api_endpoints(path);
CREATE INDEX IF NOT EXISTS idx_parameters_endpoint ON api_parameters(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_websocket_component ON websocket_events(component_id);
CREATE INDEX IF NOT EXISTS idx_deployments_component ON deployments(component_id);
CREATE INDEX IF NOT EXISTS idx_deployments_env ON deployments(environment);

-- View for AI context navigation
CREATE VIEW IF NOT EXISTS ai_context_overview AS
SELECT 
    ctx.name as context_name,
    c.name as component_name,
    c.file_path,
    c.end_line - c.start_line as lines_of_code,
    CASE 
        WHEN c.end_line - c.start_line > 1000 THEN '🔴 Too large'
        WHEN c.end_line - c.start_line > 500 THEN '🟡 Large'
        ELSE '🟢 Good'
    END as size_assessment
FROM contexts ctx
LEFT JOIN components c ON ctx.id = c.context_id
WHERE c.parent_id IS NULL
ORDER BY ctx.name, lines_of_code DESC;

-- View for component hierarchy
CREATE VIEW IF NOT EXISTS component_tree AS
WITH RECURSIVE tree AS (
    SELECT id, name, parent_id, context_id, file_path, 0 as level
    FROM components
    WHERE parent_id IS NULL
    
    UNION ALL
    
    SELECT c.id, c.name, c.parent_id, c.context_id, c.file_path, t.level + 1
    FROM components c
    JOIN tree t ON c.parent_id = t.id
)
SELECT 
    level,
    SUBSTR('    ', 1, level * 2) || name as name_indented,
    file_path
FROM tree
ORDER BY id;

-- View for AI workspace limits check
CREATE VIEW IF NOT EXISTS ai_context_capacity AS
SELECT 
    ctx.name as context_name,
    COUNT(c.id) as component_count,
    COALESCE(SUM(c.end_line - c.start_line), 0) as total_lines,
    ctx.max_lines,
    CASE
        WHEN COALESCE(SUM(c.end_line - c.start_line), 0) > ctx.max_lines THEN 
            '❌ Too complex - work on sub-components'
        WHEN COALESCE(SUM(c.end_line - c.start_line), 0) > ctx.max_lines * 0.8 THEN 
            '⚠️ Near limit - be selective'
        ELSE 
            '✅ Within AI capacity'
    END as ai_recommendation
FROM contexts ctx
LEFT JOIN components c ON ctx.id = c.context_id
GROUP BY ctx.id;

-- C4 Views remain the same
CREATE VIEW IF NOT EXISTS c4_context AS
SELECT DISTINCT
    COALESCE(s.name, 'Default System') as system_name,
    c.name as container_name,
    c.external,
    c.layer,
    r.relationship_type
FROM components c
LEFT JOIN systems s ON c.system_boundary = s.name
LEFT JOIN relationships r ON c.id = r.source_component_id OR c.id = r.target_component_id;

CREATE VIEW IF NOT EXISTS c4_container AS
SELECT 
    c.name,
    c.layer,
    c.container_type,
    c.technology_stack,
    c.external,
    COUNT(DISTINCT r1.id) as outgoing_relationships,
    COUNT(DISTINCT r2.id) as incoming_relationships,
    COUNT(DISTINCT e.id) as api_endpoint_count,
    COUNT(DISTINCT w.id) as websocket_event_count
FROM components c
LEFT JOIN relationships r1 ON c.id = r1.source_component_id
LEFT JOIN relationships r2 ON c.id = r2.target_component_id
LEFT JOIN api_endpoints e ON c.id = e.component_id
LEFT JOIN websocket_events w ON c.id = w.component_id
GROUP BY c.id;

CREATE VIEW IF NOT EXISTS c4_deployment AS
SELECT 
    c.name as component_name,
    c.container_type,
    d.environment,
    d.host,
    d.port,
    d.replicas,
    d.infrastructure_type
FROM deployments d
JOIN components c ON d.component_id = c.id
ORDER BY d.environment, c.name;

-- Mermaid diagram generator for bounded contexts
CREATE VIEW IF NOT EXISTS c4_mermaid_container AS
SELECT 'graph TB' as line
UNION ALL
SELECT '    subgraph "' || COALESCE(s.name, 'Pessoa System') || '"'
FROM (SELECT DISTINCT system_boundary FROM components WHERE NOT external) c
LEFT JOIN systems s ON c.system_boundary = s.name
UNION ALL
SELECT '        ' || REPLACE(name, '-', '_') || '["' || name || '<br/>' || 
    COALESCE(technology_stack, container_type, type) || '"]'
FROM components WHERE NOT external
UNION ALL
SELECT '    end'
UNION ALL
SELECT '    ' || REPLACE(name, '-', '_') || '_ext[["' || name || '<br/>(External)"]]'
FROM components WHERE external
UNION ALL
SELECT '    ' || REPLACE(c1.name, '-', '_') || ' -->|"' || 
    r.relationship_type || '<br/>' || COALESCE(r.protocol, '') || '"| ' || 
    REPLACE(c2.name, '-', '_')
FROM relationships r
JOIN components c1 ON r.source_component_id = c1.id
JOIN components c2 ON r.target_component_id = c2.id; 