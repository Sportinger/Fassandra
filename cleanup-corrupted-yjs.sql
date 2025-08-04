-- Cleanup script for corrupted Yjs updates
-- This removes updates that are suspiciously large or recent

-- First, let's see what we have
SELECT 
    id, 
    script_id, 
    LENGTH(update_data) as size_bytes,
    LENGTH(update_data) / 1024.0 / 1024.0 as size_mb,
    created_at
FROM yjs_document_updates 
WHERE LENGTH(update_data) > 1000000  -- Updates larger than 1MB are suspicious
ORDER BY id DESC;

-- Delete suspiciously large updates (over 1MB)
DELETE FROM yjs_document_updates 
WHERE LENGTH(update_data) > 1000000;

-- Alternative: Delete the most recent updates that might be corrupted
-- DELETE FROM yjs_document_updates 
-- WHERE id > 17;  -- Based on the logs showing "incremental from ID 17"

-- Show remaining updates
SELECT 
    COUNT(*) as total_updates,
    MAX(LENGTH(update_data)) as max_size_bytes,
    MAX(LENGTH(update_data)) / 1024.0 / 1024.0 as max_size_mb
FROM yjs_document_updates;