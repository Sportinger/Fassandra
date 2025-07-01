-- backend/migrations/20250514160000_add_block_order_to_blocks.sql
ALTER TABLE blocks
ADD COLUMN block_order INTEGER NOT NULL DEFAULT 0;
-- Consider if a different default or no default is more appropriate.
-- If existing rows might not have a meaningful order initially,
-- you might add the column as NULLABLE first, update existing rows, then set to NOT NULL.
-- However, since snapshotting deletes and re-inserts all blocks for a script,
-- new snapshots will populate this. The DEFAULT 0 is mostly a safety for any
-- direct insertions that might somehow bypass the snapshotter or for existing rows
-- before a snapshot runs. 