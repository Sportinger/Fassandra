-- Add thumbnail column to scripts table for DIN A4 previews
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS thumbnail TEXT NULL;

-- Create index for thumbnail column for better performance
CREATE INDEX IF NOT EXISTS idx_scripts_thumbnail ON scripts(thumbnail) WHERE thumbnail IS NOT NULL; 