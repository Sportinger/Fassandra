-- Add migration script here

-- Make sure no blocks have a NULL script_id
DELETE FROM blocks WHERE script_id IS NULL;

-- Alter the column to be NOT NULL
ALTER TABLE blocks ALTER COLUMN script_id SET NOT NULL;
