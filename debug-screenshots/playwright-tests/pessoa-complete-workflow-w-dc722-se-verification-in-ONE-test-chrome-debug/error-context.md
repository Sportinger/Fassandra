# Test info

- Name: Pessoa Complete Workflow + Real Database Verification >> Complete workflow + Database verification in ONE test
- Location: /home/admins/projects/pessoa/tests/pessoa-complete-workflow-with-database-verification.spec.js:54:7

# Error details

```
Error: page.click: Target page, context or browser has been closed
Call log:
  - waiting for locator('text=MCP-1752504115347')

    at /home/admins/projects/pessoa/tests/pessoa-complete-workflow-with-database-verification.spec.js:139:16
```

# Test source

```ts
   39 |     console.error(`❌ Database query failed: ${error.message}`);
   40 |     return {
   41 |       success: false,
   42 |       rows: [],
   43 |       error: error.message
   44 |     };
   45 |   }
   46 | }
   47 |
   48 | test.describe('Pessoa Complete Workflow + Real Database Verification', () => {
   49 |   const testUser = {
   50 |     email: 'a@b.c',
   51 |     password: 'a@b.c'
   52 |   };
   53 |
   54 |   test('Complete workflow + Database verification in ONE test', async ({ page }) => {
   55 |     // =====================================================
   56 |     // SETUP: Browser Console Capture
   57 |     // =====================================================
   58 |     
   59 |     const consoleLogs = [];
   60 |     const consoleErrors = [];
   61 |     
   62 |     // Capture all console messages for debugging
   63 |     page.on('console', msg => {
   64 |       const logEntry = {
   65 |         type: msg.type(),
   66 |         text: msg.text(),
   67 |         timestamp: new Date().toISOString(),
   68 |         url: page.url()
   69 |       };
   70 |       
   71 |       if (msg.type() === 'error') {
   72 |         consoleErrors.push(logEntry);
   73 |         console.log(`🔴 Browser Error: ${msg.text()}`);
   74 |       } else {
   75 |         consoleLogs.push(logEntry);
   76 |         console.log(`🌐 Browser ${msg.type()}: ${msg.text()}`);
   77 |       }
   78 |     });
   79 |     
   80 |     // Capture page errors
   81 |     page.on('pageerror', exception => {
   82 |       const errorEntry = {
   83 |         type: 'pageerror',
   84 |         text: exception.message,
   85 |         timestamp: new Date().toISOString(),
   86 |         url: page.url()
   87 |       };
   88 |       consoleErrors.push(errorEntry);
   89 |       console.log(`🔴 Page Error: ${exception.message}`);
   90 |     });
   91 |     
   92 |     // =====================================================
   93 |     // PART 1: COMPLETE PLAYWRIGHT WORKFLOW
   94 |     // =====================================================
   95 |     
   96 |     console.log('\n🎭 === PART 1: COMPLETE PLAYWRIGHT WORKFLOW ===');
   97 |     
   98 |     // Variables to track our test
   99 |     let scriptId = null;
  100 |     let scriptName = null;
  101 |     let timestamp = Date.now();
  102 |     
  103 |     // Step 1: Login (500ms delay - 50% faster than before)
  104 |     console.log('🔑 Step 1: Login (lightning fast 500ms)...');
  105 |     
  106 |     await page.goto('https://192.168.2.111:8443');
  107 |     await page.fill('input[type="email"]', testUser.email);
  108 |     await page.fill('input[type="password"]', testUser.password);
  109 |     await page.click('button[type="submit"]');
  110 |     
  111 |     // Reduced delay for faster testing
  112 |     await page.waitForTimeout(500);
  113 |     
  114 |     await expect(page.locator('text=Scripts')).toBeVisible();
  115 |     console.log('✅ Login successful');
  116 |     
  117 |     // Step 2: Create New Script (500ms delay - 50% faster than before)
  118 |     console.log('📝 Step 2: Create new script (lightning fast 500ms)...');
  119 |     
  120 |     await page.click('text=+');
  121 |     
  122 |     // Reduced delay for faster testing
  123 |     await page.waitForTimeout(500);
  124 |     
  125 |     // Click on "Create New Script" button
  126 |     await page.click('text=Create New Script');
  127 |     
  128 |     scriptName = `MCP-${timestamp}`;
  129 |     
  130 |     await page.fill('input[placeholder="New script name"]', scriptName);
  131 |     await page.click('text=Create');
  132 |     
  133 |     // Wait 300ms for script to appear in list, then click it
  134 |     console.log('⏳ Waiting 300ms for script to appear in list...');
  135 |     await page.waitForTimeout(300);
  136 |     
  137 |     // Step 2b: Click on newly created script after 300ms
  138 |     console.log('🖱️  Clicking on newly created script...');
> 139 |     await page.click(`text=${scriptName}`);
      |                ^ Error: page.click: Target page, context or browser has been closed
  140 |     
  141 |     // Now wait for editor to load
  142 |     console.log('⏳ Waiting for editor to load...');
  143 |     await page.waitForURL(/\/editor\/(.+)$/, { timeout: 10000 });
  144 |     
  145 |     // Capture the script ID from the URL
  146 |     const url = page.url();
  147 |     scriptId = url.split('/').pop();
  148 |     console.log(`📋 Script ID captured: ${scriptId}`);
  149 |     console.log(`📋 Script name: ${scriptName}`);
  150 |     console.log('✅ Script creation successful - editor loaded');
  151 |     
  152 |     // Step 3: Write short speed test content
  153 |     console.log('✏️  Step 3: Writing short speed test...');
  154 |     
  155 |     const quickTestContent = `Speed test ${timestamp} - FAST!`;
  156 |     
  157 |     // Wait for editor to be ready
  158 |     await expect(page.locator('.ProseMirror')).toBeVisible();
  159 |     
  160 |     // Write quick test content
  161 |     await page.locator('.ProseMirror').click();
  162 |     await page.keyboard.press('Control+A');
  163 |     await page.keyboard.press('Delete');
  164 |     await page.locator('.ProseMirror').fill(quickTestContent);
  165 |     
  166 |     console.log('✅ Quick content written');
  167 |     
  168 |     // Step 4: Wait 1 second 
  169 |     console.log('⏱️  Step 4: Wait 1 second...');
  170 |     await page.waitForTimeout(1000);
  171 |     console.log('✅ 1 second wait completed');
  172 |     
  173 |     // Step 5: Navigate Back (instant)
  174 |     console.log('🔄 Step 5: Navigate back to scripts...');
  175 |     
  176 |     await page.getByRole('main').getByRole('button', { name: 'Scripts' }).click();
  177 |     
  178 |     // Wait for scripts page to load and then check for our script
  179 |     // Fix: Use more specific locator to avoid strict mode violation (there are 2 Scripts buttons)
  180 |     await expect(page.getByRole('main').getByRole('button', { name: 'Scripts' })).toBeVisible();
  181 |     console.log('✅ Navigation back to scripts successful');
  182 |     
  183 |     // Step 6: Logout (instant)
  184 |     console.log('🚪 Step 6: Logout...');
  185 |     
  186 |     // Small wait to ensure page is stable after navigation
  187 |     await page.waitForTimeout(200);
  188 |     
  189 |     // Try banner hamburger menu first (likely location on scripts page)
  190 |     try {
  191 |       await page.getByRole('banner').getByRole('button', { name: '☰' }).click();
  192 |     } catch (error) {
  193 |       // Fallback to main hamburger menu
  194 |       await page.getByRole('main').getByRole('button', { name: '☰' }).click();
  195 |     }
  196 |     
  197 |     await page.getByRole('button', { name: 'Logout' }).click();
  198 |     
  199 |     await expect(page.locator('h2:has-text("Login")')).toBeVisible();
  200 |     console.log('✅ Logout successful');
  201 |     
  202 |     // =====================================================
  203 |     // PART 2: DATABASE VERIFICATION
  204 |     // =====================================================
  205 |     
  206 |     console.log('\n🔍 === PART 2: DATABASE VERIFICATION ===');
  207 |     
  208 |     // Step 7: Check if content is in database
  209 |     console.log('🔍 Step 7: Verifying content in database...');
  210 |     
  211 |     // Query for the script we just created
  212 |     const scriptQuery = `SELECT * FROM scripts WHERE id = $1`;
  213 |     const scriptResult = await executeDatabaseQuery(scriptQuery, [scriptId]);
  214 |     
  215 |     if (scriptResult.success && scriptResult.rows.length > 0) {
  216 |       console.log('✅ Script found in database');
  217 |       console.log(`📋 Script: ${scriptResult.rows[0].title}`);
  218 |     } else {
  219 |       console.log('❌ Script NOT found in database');
  220 |       throw new Error('Script not found in database');
  221 |     }
  222 |     
  223 |     // Query for the content blocks
  224 |     const contentQuery = `SELECT * FROM blocks WHERE script_id = $1`;
  225 |     const contentResult = await executeDatabaseQuery(contentQuery, [scriptId]);
  226 |     
  227 |     if (contentResult.success && contentResult.rows.length > 0) {
  228 |       console.log('✅ Content blocks found in database');
  229 |       console.log(`📝 Found ${contentResult.rows.length} content blocks`);
  230 |       
  231 |       // Debug: Print actual content in database
  232 |       console.log('🔍 DEBUG: Actual content in database:');
  233 |       contentResult.rows.forEach((block, index) => {
  234 |         console.log(`   Block ${index}: ${JSON.stringify(block.content)}`);
  235 |       });
  236 |       
  237 |       // Check if our test content is in the database
  238 |       // Make search more flexible - just look for "Speed test" and "FAST"
  239 |       const foundContent = contentResult.rows.some(block => 
```