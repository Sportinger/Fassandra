const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3456;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Database path
const dbPath = path.join(__dirname, '..', 'knowledge.db');

// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('New WebSocket connection');
    
    ws.on('close', () => {
        clients.delete(ws);
    });
});

// Broadcast updates to all connected clients
function broadcastUpdate() {
    const message = 'update';
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Watch database for changes with debouncing
let debounceTimer = null;
fs.watchFile(dbPath, { interval: 500 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            console.log('Database changed, notifying clients...');
            broadcastUpdate();
        }, 100);
    }
});

// Serve static files
app.use(express.static(__dirname));

// API endpoint for C4 diagram views
app.get('/api/diagram/:view', (req, res) => {
    const db = new sqlite3.Database(dbPath);
    const view = req.params.view;
    
    let query;
    switch(view) {
        case 'container':
            query = 'SELECT line FROM c4_mermaid_container ORDER BY sort_order';
            break;
        case 'hierarchy':
            query = `
                WITH RECURSIVE tree AS (
                    SELECT *, 0 as level, name as path, 
                           CASE WHEN parent_id IS NULL THEN id ELSE NULL END as root_id
                    FROM components WHERE parent_id IS NULL
                    UNION ALL
                    SELECT c.*, t.level + 1, t.path || '/' || c.name,
                           COALESCE(t.root_id, t.id) as root_id
                    FROM components c
                    JOIN tree t ON c.parent_id = t.id
                ),
                child_counts AS (
                    SELECT parent_id, COUNT(*) as child_count
                    FROM components
                    WHERE parent_id IS NOT NULL
                    GROUP BY parent_id
                ),
                sibling_order AS (
                    SELECT c.id, c.parent_id, c.name, c.type,
                           COUNT(c2.id) as sibling_position
                    FROM components c
                    LEFT JOIN components c2 ON c.parent_id = c2.parent_id 
                        AND (c2.type < c.type OR (c2.type = c.type AND c2.name <= c.name))
                    GROUP BY c.id, c.parent_id, c.name, c.type
                )
                SELECT 
                    'flowchart TB' as line, 0 as sort_order
                UNION ALL
                -- Create subgraphs for parents with many children
                SELECT DISTINCT
                    printf('subgraph sub%s["%s (%s children)"]', 
                        t.id, 
                        SUBSTR(t.name, 1, 20) || CASE WHEN LENGTH(t.name) > 20 THEN '...' ELSE '' END,
                        cc.child_count),
                    t.id * 1000 + 1
                FROM tree t
                JOIN child_counts cc ON t.id = cc.parent_id
                WHERE cc.child_count > 5  -- Group when more than 5 children
                UNION ALL
                -- Add parent node inside its subgraph
                SELECT 
                    printf('    %s["%s"]:::%s', 
                        REPLACE(t.name, '-', '_'), 
                        SUBSTR(t.name, 1, 20) || CASE WHEN LENGTH(t.name) > 20 THEN '...' ELSE '' END,
                        CASE 
                            WHEN t.parent_id IS NULL THEN 'rootNode'
                            WHEN t.type = 'module' THEN 'module'
                            ELSE 'default'
                        END),
                    t.id * 1000 + 10
                FROM tree t
                JOIN child_counts cc ON t.id = cc.parent_id
                WHERE cc.child_count > 5
                UNION ALL
                -- Add child nodes in columns within subgraphs
                SELECT 
                    printf('    %s["%s"]:::%s', 
                        REPLACE(t.name, '-', '_'), 
                        SUBSTR(t.name, 1, 15) || CASE WHEN LENGTH(t.name) > 15 THEN '..' ELSE '' END,
                        CASE 
                            WHEN t.type = 'function' THEN 'function'
                            WHEN t.type = 'module' THEN 'module'
                            ELSE 'default'
                        END),
                    t.parent_id * 1000 + 20 + so.sibling_position
                FROM tree t
                JOIN child_counts cc ON t.parent_id = cc.parent_id
                JOIN sibling_order so ON t.id = so.id
                WHERE cc.child_count > 5 AND so.sibling_position <= 10  -- Show first 10 in subgraph
                UNION ALL
                -- Close subgraphs
                SELECT DISTINCT 'end', 
                    t.id * 1000 + 999
                FROM tree t
                JOIN child_counts cc ON t.id = cc.parent_id
                WHERE cc.child_count > 5
                UNION ALL
                -- Add standalone nodes (parents with few children or roots)
                SELECT 
                    printf('%s["%s"]:::%s', 
                        REPLACE(t.name, '-', '_'), 
                        SUBSTR(t.name, 1, 20) || CASE WHEN LENGTH(t.name) > 20 THEN '...' ELSE '' END,
                        CASE 
                            WHEN t.parent_id IS NULL THEN 'rootNode'
                            WHEN t.type = 'module' THEN 'module'
                            WHEN t.type = 'function' THEN 'function'
                            ELSE 'default'
                        END),
                    t.id * 10
                FROM tree t
                LEFT JOIN child_counts cc ON t.id = cc.parent_id
                WHERE t.parent_id IS NULL OR COALESCE(cc.child_count, 0) <= 5
                UNION ALL
                -- Add children of parents with few children
                SELECT 
                    printf('%s["%s"]:::%s', 
                        REPLACE(t.name, '-', '_'), 
                        SUBSTR(t.name, 1, 20) || CASE WHEN LENGTH(t.name) > 20 THEN '...' ELSE '' END,
                        CASE 
                            WHEN t.type = 'function' THEN 'function'
                            WHEN t.type = 'module' THEN 'module'
                            ELSE 'default'
                        END),
                    t.id * 10 + 5
                FROM tree t
                JOIN child_counts cc ON t.parent_id = cc.parent_id
                WHERE t.parent_id IS NOT NULL AND cc.child_count <= 5
                UNION ALL
                -- Add overflow children outside subgraphs
                SELECT 
                    printf('%s["%s +%s more"]:::default', 
                        REPLACE(CONCAT(t.parent_id, '_more'), '-', '_'),
                        SUBSTR(p.name, 1, 15),
                        cc.child_count - 10),
                    t.parent_id * 1000 + 50
                FROM tree t
                JOIN tree p ON t.parent_id = p.id
                JOIN child_counts cc ON t.parent_id = cc.parent_id
                JOIN sibling_order so ON t.id = so.id
                WHERE cc.child_count > 10 AND so.sibling_position = 11
                UNION ALL
                -- Add relationships
                SELECT 
                    printf('    %s --> %s', 
                        REPLACE(p.name, '-', '_'),
                        REPLACE(c.name, '-', '_')),
                    c.id * 10 + 500000
                FROM tree c
                JOIN tree p ON c.parent_id = p.id
                LEFT JOIN child_counts cc ON c.parent_id = cc.parent_id
                LEFT JOIN sibling_order so ON c.id = so.id
                WHERE COALESCE(cc.child_count, 0) <= 5 OR so.sibling_position <= 10
                UNION ALL
                -- Add relationship to "more" node for overflow
                SELECT DISTINCT
                    printf('    %s --> %s', 
                        REPLACE(p.name, '-', '_'),
                        REPLACE(CONCAT(p.id, '_more'), '-', '_')),
                    p.id * 1000 + 500051
                FROM tree p
                JOIN child_counts cc ON p.id = cc.parent_id
                WHERE cc.child_count > 10
                UNION ALL
                -- Style definitions
                SELECT 'classDef rootNode fill:#2E7D32,stroke:#1B5E20,stroke-width:3px,color:#fff,font-weight:bold', 999996
                UNION ALL
                SELECT 'classDef module fill:#4CAF50,stroke:#2E7D32,stroke-width:2px,color:#fff', 999997
                UNION ALL
                SELECT 'classDef function fill:#81C784,stroke:#388E3C,stroke-width:1px', 999998
                UNION ALL
                SELECT 'classDef default fill:#e1f5fe,stroke:#0288d1,stroke-width:1px', 999999
                ORDER BY sort_order
            `;
            break;
        case 'apis':
            query = `
                SELECT 'graph LR' as line, 0 as sort_order
                UNION ALL
                SELECT printf('    %s["%s"]', 
                    REPLACE(c.name, '-', '_'), 
                    c.name), 
                    c.id * 100
                FROM components c
                WHERE EXISTS (SELECT 1 FROM api_endpoints WHERE component_id = c.id)
                UNION ALL
                SELECT printf('    %s -.->|"%s %s"| API', 
                    REPLACE(c.name, '-', '_'),
                    e.method,
                    e.path),
                    e.id * 100 + 50
                FROM api_endpoints e
                JOIN components c ON e.component_id = c.id
                ORDER BY sort_order
            `;
            break;
        case 'context':
            query = `
                SELECT 'graph TB' as line, 0 as sort_order
                UNION ALL
                SELECT printf('    subgraph "%s"', name), id * 100
                FROM contexts
                UNION ALL
                SELECT printf('        %s["%s"]', 
                    REPLACE(name, '-', '_'), 
                    name), 
                    id * 100 + context_id * 10
                FROM components
                WHERE context_id IS NOT NULL
                UNION ALL
                SELECT '    end', id * 100 + 99
                FROM contexts
                ORDER BY sort_order
            `;
            break;
        default:
            query = 'SELECT line FROM c4_mermaid_container ORDER BY sort_order';
    }
    
    db.all(query, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const diagram = rows.map(row => row.line).join('\n');
        res.send(diagram);
    });
    
    db.close();
});

// API endpoint for stats
app.get('/api/stats', (req, res) => {
    const db = new sqlite3.Database(dbPath);
    
    db.get(`
        SELECT 
            (SELECT COUNT(*) FROM contexts) as contexts,
            (SELECT COUNT(*) FROM components) as components,
            (SELECT COUNT(*) FROM api_endpoints) as endpoints,
            (SELECT COUNT(*) FROM relationships) as relationships
    `, (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
    
    db.close();
});

// API endpoint for components with hierarchy
app.get('/api/components', (req, res) => {
    const db = new sqlite3.Database(dbPath);
    
    db.all(`
        SELECT c.*, ctx.name as context_name
        FROM components c
        LEFT JOIN contexts ctx ON c.context_id = ctx.id
        ORDER BY c.id
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
    
    db.close();
});

// API endpoint for APIs
app.get('/api/apis', (req, res) => {
    const db = new sqlite3.Database(dbPath);
    
    db.all(`
        SELECT e.*, c.name as component_name
        FROM api_endpoints e
        JOIN components c ON e.component_id = c.id
        ORDER BY e.method, e.path
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
    
    db.close();
});

// API endpoint for contexts
app.get('/api/contexts', (req, res) => {
    const db = new sqlite3.Database(dbPath);
    
    db.all('SELECT * FROM contexts ORDER BY name', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
    
    db.close();
});

// Old endpoints for backward compatibility
app.get('/api/architecture/:view', (req, res) => {
    const db = new sqlite3.Database(dbPath);
    const view = req.params.view;
    
    switch(view) {
        case 'container':
            db.all('SELECT line FROM c4_mermaid_container ORDER BY sort_order', (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                const diagram = rows.map(row => row.line).join('\n');
                res.json({ diagram });
            });
            break;
            
        case 'stats':
            const stats = [
                { label: 'Total Components', value: 0 },
                { label: 'Relationships', value: 0 },
                { label: 'API Endpoints', value: 0 },
                { label: 'Deployments', value: 0 }
            ];
            
            const queries = [
                { sql: 'SELECT COUNT(*) as count FROM components', index: 0 },
                { sql: 'SELECT COUNT(*) as count FROM relationships', index: 1 },
                { sql: 'SELECT COUNT(*) as count FROM api_endpoints', index: 2 },
                { sql: 'SELECT COUNT(*) as count FROM deployments', index: 3 }
            ];
            
            let completed = 0;
            queries.forEach(query => {
                db.get(query.sql, (err, row) => {
                    if (!err && row) {
                        stats[query.index].value = row.count;
                    }
                    completed++;
                    if (completed === queries.length) {
                        res.json({ stats });
                    }
                });
            });
            break;
            
        case 'components':
            db.all(`
                SELECT name, type, layer, purpose 
                FROM components 
                WHERE parent_id IS NULL
                ORDER BY layer, name
            `, (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ components: rows });
            });
            break;
            
        case 'deployment':
            db.all(`
                SELECT c.name as component_name, d.* 
                FROM deployments d
                JOIN components c ON d.component_id = c.id
                ORDER BY d.environment, c.name
            `, (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ deployments: rows });
            });
            break;
            
        default:
            res.status(404).json({ error: 'View not found' });
    }
    
    db.close();
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date() });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Architecture Visualizer running at http://localhost:${PORT}`);
    console.log(`🔌 WebSocket server running at ws://localhost:${PORT}`);
    console.log(`📂 Watching database at: ${dbPath}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    
    // Close WebSocket connections
    clients.forEach(client => {
        client.close();
    });
    wss.close();
    
    // Close HTTP server
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
}); 