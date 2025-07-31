# Architecture Visualizer 🏛️

A real-time visualization tool for the Pessoa Theater Platform architecture.

## Features

- **Live Updates**: Auto-refreshes every 5 seconds to show latest changes
- **Multiple Views**:
  - Container Diagram (C4 Model)
  - Statistics Dashboard
  - Component List with Layers
  - Deployment Information
- **Dark Theme**: Easy on the eyes for long sessions
- **Responsive Design**: Works on desktop and mobile

## Quick Start

```bash
# From the visualizer directory
./start.sh

# Or manually:
npm install
npm start
```

Then open http://localhost:3456 in your browser.

## How It Works

1. **Database Monitoring**: Watches `.architecture/knowledge.db` for changes
2. **Automatic Diagram Generation**: Uses SQL views to generate Mermaid diagrams
3. **RESTful API**: Serves architecture data as JSON
4. **Live Refresh**: Frontend polls for updates every 5 seconds

## When AI Updates Architecture

When the AI agent (`@architecture-librarian`) makes changes:
- New components appear automatically
- Relationships update in real-time
- Statistics refresh to show current counts
- Deployment info updates if infrastructure changes

## API Endpoints

- `GET /api/architecture/container` - C4 container diagram
- `GET /api/architecture/stats` - Architecture statistics
- `GET /api/architecture/components` - Component list
- `GET /api/architecture/deployment` - Deployment information

## Future Enhancements

- WebSocket support for instant updates
- Edit capabilities (when AI agents can modify)
- Export to PlantUML/PNG
- Historical view with timeline
- Diff view to show recent changes

## Regarding AI Modifications

> "wird ja irgendwann der fall sein" (it will happen eventually)

Currently, the visualizer is **read-only**. When AI agents gain write capabilities:
1. The database schema supports it (UPDATE/DELETE operations)
2. The visualizer will show changes instantly
3. A change log could track AI modifications
4. Rollback functionality could be added

The architecture is prepared for this evolution! 🚀 