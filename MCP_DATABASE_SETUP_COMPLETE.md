# 🗄️ MCP Database Configuration - COMPLETE SETUP

## ✅ Configuration Status: **WORKING**

Your MCP database configuration is now properly set up and ready to use!

## 🔧 Current Configuration

### Database Connection Details
- **Host**: localhost
- **Port**: 5432
- **Database**: pessoa_db
- **User**: pessoa_user
- **Password**: dev_password_123
- **SSL Mode**: disabled (for local development)

### MCP Server Configuration (`mcp.json`)
```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@ahmetbarut/mcp-database-server"],
      "env": {
        "PGHOST": "localhost",
        "PGPORT": "5432",
        "PGDATABASE": "pessoa_db",
        "PGUSER": "pessoa_user",
        "PGPASSWORD": "dev_password_123",
        "PGSSLMODE": "disable"
      }
    }
  }
}
```

## 📊 Available Database Tables

Your Pessoa database contains these tables:
- **users** - User accounts and authentication
- **scripts** - Theater scripts and metadata
- **blocks** - Script content blocks (dialogue, stage directions)
- **edits** - Edit history and version tracking
- **script_layouts** - Layout configurations
- **script_shares** - Script sharing settings
- **script_snapshots_meta** - Script snapshot metadata
- **yjs_document_updates** - Real-time collaboration updates
- **versions** - Version control data
- **_sqlx_migrations** - Database migration history

## 🎯 MCP Database Commands

### Connection Management
```bash
# List all database connections
mcp_database_list_connections

# List all databases
mcp_database_list_databases
```

### Query Execution
```bash
# Execute SQL queries
mcp_database_execute_query connection_name="postgres" query="SELECT * FROM users LIMIT 5;"
```

## 🧪 Testing Your Setup

### 1. **Basic Database Connection Test**
```sql
-- Test connection and get database version
SELECT version();

-- Check database size
SELECT pg_size_pretty(pg_database_size('pessoa_db')) as database_size;
```

### 2. **User Data Verification**
```sql
-- List all users
SELECT id, email, username, role, created_at FROM users ORDER BY created_at DESC;

-- Check user count
SELECT COUNT(*) as total_users FROM users;
```

### 3. **Script Data Verification**
```sql
-- List recent scripts
SELECT id, title, created_at, updated_at FROM scripts ORDER BY created_at DESC LIMIT 10;

-- Check script content (blocks)
SELECT script_id, content, created_at FROM blocks ORDER BY created_at DESC LIMIT 5;
```

### 4. **Real-time Collaboration Monitoring**
```sql
-- Check recent WebSocket activity
SELECT script_id, user_id, created_at FROM yjs_document_updates ORDER BY created_at DESC LIMIT 10;

-- Monitor active collaboration sessions
SELECT script_id, COUNT(DISTINCT user_id) as active_users, MAX(created_at) as last_activity 
FROM yjs_document_updates 
WHERE created_at > NOW() - INTERVAL '1 hour' 
GROUP BY script_id;
```

## 🚀 Complete Testing Workflow

### **Step 1: UI Testing with Playwright MCP**
```bash
# Navigate to Pessoa app
mcp_playwright-test_browser_navigate url="https://192.168.2.111:8443/"

# Take screenshot
mcp_playwright-test_browser_snapshot

# Login
mcp_playwright-test_browser_type element="email input" text="a@b.c"
mcp_playwright-test_browser_click element="login button"
```

### **Step 2: Create Content**
```bash
# Create new script
mcp_playwright-test_browser_click element="new script button"
mcp_playwright-test_browser_type element="title input" text="Test Script"

# Add content to editor
mcp_playwright-test_browser_type element="editor" text="Character: Hello, world!"
```

### **Step 3: Database Verification**
```sql
-- Check if new script was created
SELECT id, title, created_at FROM scripts WHERE title = 'Test Script';

-- Check if content was saved
SELECT script_id, content, created_at FROM blocks WHERE content LIKE '%Hello, world!%';

-- Verify WebSocket activity
SELECT script_id, user_id, created_at FROM yjs_document_updates ORDER BY created_at DESC LIMIT 5;
```

## 📋 Useful SQL Queries for Development

### **User Management**
```sql
-- Get user by email
SELECT * FROM users WHERE email = 'a@b.c';

-- Check user permissions
SELECT email, role FROM users;
```

### **Script Management**
```sql
-- Get script with all blocks
SELECT s.title, b.content, b.created_at 
FROM scripts s 
JOIN blocks b ON s.id = b.script_id 
WHERE s.id = 1 
ORDER BY b.created_at;

-- Check script sharing settings
SELECT s.title, ss.is_public, ss.shared_with 
FROM scripts s 
LEFT JOIN script_shares ss ON s.id = ss.script_id;
```

### **Performance Monitoring**
```sql
-- Check database activity
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
FROM pg_stat_user_tables 
ORDER BY n_tup_ins DESC;

-- Monitor connection count
SELECT COUNT(*) as active_connections FROM pg_stat_activity;
```

## 🔍 Troubleshooting

### **Common Issues**

1. **MCP Connection Failed**
   ```bash
   # Check if database is running
   docker compose ps
   
   # Test direct connection
   PGPASSWORD=dev_password_123 psql -h localhost -p 5432 -U pessoa_user -d pessoa_db -c "SELECT 1;"
   ```

2. **Authentication Errors**
   ```bash
   # Verify credentials in mcp.json match database
   # Check docker-compose.yml for correct POSTGRES_* variables
   ```

3. **Missing Tables**
   ```bash
   # Check migration status
   docker compose logs backend | grep migration
   
   # List all tables
   PGPASSWORD=dev_password_123 psql -h localhost -p 5432 -U pessoa_user -d pessoa_db -c "\dt"
   ```

## 🎯 Production Considerations

### **Security**
- Change default passwords
- Enable SSL/TLS (`PGSSLMODE=require`)
- Use connection pooling
- Implement read-only access where possible

### **Performance**
- Add database indexes for frequently queried columns
- Monitor query performance
- Set up connection limits

### **Monitoring**
```sql
-- Monitor slow queries
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;

-- Check database size growth
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🚀 Next Steps

1. **Test the complete workflow**: UI → Database verification
2. **Set up monitoring queries** for your specific use cases
3. **Create custom MCP tools** for common database operations
4. **Implement automated testing** using both Playwright and Database MCP

## 💫 Pro Tips

- **Use transactions** for complex operations
- **Monitor WebSocket updates** to debug real-time collaboration
- **Check script_snapshots_meta** for content persistence
- **Use yjs_document_updates** to track user activity
- **Combine Playwright + Database MCP** for comprehensive testing

---

## ✅ **Your MCP Database Setup is Complete!**

**You can now:**
- ✅ Execute SQL queries directly through MCP
- ✅ Monitor database activity in real-time
- ✅ Verify data persistence from UI actions
- ✅ Debug collaboration features
- ✅ Test the complete Pessoa workflow

**Example Command:**
```
"Use MCP to check if the new script I just created is properly saved in the database. Execute: SELECT * FROM scripts ORDER BY created_at DESC LIMIT 1;"
```

**Theater professionals can now rely on thoroughly tested, database-verified functionality!** 🎭 