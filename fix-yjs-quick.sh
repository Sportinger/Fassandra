#!/bin/bash
# Quick fix to remove the corrupted Yjs updates causing memory allocation errors

echo "Removing corrupted Yjs updates..."

# Connect to the database and delete the problematic updates
ssh admin@91.99.69.115 << 'EOF'
docker exec mylayer_pessoa_db psql -U postgres -d mylayer_db -c "DELETE FROM yjs_document_updates WHERE id > 17;"
docker exec mylayer_pessoa_db psql -U postgres -d mylayer_db -c "SELECT COUNT(*) as remaining_updates FROM yjs_document_updates;"
echo "Restarting backend..."
docker restart mylayer_pessoa_backend
EOF

echo "Done! Check if backend is running:"
sleep 5
ssh admin@91.99.69.115 "docker ps | grep backend"