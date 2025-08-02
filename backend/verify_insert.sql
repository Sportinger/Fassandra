-- Check the script
SELECT id, title, created_by, is_public, created_at 
FROM scripts 
WHERE title = 'Test Script from Claude' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check the blocks
SELECT b.id, b.block_type, b.content, b.block_order, b.metadata
FROM blocks b
JOIN scripts s ON b.script_id = s.id
WHERE s.title = 'Test Script from Claude'
ORDER BY b.block_order;