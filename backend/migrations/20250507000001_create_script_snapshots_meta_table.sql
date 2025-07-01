-- backend/migrations/YYYYMMDDHHMMSS_create_script_snapshots_meta_table.sql
CREATE TABLE IF NOT EXISTS script_snapshots_meta (
    script_id UUID PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
    last_snapshot_at TIMESTAMPTZ NOT NULL,
    last_processed_update_id BIGINT REFERENCES yjs_document_updates(id) ON DELETE SET NULL -- Allow NULL if no updates processed yet, or if referenced update is deleted (though pruning strategy should align)
); 