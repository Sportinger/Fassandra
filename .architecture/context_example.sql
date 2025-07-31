-- Bounded Contexts für AI-Navigation
CREATE TABLE contexts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    max_lines INTEGER DEFAULT 10000, -- AI kann max 10k Lines gut überblicken
    entry_point TEXT -- Wo die AI starten soll
);

-- Komponenten-Hierarchie mit Code-Location
CREATE TABLE component_hierarchy (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER,
    context_id INTEGER,
    file_path TEXT,
    start_line INTEGER,
    end_line INTEGER,
    lines_count INTEGER GENERATED ALWAYS AS (end_line - start_line) STORED,
    FOREIGN KEY (parent_id) REFERENCES component_hierarchy(id),
    FOREIGN KEY (context_id) REFERENCES contexts(id)
);

-- AI-Arbeitsbereich Limits
CREATE TABLE ai_workspace_limits (
    context_id INTEGER,
    max_files_at_once INTEGER DEFAULT 20,
    max_total_lines INTEGER DEFAULT 5000,
    max_complexity_score INTEGER DEFAULT 100,
    FOREIGN KEY (context_id) REFERENCES contexts(id)
);

-- Beispiel für Pessoa:
INSERT INTO contexts (name, description, max_lines, entry_point) VALUES
('Authentication', 'User auth, JWT, roles', 5000, 'backend/src/auth/mod.rs'),
('ScriptEditing', 'Editor, blocks, page breaks', 15000, 'frontend/src/components/editor/'),
('Collaboration', 'Yjs, WebSocket, real-time', 8000, 'backend/src/networking/websocket.rs'),
('DataPersistence', 'DB, repositories, models', 10000, 'backend/src/repositories/');

-- Komponenten mit Hierarchie
INSERT INTO component_hierarchy (name, parent_id, context_id, file_path, start_line, end_line) VALUES
-- Root
('backend-service', NULL, NULL, 'backend/src/', 1, 50000),
-- Auth Context
('auth-module', 1, 1, 'backend/src/auth/', 1, 1200),
('jwt-handler', 2, 1, 'backend/src/auth/core.rs', 50, 350),
('password-service', 2, 1, 'backend/src/auth/helpers.rs', 1, 180),
-- Script Context  
('script-service', 1, 2, 'backend/src/services/', 1, 3000),
('block-repository', 5, 2, 'backend/src/repositories/block_repository.rs', 1, 450);

-- View für AI: "Zeig mir alles im Auth Context"
CREATE VIEW ai_context_overview AS
SELECT 
    c.name as context,
    ch.name as component,
    ch.file_path,
    ch.lines_count,
    CASE 
        WHEN ch.lines_count > 1000 THEN '🔴 Too large - split needed'
        WHEN ch.lines_count > 500 THEN '🟡 Getting large'
        ELSE '🟢 Good size'
    END as ai_assessment
FROM contexts c
JOIN component_hierarchy ch ON c.id = ch.context_id
ORDER BY c.name, ch.lines_count DESC;

-- Query für AI: "Kann ich diesen Context auf einmal verstehen?"
CREATE VIEW ai_context_complexity AS
SELECT 
    c.name,
    COUNT(ch.id) as component_count,
    SUM(ch.lines_count) as total_lines,
    CASE
        WHEN SUM(ch.lines_count) > c.max_lines THEN 
            '❌ Too complex - work on sub-components'
        WHEN SUM(ch.lines_count) > c.max_lines * 0.8 THEN 
            '⚠️ Near limit - be selective'
        ELSE 
            '✅ Within AI capacity'
    END as recommendation
FROM contexts c
LEFT JOIN component_hierarchy ch ON c.id = ch.context_id
GROUP BY c.id; 