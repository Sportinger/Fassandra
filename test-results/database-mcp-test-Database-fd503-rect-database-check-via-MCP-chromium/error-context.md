# Test info

- Name: Database MCP Test - Direct Database Verification >> Full workflow with direct database check via MCP
- Location: /home/admins/projects/pessoa/tests/database-mcp-test.spec.js:4:3

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first()

    at /home/admins/projects/pessoa/tests/database-mcp-test.spec.js:26:24
```

# Page snapshot

```yaml
- banner:
  - navigation: PESSOA / Scripts
  - text: a@b.c
  - button "☰"
- main:
  - text: Public
  - heading "sdfsdf" [level=3]
  - paragraph: "Created: 7/13/2025"
  - button "⋮"
  - text: +
```

# Test source

```ts
   1 | const { test, expect } = require('@playwright/test');
   2 |
   3 | test.describe('Database MCP Test - Direct Database Verification', () => {
   4 |   test('Full workflow with direct database check via MCP', async ({ page }) => {
   5 |     console.log('🚀 Starting full workflow with database verification...');
   6 |     
   7 |     // Step 1: Navigate to Pessoa
   8 |     await page.goto('https://192.168.2.111:8443/');
   9 |     await page.waitForLoadState('networkidle');
   10 |     
   11 |     // Step 2: Login
   12 |     console.log('🔐 Logging in...');
   13 |     await page.fill('input[type="email"]', 'a@b.c');
   14 |     await page.fill('input[type="password"]', 'a@b.c');
   15 |     await page.click('button[type="submit"]');
   16 |     await page.waitForURL(/.*/, { timeout: 10000 });
   17 |     await page.waitForSelector('text=Scripts', { timeout: 10000 });
   18 |     console.log('✅ Login successful');
   19 |     
   20 |     // Step 3: Create new script
   21 |     console.log('📝 Creating new script...');
   22 |     const timestamp = Date.now();
   23 |     const scriptTitle = `MCP Test Script ${timestamp}`;
   24 |     
   25 |     const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
>  26 |     await createButton.click();
      |                        ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
   27 |     await page.fill('input[placeholder*="title"], input[placeholder*="Title"], input[name="title"]', scriptTitle);
   28 |     await page.click('button[type="submit"]');
   29 |     await page.waitForSelector(`text=${scriptTitle}`, { timeout: 10000 });
   30 |     console.log(`✅ Script created: ${scriptTitle}`);
   31 |     
   32 |     // Step 4: Get script ID from API for database verification
   33 |     const scriptData = await page.evaluate(async () => {
   34 |       const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
   35 |       const response = await fetch('/api/scripts', {
   36 |         headers: {
   37 |           'Authorization': `Bearer ${token}`,
   38 |           'Content-Type': 'application/json'
   39 |         }
   40 |       });
   41 |       return await response.json();
   42 |     });
   43 |     
   44 |     const ourScript = scriptData.find(script => script.title === scriptTitle);
   45 |     expect(ourScript).toBeDefined();
   46 |     const scriptId = ourScript.id;
   47 |     console.log(`📊 Script ID: ${scriptId}`);
   48 |     
   49 |     // Step 5: Open script in editor
   50 |     console.log('🖱️ Opening script in editor...');
   51 |     await page.click(`text=${scriptTitle}`);
   52 |     await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
   53 |     console.log('✅ Editor loaded');
   54 |     
   55 |     // Step 6: Write content in editor
   56 |     const testContent = `Database MCP Test Content - ${new Date().toISOString()}`;
   57 |     console.log('✍️ Writing content...');
   58 |     
   59 |     const editor = page.locator('[contenteditable="true"]');
   60 |     await editor.click();
   61 |     await editor.fill(testContent);
   62 |     
   63 |     // Wait for auto-save
   64 |     await page.waitForTimeout(5000);
   65 |     console.log(`✅ Content written: ${testContent}`);
   66 |     
   67 |     // Step 7: Database verification instructions
   68 |     console.log('🔍 For database verification, use the Database MCP server:');
   69 |     console.log('');
   70 |     console.log('📋 Database MCP Queries to run:');
   71 |     console.log('');
   72 |     console.log('1. Check if script exists in database:');
   73 |     console.log(`   SELECT * FROM scripts WHERE id = '${scriptId}';`);
   74 |     console.log('');
   75 |     console.log('2. Check for blocks/content:');
   76 |     console.log(`   SELECT * FROM blocks WHERE script_id = '${scriptId}';`);
   77 |     console.log('');
   78 |     console.log('3. Check for Yjs updates:');
   79 |     console.log(`   SELECT * FROM yjs_document_updates WHERE script_id = '${scriptId}';`);
   80 |     console.log('');
   81 |     console.log('4. Check for content snapshots:');
   82 |     console.log(`   SELECT * FROM script_snapshots_meta WHERE script_id = '${scriptId}';`);
   83 |     console.log('');
   84 |     console.log('💡 Use these queries with the Database MCP server to verify data persistence!');
   85 |     
   86 |     // Step 8: Store query information for MCP usage
   87 |     await page.evaluate((data) => {
   88 |       window.mcpDatabaseQueries = data;
   89 |       console.log('📊 Database MCP Queries stored in window.mcpDatabaseQueries');
   90 |     }, {
   91 |       scriptId,
   92 |       scriptTitle,
   93 |       testContent,
   94 |       queries: {
   95 |         script: `SELECT * FROM scripts WHERE id = '${scriptId}';`,
   96 |         blocks: `SELECT * FROM blocks WHERE script_id = '${scriptId}';`,
   97 |         yjs_updates: `SELECT * FROM yjs_document_updates WHERE script_id = '${scriptId}';`,
   98 |         snapshots: `SELECT * FROM script_snapshots_meta WHERE script_id = '${scriptId}';`
   99 |       }
  100 |     });
  101 |     
  102 |     console.log('🎉 Workflow completed - ready for Database MCP verification!');
  103 |   });
  104 |   
  105 |   test('Database verification template', async ({ page }) => {
  106 |     console.log('📋 Database MCP Verification Template');
  107 |     console.log('');
  108 |     console.log('To verify database content with MCP, use these steps:');
  109 |     console.log('');
  110 |     console.log('1. Enable Database MCP server in Cursor');
  111 |     console.log('2. Run these queries:');
  112 |     console.log('');
  113 |     console.log('   -- Check latest scripts');
  114 |     console.log('   SELECT id, title, created_at FROM scripts ORDER BY created_at DESC LIMIT 5;');
  115 |     console.log('');
  116 |     console.log('   -- Check latest blocks');
  117 |     console.log('   SELECT script_id, content, created_at FROM blocks ORDER BY created_at DESC LIMIT 5;');
  118 |     console.log('');
  119 |     console.log('   -- Check WebSocket activity');
  120 |     console.log('   SELECT script_id, user_id, created_at FROM yjs_document_updates ORDER BY created_at DESC LIMIT 10;');
  121 |     console.log('');
  122 |     console.log('   -- Check content snapshots');
  123 |     console.log('   SELECT script_id, content_snapshot, last_snapshot_at FROM script_snapshots_meta ORDER BY last_snapshot_at DESC LIMIT 5;');
  124 |     console.log('');
  125 |     console.log('✅ Database MCP queries ready for execution!');
  126 |   });
```