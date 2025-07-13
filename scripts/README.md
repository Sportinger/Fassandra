# Database Reset Script

## ⚠️ DANGER ZONE - Use with EXTREME caution!

### `reset_database.js` - Nuclear Database Reset

**Instantly deletes ALL data from the Pessoa database without any confirmation prompts.**

### Usage

```bash
# Method 1: npm script (recommended)
npm run db:reset

# Method 2: Direct execution
node scripts/reset_database.js
```

**Prerequisites:**
```bash
# Make sure you have a .env file with database configuration
cp env.example .env

# Install dependencies if not already done
npm install
```

### What it deletes:
- ✅ All users (including admin accounts)
- ✅ All scripts and their content
- ✅ All collaboration data
- ✅ All real-time updates
- ✅ All snapshots
- ✅ All edit history

### What it preserves:
- ✅ Database schema and table structure
- ✅ Migration history

### Environment Variables

The script uses these environment variables (from your `.env` file):

```bash
DATABASE_HOST=localhost        # Default: localhost
DATABASE_PORT=5432            # Default: 5432
DATABASE_NAME=pessoa_db       # Default: pessoa_db
DATABASE_USER=postgres        # Default: postgres
DATABASE_PASSWORD=password    # Default: password
```

Or use the standard PostgreSQL connection format:
```bash
DATABASE_URL=postgres://user:password@host:port/database
```

### Example Output

```
🚨 DELETING ALL DATABASE DATA...
⚠️  This operation cannot be undone!
✅ Deleted 124 rows from blocks
✅ Deleted 35 rows from scripts
✅ Deleted 3 rows from users
✅ Deleted 273 rows from yjs_document_updates
✅ Deleted 34 rows from script_snapshots_meta
📭 Table edits was already empty

🎯 DATABASE RESET COMPLETE!
⚡ Total rows deleted: 469
⏱️  Operation completed in 45ms

✅ Database is now clean and ready for fresh data
🎭 Theater professionals can start creating new scripts!
```

### When to use:
- 🧪 Development testing
- 🔄 Demo resets
- 🗂️ Clean slate deployments
- 🚀 Performance testing with fresh data

### Lightning Fast ⚡
- **No confirmation prompts** - Runs immediately
- **Respects foreign keys** - Deletes in correct order
- **Sub-second execution** - Optimized for speed
- **Clear feedback** - Shows exactly what was deleted

**Perfect for the theater mindset: Fast, reliable, gets the job done!** 🎭 