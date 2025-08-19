-- Drop old script-related tables since we're rebuilding from scratch
-- No backup needed as confirmed by user

-- Drop snapshot-related tables
DROP TABLE IF EXISTS script_snapshots_meta CASCADE;

-- Drop blocks table and related
DROP TABLE IF EXISTS blocks CASCADE;

-- Drop parsing metadata if exists
DROP TABLE IF EXISTS parsing_metadata CASCADE;

-- Clean up any orphaned script data
DELETE FROM scripts;
DELETE FROM yjs_recent_updates;
DELETE FROM yjs_base_states;

-- Reset auto-increment sequences if needed
-- (Scripts table remains but will be repopulated with new YJS-based scripts)

-- Add comment explaining the new architecture
COMMENT ON TABLE scripts IS 'Script metadata - actual content stored in YJS tables';
COMMENT ON TABLE yjs_base_states IS 'Compacted YJS document states for scripts';
COMMENT ON TABLE yjs_recent_updates IS 'Recent YJS updates pending compaction';