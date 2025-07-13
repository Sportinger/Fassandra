-- Add page_number field to blocks table
-- This stores the page number where each block should appear
ALTER TABLE blocks 
ADD COLUMN page_number INTEGER DEFAULT 1 NOT NULL;

-- Create index for efficient page-based queries
CREATE INDEX idx_blocks_script_id_page_number 
ON blocks(script_id, page_number, block_order);

-- Create index for page-based content retrieval
CREATE INDEX idx_blocks_page_number 
ON blocks(page_number);

-- Add comment for documentation
COMMENT ON COLUMN blocks.page_number IS 'Page number where this block appears in the script (1-based)'; 