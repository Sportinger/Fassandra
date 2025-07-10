-- Add content snapshot columns to script_snapshots_meta table
-- This allows storing actual content snapshots alongside YJS updates for reliable persistence

ALTER TABLE script_snapshots_meta 
ADD COLUMN content_snapshot TEXT,
ADD COLUMN snapshot_format VARCHAR(10) DEFAULT 'html',
ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add index for faster queries by creation time
CREATE INDEX idx_script_snapshots_meta_created_at ON script_snapshots_meta(created_at);

-- Add comment to explain the purpose
COMMENT ON COLUMN script_snapshots_meta.content_snapshot IS 'Actual content snapshot for reliable persistence when YJS updates fail to reconstruct document';
COMMENT ON COLUMN script_snapshots_meta.snapshot_format IS 'Format of the content snapshot: html, json, etc.'; 