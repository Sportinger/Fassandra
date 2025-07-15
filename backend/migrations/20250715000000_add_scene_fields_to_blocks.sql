-- Add scene tracking fields to blocks table
-- Migration: 20250715000000_add_scene_fields_to_blocks.sql

-- Add scene_number column to track scene numbers (e.g., "1", "PROLOG", "ACT I")
ALTER TABLE blocks 
ADD COLUMN scene_number VARCHAR(50) NULL;

-- Add scene_title column to track scene titles (e.g., "PROLOG", "DER TOD")
ALTER TABLE blocks 
ADD COLUMN scene_title VARCHAR(255) NULL;

-- Add index for efficient scene-based queries
CREATE INDEX idx_blocks_scene_number ON blocks(scene_number);
CREATE INDEX idx_blocks_scene_title ON blocks(scene_title);

-- Add composite index for script + scene queries
CREATE INDEX idx_blocks_script_scene ON blocks(script_id, scene_number, scene_title); 