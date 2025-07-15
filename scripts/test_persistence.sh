#!/bin/bash

# Test script to verify Yjs persistence and snapshotting
echo "🧪 Testing Pessoa Yjs Persistence Pipeline..."
echo "=========================================="

# Check if backend is running
echo "1. Checking if backend is running..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend is running"
else
    echo "❌ Backend not running on port 3001"
    exit 1
fi

# Check database tables
echo ""
echo "2. Checking database tables..."
docker exec -it main_pessoa_db psql -U pessoa_user -d pessoa_db -c "
SELECT 
    'yjs_document_updates' as table_name, 
    COUNT(*) as total_records,
    COUNT(DISTINCT script_id) as unique_scripts,
    MAX(created_at) as latest_update
FROM yjs_document_updates
UNION ALL
SELECT 
    'script_snapshots_meta' as table_name, 
    COUNT(*) as total_records,
    0 as unique_scripts,
    MAX(last_snapshot_at) as latest_update  
FROM script_snapshots_meta
UNION ALL
SELECT 
    'blocks' as table_name, 
    COUNT(*) as total_records,
    COUNT(DISTINCT script_id) as unique_scripts,
    MAX(created_at) as latest_update
FROM blocks;"

echo ""
echo "3. Recent activity in last 5 minutes..."
docker exec -it main_pessoa_db psql -U pessoa_user -d pessoa_db -c "
SELECT 
    script_id,
    COUNT(*) as yjs_updates,
    MAX(created_at) as last_yjs_update
FROM yjs_document_updates 
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY script_id
ORDER BY last_yjs_update DESC;"

echo ""
echo "4. Snapshot status..."
docker exec -it main_pessoa_db psql -U pessoa_user -d pessoa_db -c "
SELECT 
    s.script_id,
    s.last_snapshot_at,
    s.last_processed_update_id,
    b.block_count
FROM script_snapshots_meta s
LEFT JOIN (
    SELECT script_id, COUNT(*) as block_count 
    FROM blocks 
    GROUP BY script_id
) b ON s.script_id = b.script_id
ORDER BY s.last_snapshot_at DESC;"

echo ""
echo "🔍 Look for:"
echo "  - yjs_document_updates should increase when you edit in the browser"
echo "  - script_snapshots_meta should have recent last_snapshot_at times"  
echo "  - blocks should have content that matches your editor"
echo ""
echo "📋 To monitor live updates, run:"
echo "  docker logs -f main_pessoa_backend 2>&1 | grep -E '(💾|✅|📝|❌)'" 