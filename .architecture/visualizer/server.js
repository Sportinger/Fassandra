const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = 3456;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Database path
const DB_PATH = path.join(__dirname, '..', 'knowledge.db');

// Store connected clients
const clients = new Set();

// Serve static files
app.use(express.static(__dirname));

// Enable CORS for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Open database connection
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to the architecture database.');
    }
});

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    clients.add(ws);
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'connected', message: 'Real-time updates active' }));
    
    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Broadcast update to all connected clients
function broadcastUpdate(updateType) {
    const message = JSON.stringify({
        type: 'update',
        updateType: updateType,
        timestamp: new Date().toISOString()
    });
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// API endpoint for container diagram
app.get('/api/architecture/container', (req, res) => {
    db.all('SELECT line FROM c4_mermaid_container', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            const diagram = rows.map(row => row.line).join('\n');
            res.json({ diagram });
        }
    });
});

// API endpoint for statistics
app.get('/api/architecture/stats', async (req, res) => {
    const stats = [];
    
    // Count components
    const getCount = (query) => {
        return new Promise((resolve, reject) => {
            db.get(query, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };
    
    try {
        const componentCount = await getCount('SELECT COUNT(*) as count FROM components');
        const endpointCount = await getCount('SELECT COUNT(*) as count FROM api_endpoints');
        const relationshipCount = await getCount('SELECT COUNT(*) as count FROM relationships');
        const deploymentCount = await getCount('SELECT COUNT(*) as count FROM deployments');
        const websocketCount = await getCount('SELECT COUNT(*) as count FROM websocket_events');
        const observationCount = await getCount('SELECT COUNT(*) as count FROM observations');
        
        stats.push(
            { label: 'Components', value: componentCount.count },
            { label: 'API Endpoints', value: endpointCount.count },
            { label: 'Relationships', value: relationshipCount.count },
            { label: 'Deployments', value: deploymentCount.count },
            { label: 'WebSocket Events', value: websocketCount.count },
            { label: 'Observations', value: observationCount.count }
        );
        
        res.json({ stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API endpoint for components
app.get('/api/architecture/components', (req, res) => {
    db.all(`
        SELECT name, type, layer, purpose, external, technology_stack
        FROM components
        ORDER BY layer, name
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ components: rows });
        }
    });
});

// API endpoint for deployments
app.get('/api/architecture/deployment', (req, res) => {
    db.all(`
        SELECT * FROM c4_deployment
        ORDER BY environment, component_name
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ deployments: rows });
        }
    });
});

// Watch database for changes with debouncing
let lastMtime = null;
let debounceTimer = null;

if (fs.existsSync(DB_PATH)) {
    // Get initial mtime
    const stats = fs.statSync(DB_PATH);
    lastMtime = stats.mtime;
    
    fs.watchFile(DB_PATH, { interval: 500 }, (curr, prev) => {
        if (curr.mtime.getTime() !== lastMtime.getTime()) {
            lastMtime = curr.mtime;
            
            // Debounce rapid changes
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log('Database updated at:', curr.mtime);
                broadcastUpdate('database');
            }, 100);
        }
    });
}

// Start server
server.listen(PORT, () => {
    console.log(`Architecture Visualizer running at http://localhost:${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
    console.log(`Database: ${DB_PATH}`);
    console.log('\nOpen your browser to see the live architecture diagram!');
    console.log('Real-time updates are enabled via WebSocket.');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    
    // Close WebSocket connections
    wss.clients.forEach(client => {
        client.close();
    });
    
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
}); 