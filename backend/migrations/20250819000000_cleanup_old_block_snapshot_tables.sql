-- Drop old block and snapshot tables that are no longer used after YJS migration

-- Drop blocks table and related indexes
DROP TABLE IF EXISTS blocks CASCADE;

-- Drop script_snapshots_meta table 
DROP TABLE IF EXISTS script_snapshots_meta CASCADE;

-- Drop any remaining sequences
DROP SEQUENCE IF EXISTS blocks_id_seq CASCADE;
DROP SEQUENCE IF EXISTS blocks_order_seq CASCADE;
DROP SEQUENCE IF EXISTS script_snapshots_meta_id_seq CASCADE;

-- Note: The actual script data is now stored in YJS format in:
-- - yjs_base_states: Base YJS document state
-- - yjs_recent_updates: Recent YJS updates for collaboration