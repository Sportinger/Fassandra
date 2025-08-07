# 🗄️ Database Schema

Comprehensive documentation for Pessoa's PostgreSQL database schema and data architecture.

## 🎯 Overview

Pessoa uses PostgreSQL 15+ as its primary database, leveraging modern features like JSONB for flexible data storage, UUIDs for distributed-safe identifiers, and advanced indexing for performance. The schema supports real-time collaboration, user management, AI-analyzed content, and comprehensive audit trails.

## 🏗️ Database Architecture

### 🔧 Technology Features

| Feature | Usage | Benefit |
|---------|-------|---------|
| **PostgreSQL 15+** | Primary database | ACID compliance, performance, reliability |
| **UUID Primary Keys** | All entities | Distributed-safe, non-sequential identifiers |
| **JSONB Columns** | Flexible data | Schema-less metadata with indexing support |
| **Timestamps with Timezone** | All temporal data | Global timezone support |
| **Foreign Key Constraints** | Data integrity | Referential integrity enforcement |
| **Indexes** | Query optimization | Fast lookups and joins |

### 📊 Schema Overview

```
Users (Authentication & Authorization)
  ↓
Scripts (Core Content)
  ├── Script Shares (Collaboration Permissions)
  ├── Script Layouts (Visual Formatting)
  ├── YJS Document Updates (Real-time Collaboration)
  ├── Script Snapshots Meta (Content Preservation)
  └── Blocks (Legacy Content Structure)
```

## 📋 Core Tables

### 👤 Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,        -- Argon2 hashed passwords
    role TEXT NOT NULL DEFAULT 'user',  -- 'user', 'admin'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
```

**Key Features:**
- UUID primary keys for distributed safety
- Unique constraints on email and username
- Role-based access control
- Secure password hashing with Argon2

### 📄 Scripts Table

```sql
CREATE TABLE scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    is_public BOOLEAN DEFAULT FALSE,     -- Public script visibility
    thumbnail TEXT,                      -- Base64 encoded thumbnail
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_scripts_created_by ON scripts(created_by);
CREATE INDEX idx_scripts_is_public ON scripts(is_public);
CREATE INDEX idx_scripts_created_at ON scripts(created_at);
CREATE INDEX idx_scripts_title ON scripts(title);
```

**Key Features:**
- References script creator
- Public/private visibility control
- Thumbnail storage for quick previews
- Full-text search capabilities

### 🤝 Script Shares Table

```sql
CREATE TABLE script_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Prevent duplicate shares
    UNIQUE(script_id, shared_with_user_id)
);

-- Indexes for permission checks
CREATE INDEX idx_script_shares_script_id ON script_shares(script_id);
CREATE INDEX idx_script_shares_shared_with_user_id ON script_shares(shared_with_user_id);
CREATE INDEX idx_script_shares_permission ON script_shares(permission);
```

**Key Features:**
- Granular permission control (read/write)
- Cascade deletion for data integrity
- Unique constraint prevents duplicate shares
- Audit trail with creator tracking

### 🎨 Script Layouts Table

```sql
CREATE TABLE script_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_default BOOLEAN DEFAULT FALSE,
    layout_config JSONB NOT NULL,       -- Flexible layout configuration
    
    -- Unique layout names per script
    CONSTRAINT unique_script_layout_name UNIQUE(script_id, name)
);

-- Indexes for layout management
CREATE INDEX idx_script_layouts_script_id ON script_layouts(script_id);
CREATE INDEX idx_script_layouts_default ON script_layouts(script_id, is_default) 
    WHERE is_default = true;
CREATE INDEX idx_script_layouts_config ON script_layouts USING gin(layout_config);
```

**Example Layout Configuration:**
```json
{
  "speakers": {
    "fontWeight": "bold",
    "color": "#2563eb",
    "alignment": "left"
  },
  "dialogue": {
    "alignment": "left",
    "marginLeft": "20px"
  },
  "stageDirections": {
    "fontStyle": "italic",
    "color": "#6b7280",
    "alignment": "center"
  },
  "paragraphs": {
    "alignment": "left"
  },
  "headings": {
    "h1": { "fontSize": "2rem", "fontWeight": "bold", "marginBottom": "1rem" },
    "h2": { "fontSize": "1.5rem", "fontWeight": "bold", "marginBottom": "0.75rem" },
    "h3": { "fontSize": "1.25rem", "fontWeight": "bold", "marginBottom": "0.5rem" }
  }
}
```

## 🔄 Real-time Collaboration Tables

### 📡 YJS Document Updates

```sql
CREATE TABLE yjs_document_updates (
    id BIGSERIAL PRIMARY KEY,           -- Sequential ID for ordering
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    update_data BYTEA NOT NULL,         -- Binary YJS update data
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Critical indexes for real-time performance
CREATE INDEX idx_yjs_document_updates_script_id_created_at 
    ON yjs_document_updates(script_id, created_at);
CREATE INDEX idx_yjs_document_updates_id_script_id 
    ON yjs_document_updates(id, script_id);
```

**Key Features:**
- Sequential IDs for proper update ordering
- Binary storage for YJS update efficiency
- User tracking for audit trails
- Optimized indexes for real-time queries

### 📸 Script Snapshots Meta

```sql
CREATE TABLE script_snapshots_meta (
    script_id UUID PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
    last_snapshot_at TIMESTAMPTZ NOT NULL,
    last_processed_update_id BIGINT REFERENCES yjs_document_updates(id) ON DELETE SET NULL,
    content_snapshot TEXT,              -- HTML content snapshot
    snapshot_format VARCHAR(10) DEFAULT 'html',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for snapshot queries
CREATE INDEX idx_script_snapshots_meta_created_at ON script_snapshots_meta(created_at);
```

**Key Features:**
- One snapshot per script (primary key)
- References last processed YJS update
- HTML content preservation
- Timestamp tracking for cleanup

## 📦 Legacy Content Tables

### 🧱 Blocks Table (Legacy)

```sql
CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    block_type TEXT NOT NULL,           -- 'dialogue', 'stage_direction', 'paragraph'
    content TEXT NOT NULL,
    block_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB,                     -- Flexible block metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for block ordering and queries
CREATE INDEX idx_blocks_script_id_order ON blocks(script_id, block_order);
CREATE INDEX idx_blocks_script_id ON blocks(script_id);
CREATE INDEX idx_blocks_type ON blocks(block_type);
CREATE INDEX idx_blocks_metadata ON blocks USING gin(metadata);
```

**Block Types and Metadata:**
```sql
-- Dialogue block example
{
  "type": "dialogue",
  "content": "HAMLET: To be or not to be, that is the question.",
  "metadata": {
    "speaker": "HAMLET",
    "line": "To be or not to be, that is the question.",
    "emphasis": "thoughtful"
  }
}

-- Stage direction example
{
  "type": "stage_direction", 
  "content": "(Enter HAMLET, alone)",
  "metadata": {
    "characters": ["HAMLET"],
    "action": "enter",
    "setting": "alone"
  }
}
```

### ✏️ Edits Table (Legacy)

```sql
CREATE TABLE edits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for edit history
CREATE INDEX idx_edits_block_id_created_at ON edits(block_id, created_at);
CREATE INDEX idx_edits_user_id ON edits(user_id);
```

## 🗃️ Database Migrations

### 📈 Migration History

```sql
-- Migration tracking table (managed by SQLx)
CREATE TABLE _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    checksum BYTEA NOT NULL,
    execution_time BIGINT NOT NULL
);
```

### 🔄 Key Migrations

| Migration | Description | Date |
|-----------|-------------|------|
| `0001_create_tables.sql` | Initial schema with users, scripts, blocks, edits | 2024-01-01 |
| `20250101000001_add_username_role_to_users.sql` | Added username and role fields | 2025-01-01 |
| `20250117000000_add_script_sharing.sql` | Script sharing functionality | 2025-01-17 |
| `20250118000000_add_thumbnail_to_scripts.sql` | Thumbnail support | 2025-01-18 |
| `20250128000000_create_script_layouts_table.sql` | Layout management | 2025-01-28 |
| `20250507000000_create_yjs_document_updates_table.sql` | YJS collaboration | 2025-05-07 |
| `20250507000001_create_script_snapshots_meta_table.sql` | Content snapshots | 2025-05-07 |
| `20250710000000_add_content_snapshot_to_script_snapshots_meta.sql` | Enhanced snapshots | 2025-07-10 |

## 🔍 Query Patterns

### 📊 Common Queries

#### User Authentication
```sql
-- Login verification
SELECT id, email, username, password_hash, role 
FROM users 
WHERE email = $1;

-- User profile
SELECT id, email, username, role, created_at 
FROM users 
WHERE id = $1;
```

#### Script Access Control
```sql
-- Check script access (own, public, or shared)
SELECT EXISTS(
    SELECT 1 FROM scripts s
    WHERE s.id = $1 
    AND (
        s.created_by = $2           -- User owns the script
        OR s.is_public = true       -- Script is public
        OR EXISTS (                 -- Script is shared with user
            SELECT 1 FROM script_shares ss 
            WHERE ss.script_id = s.id 
            AND ss.shared_with_user_id = $2
        )
    )
) AS has_access;

-- Get user's accessible scripts
SELECT s.*, 
       CASE 
           WHEN s.created_by = $1 THEN 'owner'
           WHEN s.is_public THEN 'public'
           ELSE 'shared'
       END as access_type
FROM scripts s
LEFT JOIN script_shares ss ON s.id = ss.script_id AND ss.shared_with_user_id = $1
WHERE s.created_by = $1 OR s.is_public = true OR ss.script_id IS NOT NULL
ORDER BY s.created_at DESC;
```

#### Real-time Collaboration
```sql
-- Get YJS updates since last snapshot
SELECT id, update_data, user_id, created_at
FROM yjs_document_updates
WHERE script_id = $1 
  AND id > COALESCE(
      (SELECT last_processed_update_id FROM script_snapshots_meta WHERE script_id = $1), 
      0
  )
ORDER BY id ASC;

-- Get latest content snapshot
SELECT content_snapshot, snapshot_format, last_snapshot_at
FROM script_snapshots_meta
WHERE script_id = $1;
```

#### Script Management
```sql
-- Get script with sharing information
SELECT s.*,
       u.username as created_by_username,
       ARRAY_AGG(
           CASE WHEN ss.id IS NOT NULL THEN
               json_build_object(
                   'user_id', ss.shared_with_user_id,
                   'username', su.username,
                   'permission', ss.permission,
                   'shared_at', ss.created_at
               )
           END
       ) FILTER (WHERE ss.id IS NOT NULL) as shares
FROM scripts s
JOIN users u ON s.created_by = u.id
LEFT JOIN script_shares ss ON s.id = ss.script_id
LEFT JOIN users su ON ss.shared_with_user_id = su.id
WHERE s.id = $1
GROUP BY s.id, u.username;
```

### 🚀 Performance Optimizations

#### Index Strategy
```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_scripts_user_date ON scripts(created_by, created_at DESC);
CREATE INDEX idx_script_shares_user_permission ON script_shares(shared_with_user_id, permission);
CREATE INDEX idx_yjs_updates_script_time ON yjs_document_updates(script_id, created_at);

-- Partial indexes for specific conditions
CREATE INDEX idx_public_scripts ON scripts(created_at DESC) WHERE is_public = true;
CREATE INDEX idx_default_layouts ON script_layouts(script_id) WHERE is_default = true;

-- JSONB indexes for flexible queries
CREATE INDEX idx_blocks_metadata_gin ON blocks USING gin(metadata);
CREATE INDEX idx_layouts_config_gin ON script_layouts USING gin(layout_config);
```

#### Query Optimization
```sql
-- Use prepared statements for frequently executed queries
PREPARE get_user_scripts AS
SELECT s.id, s.title, s.created_at, s.thumbnail
FROM scripts s
LEFT JOIN script_shares ss ON s.id = ss.script_id
WHERE (s.created_by = $1 OR s.is_public = true OR ss.shared_with_user_id = $1)
ORDER BY s.created_at DESC
LIMIT $2 OFFSET $3;

-- Use window functions for analytics
SELECT script_id,
       COUNT(*) as total_updates,
       LAG(created_at) OVER (PARTITION BY script_id ORDER BY created_at) as prev_update
FROM yjs_document_updates
WHERE script_id = $1;
```

## 🧹 Data Maintenance

### 🔄 Cleanup Procedures

#### YJS Update Pruning
```sql
-- Archive old YJS updates (keep last 1000 per script)
CREATE OR REPLACE FUNCTION prune_old_yjs_updates(target_script_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH updates_to_keep AS (
        SELECT id
        FROM yjs_document_updates
        WHERE script_id = target_script_id
        ORDER BY id DESC
        LIMIT 1000
    )
    DELETE FROM yjs_document_updates
    WHERE script_id = target_script_id
      AND id NOT IN (SELECT id FROM updates_to_keep);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

#### Session Cleanup
```sql
-- Clean up old inactive sessions (would be external table if sessions were persisted)
-- For now, sessions are handled in memory by the backend
```

### 📊 Database Statistics

```sql
-- Table size analysis
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- Index usage statistics
SELECT 
    indexrelname as index_name,
    relname as table_name,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 🔒 Security Considerations

### 🛡️ Row Level Security (RLS)

```sql
-- Enable RLS for sensitive tables
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE yjs_document_updates ENABLE ROW LEVEL SECURITY;

-- Policy for script access
CREATE POLICY script_access_policy ON scripts
    FOR ALL
    USING (
        created_by = current_setting('app.user_id')::UUID
        OR is_public = true
        OR EXISTS (
            SELECT 1 FROM script_shares
            WHERE script_id = scripts.id
            AND shared_with_user_id = current_setting('app.user_id')::UUID
        )
    );

-- Policy for YJS updates
CREATE POLICY yjs_updates_policy ON yjs_document_updates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM scripts
            WHERE id = script_id
            AND (
                created_by = current_setting('app.user_id')::UUID
                OR is_public = true
                OR EXISTS (
                    SELECT 1 FROM script_shares
                    WHERE script_id = scripts.id
                    AND shared_with_user_id = current_setting('app.user_id')::UUID
                )
            )
        )
    );
```

### 🔐 Connection Security

```sql
-- Database user for application
CREATE USER pessoa_app WITH PASSWORD 'secure_password_here';
GRANT CONNECT ON DATABASE pessoa_db TO pessoa_app;
GRANT USAGE ON SCHEMA public TO pessoa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pessoa_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO pessoa_app;

-- Revoke unnecessary permissions
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON pg_user FROM PUBLIC;
```

## 🧪 Testing Data

### 🔬 Test Data Setup

```sql
-- Create test users
INSERT INTO users (id, email, username, password_hash, role) VALUES
('11111111-1111-1111-1111-111111111111', 'admin@pessoa.de', 'admin', '$argon2id$v=19$m=65536,t=3,p=4$test_salt$test_hash', 'admin'),
('22222222-2222-2222-2222-222222222222', 'user1@example.com', 'user1', '$argon2id$v=19$m=65536,t=3,p=4$test_salt$test_hash', 'user'),
('33333333-3333-3333-3333-333333333333', 'user2@example.com', 'user2', '$argon2id$v=19$m=65536,t=3,p=4$test_salt$test_hash', 'user');

-- Create test scripts
INSERT INTO scripts (id, title, created_by, is_public) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Hamlet', '11111111-1111-1111-1111-111111111111', true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Private Script', '22222222-2222-2222-2222-222222222222', false);

-- Create test sharing
INSERT INTO script_shares (script_id, shared_with_user_id, permission, created_by) VALUES
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'read', '22222222-2222-2222-2222-222222222222');
```

### 🧽 Test Cleanup

```sql
-- Clean test data
DELETE FROM script_shares WHERE created_by IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
);

DELETE FROM scripts WHERE created_by IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
);

DELETE FROM users WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
);
```

## 📈 Monitoring and Analytics

### 📊 Performance Monitoring

```sql
-- Long-running queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Table and index sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::text)) as total_size,
    pg_size_pretty(pg_relation_size(tablename::text)) as table_size,
    pg_size_pretty(pg_total_relation_size(tablename::text) - pg_relation_size(tablename::text)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::text) DESC;

-- Connection statistics
SELECT 
    state,
    count(*) as connections
FROM pg_stat_activity
GROUP BY state;
```

---

## 🔗 Related Documentation

- **[System Architecture](README.md)** - High-level system overview
- **[Backend Architecture](backend.md)** - Rust backend implementation
- **[Real-time Collaboration](collaboration.md)** - WebSocket and YJS details
- **[API Reference](../api/README.md)** - Complete API documentation
- **[Security Guide](../security/README.md)** - Security best practices 