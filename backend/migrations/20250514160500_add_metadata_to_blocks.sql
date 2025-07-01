-- backend/migrations/20250514160500_add_metadata_to_blocks.sql
ALTER TABLE blocks
ADD COLUMN metadata JSONB NULL; 