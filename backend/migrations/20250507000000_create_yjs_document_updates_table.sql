-- backend/migrations/YYYYMMDDHHMMSS_create_yjs_document_updates_table.sql
CREATE TABLE IF NOT EXISTS yjs_document_updates (
    id BIGSERIAL PRIMARY KEY,
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Nullable if updates can be system-generated
    update_data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_yjs_document_updates_script_id_created_at ON yjs_document_updates(script_id, created_at); 