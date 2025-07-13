# 🚀 Pessoa Frontend Test Workflow

## Prerequisites
- Backend running on port 3001
- Frontend accessible at `https://192.168.2.111:8443/`
- Database access for verification commands
- Browser with network access to the frontend

## 🎯 Test Workflow: Complete User Journey

### Step 1: Health Check & Database Connection
```bash
# Check backend health
curl -X GET http://localhost:3001/health

# Connect to database (adjust connection string as needed)
psql $DATABASE_URL

# Or if using local postgres:
# psql -h localhost -U postgres -d pessoa
```

### Step 2: User Registration via Frontend
1. **Open Browser**: Navigate to `https://192.168.2.111:8443/`
2. **Register New User**:
   - Click "Register" or "Sign Up"
   - Email: `test-user-$(date +%s)@example.com`
   - Username: `testuser$(date +%s)`
   - Password: `TestPass123!`
   - Submit form

3. **Verify Registration in Database**:
```sql
-- Check if user was created
SELECT id, email, username, role, created_at 
FROM users 
WHERE email LIKE 'test-user-%@example.com' 
ORDER BY created_at DESC 
LIMIT 1;
```

### Step 3: Login via Frontend
1. **Login**: Use the credentials from Step 2
2. **Verify JWT Token**: Check browser DevTools > Application > Local Storage for auth token

### Step 4: Create Script via Frontend
1. **Create New Script**:
   - Click "New Script" or "Create Script"
   - Title: `Test Script $(date +%H:%M:%S)`
   - Submit/Save

2. **Verify Script Creation in Database**:
```sql
-- Check if script was created
SELECT s.id, s.title, s.created_by, s.created_at, u.email as creator_email
FROM scripts s
JOIN users u ON s.created_by = u.id
WHERE s.title LIKE 'Test Script %'
ORDER BY s.created_at DESC
LIMIT 1;

-- Save the script ID for next steps
\set script_id 'YOUR_SCRIPT_ID_HERE'
```

### Step 5: Write Content via Frontend
1. **Open Script**: Click on your newly created script
2. **Write Content**:
   - Type: `SCENE 1: Testing the collaborative editor`
   - Add: `This is a test line to verify database persistence`
   - Add: `Line 3: Another test line`
   - Save content (Ctrl+S or auto-save)

3. **Verify Content in Database**:
```sql
-- Check blocks created for the script
SELECT b.id, b.script_id, b.block_type, b.content, b.created_at, b.block_order, b.page_number
FROM blocks b
WHERE b.script_id = :'script_id'
ORDER BY b.page_number ASC, b.block_order ASC, b.created_at ASC;

-- Check if YJS updates are being stored
SELECT id, script_id, update_data, created_at
FROM yjs_document_updates
WHERE script_id = :'script_id'
ORDER BY created_at DESC
LIMIT 5;
```

### Step 6: Edit/Delete Content via Frontend
1. **Edit Content**:
   - Select some text in the editor
   - Delete the line: `Line 3: Another test line`
   - Add new content: `EDITED: This line was modified`
   - Save changes

2. **Verify Changes in Database**:
```sql
-- Check updated blocks
SELECT b.id, b.script_id, b.block_type, b.content, b.created_at, b.block_order
FROM blocks b
WHERE b.script_id = :'script_id'
ORDER BY b.created_at ASC;

-- Check block history/edits
SELECT e.id, e.block_id, e.user_id, e.content, e.created_at
FROM edits e
JOIN blocks b ON e.block_id = b.id
WHERE b.script_id = :'script_id'
ORDER BY e.created_at DESC;
```

### Step 7: Real-time Collaboration Test
1. **Open Second Browser/Tab**: Navigate to `https://192.168.2.111:8443/`
2. **Login with Same User** (or register another user)
3. **Open Same Script**
4. **Type in Both Windows**: Verify real-time synchronization
5. **Check WebSocket Connection**: DevTools > Network > WS tab

**Verify WebSocket Activity**:
```sql
-- Check YJS updates from both sessions
SELECT id, script_id, update_data, created_at, user_id
FROM yjs_document_updates
WHERE script_id = :'script_id'
ORDER BY created_at DESC
LIMIT 10;
```

### Step 8: Delete Script via Frontend
1. **Delete Script**:
   - Go to scripts list
   - Find your test script
   - Click delete/trash icon
   - Confirm deletion

2. **Verify Deletion in Database**:
```sql
-- Check if script was deleted
SELECT id, title, created_by, created_at
FROM scripts
WHERE id = :'script_id';

-- Check if blocks were cascade deleted
SELECT id, script_id, content
FROM blocks
WHERE script_id = :'script_id';

-- Check if YJS updates were cleaned up
SELECT id, script_id, created_at
FROM yjs_document_updates
WHERE script_id = :'script_id';
```

## 🔧 Database Verification Commands

### Quick Status Check
```sql
-- Overall system status
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM scripts) as total_scripts,
    (SELECT COUNT(*) FROM blocks) as total_blocks,
    (SELECT COUNT(*) FROM yjs_document_updates) as total_yjs_updates;
```

### Recent Activity
```sql
-- Recent user registrations
SELECT email, username, created_at
FROM users
ORDER BY created_at DESC
LIMIT 5;

-- Recent script activity
SELECT s.title, u.email as creator, s.created_at
FROM scripts s
JOIN users u ON s.created_by = u.id
ORDER BY s.created_at DESC
LIMIT 5;

-- Recent content changes
SELECT b.content, s.title, b.created_at
FROM blocks b
JOIN scripts s ON b.script_id = s.id
ORDER BY b.created_at DESC
LIMIT 5;
```

### WebSocket Activity
```sql
-- WebSocket session activity
SELECT script_id, COUNT(*) as update_count, 
       MIN(created_at) as first_update, 
       MAX(created_at) as last_update
FROM yjs_document_updates
GROUP BY script_id
ORDER BY last_update DESC;
```

## 🚨 Troubleshooting Commands

### Check Backend Status
```bash
# Check if backend is running
curl -X GET http://localhost:3001/health

# Check backend logs
docker logs -f pessoa-backend

# Check database connections
psql $DATABASE_URL -c "SELECT NOW(), COUNT(*) FROM pg_stat_activity;"
```

### Check Frontend Status
```bash
# Check frontend container
docker logs -f pessoa-frontend

# Test frontend connectivity
curl -I https://192.168.2.111:8443/
```

### Reset Test Data
```sql
-- Clean up test data (BE CAREFUL!)
DELETE FROM yjs_document_updates WHERE script_id IN (
    SELECT id FROM scripts WHERE title LIKE 'Test Script %'
);

DELETE FROM blocks WHERE script_id IN (
    SELECT id FROM scripts WHERE title LIKE 'Test Script %'
);

DELETE FROM scripts WHERE title LIKE 'Test Script %';

DELETE FROM users WHERE email LIKE 'test-user-%@example.com';
```

## 📊 Expected Results

### ✅ Success Indicators
- User registration creates entry in `users` table
- Script creation creates entry in `scripts` table  
- Content writing creates entries in `blocks` table
- Real-time editing creates entries in `yjs_document_updates` table
- Content deletion removes/updates entries appropriately
- Script deletion cascades to remove all related data

### ❌ Failure Indicators
- Frontend shows errors in browser console
- Database queries return no results
- WebSocket connections fail in DevTools
- Content changes don't persist between browser refreshes
- Real-time collaboration doesn't work between sessions

## 🎯 Quick Test Script
```bash
#!/bin/bash
echo "🚀 Starting Pessoa Test Workflow"
echo "1. Open browser to: https://192.168.2.111:8443/"
echo "2. Register user: test-user-$(date +%s)@example.com"
echo "3. Create script: Test Script $(date +%H:%M:%S)"
echo "4. Write content and verify in database"
echo "5. Check database with: psql $DATABASE_URL"
echo "✅ Test complete!"
```

This workflow provides a complete end-to-end test of your Pessoa application using the frontend interface while verifying all database operations. 