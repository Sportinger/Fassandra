-- YJS Compaction Refactor Migration
-- This migration sets up the new compaction-based YJS storage system

-- Create table for compacted YJS document states
CREATE TABLE IF NOT EXISTS yjs_base_states (
    script_id UUID PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
    base_state BYTEA NOT NULL,
    state_vector BYTEA NOT NULL,  -- YJS state vector for incremental updates
    compacted_at TIMESTAMPTZ DEFAULT NOW(),
    last_compacted_update_id BIGINT,
    update_count INT DEFAULT 0,
    document_size INT DEFAULT 0
);

-- Rename existing table and add compaction fields
ALTER TABLE yjs_document_updates RENAME TO yjs_recent_updates;

ALTER TABLE yjs_recent_updates 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 hours',
ADD COLUMN IF NOT EXISTS is_compacted BOOLEAN DEFAULT FALSE;

-- Add indexes for efficient operations
CREATE INDEX IF NOT EXISTS idx_yjs_recent_expires 
ON yjs_recent_updates(expires_at) 
WHERE NOT is_compacted;

CREATE INDEX IF NOT EXISTS idx_yjs_recent_script_uncompacted 
ON yjs_recent_updates(script_id, id) 
WHERE NOT is_compacted;

-- Create audit table for monitoring compaction
CREATE TABLE IF NOT EXISTS yjs_compaction_log (
    id SERIAL PRIMARY KEY,
    script_id UUID NOT NULL,
    updates_compacted INT NOT NULL,
    size_before INT NOT NULL,
    size_after INT NOT NULL,
    duration_ms INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize base states for existing scripts
INSERT INTO yjs_base_states (script_id, base_state, state_vector, last_compacted_update_id)
SELECT DISTINCT script_id, 
       '\x00'::bytea,  -- Empty initial state
       '\x00'::bytea,  -- Empty state vector
       0
FROM yjs_recent_updates
ON CONFLICT DO NOTHING;

-- Create monitoring views
CREATE OR REPLACE VIEW yjs_health AS
SELECT 
    script_id,
    COUNT(*) FILTER (WHERE NOT is_compacted) as pending_updates,
    MAX(created_at) as last_update,
    pg_size_pretty(SUM(length(update_data))::bigint) as total_size
FROM yjs_recent_updates
GROUP BY script_id;

CREATE OR REPLACE VIEW compaction_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as compactions,
    AVG(duration_ms) as avg_duration_ms,
    SUM(updates_compacted) as total_updates_compacted,
    pg_size_pretty(SUM(size_before)::bigint) as size_before,
    pg_size_pretty(SUM(size_after)::bigint) as size_after
FROM yjs_compaction_log
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Add comment to explain the new architecture
COMMENT ON TABLE yjs_base_states IS 'Stores compacted YJS document states for efficient loading';
COMMENT ON TABLE yjs_recent_updates IS 'Stores recent YJS updates that have not yet been compacted';
COMMENT ON COLUMN yjs_recent_updates.is_compacted IS 'True if this update has been included in a base state';
COMMENT ON COLUMN yjs_recent_updates.expires_at IS 'When this update can be deleted (after compaction)';