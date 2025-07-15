# Test info

- Name: Pessoa Complete Workflow + Real Database Verification >> Complete workflow + Database verification with fixed user creation/cleanup
- Location: /home/admins/projects/pessoa/tests/pessoa-complete-workflow-with-database-verification.spec.js:61:7

# Error details

```
Error: expect(locator).toBeVisible()

Locator: locator('text=Scripts')
Expected: visible
Received: <element(s) not found>
Call log:
  - expect.toBeVisible with timeout 5000ms
  - waiting for locator('text=Scripts')

    at /home/admins/projects/pessoa/tests/pessoa-complete-workflow-with-database-verification.spec.js:161:48
```

# Test source

```ts
   61 |   test('Complete workflow + Database verification with fixed user creation/cleanup', async ({ page }) => {
   62 |     // =====================================================
   63 |     // PART 0: USER SETUP AND CREATION
   64 |     // =====================================================
   65 |     
   66 |     console.log('\n🧑 === PART 0: CREATE TEST USER ===');
   67 |     
   68 |     const timestamp = Date.now();
   69 |     
   70 |     console.log(`👤 Creating test user: ${testUser.email}`);
   71 |     
   72 |     // First, cleanup any existing test user and their scripts (foreign key constraints)
   73 |     console.log('🧹 Cleaning up any existing test user and scripts...');
   74 |     
   75 |     // Delete scripts first (foreign key constraint)
   76 |     const deleteExistingScriptsQuery = `DELETE FROM scripts WHERE created_by = (SELECT id FROM users WHERE email = $1)`;
   77 |     await executeDatabaseQuery(deleteExistingScriptsQuery, [testUser.email]);
   78 |     
   79 |     // Then delete the user
   80 |     const deleteExistingUserQuery = `DELETE FROM users WHERE email = $1`;
   81 |     await executeDatabaseQuery(deleteExistingUserQuery, [testUser.email]);
   82 |     
   83 |     // Insert the test user into the database using pre-generated hash
   84 |     const createUserQuery = `
   85 |       INSERT INTO users (id, email, password_hash, role, username, created_at) 
   86 |       VALUES ($1, $2, $3, $4, $5, NOW())
   87 |     `;
   88 |     const createUserResult = await executeDatabaseQuery(createUserQuery, [
   89 |       testUser.id,
   90 |       testUser.email, 
   91 |       testUser.passwordHash,
   92 |       testUser.role,
   93 |       testUser.username
   94 |     ]);
   95 |     
   96 |     if (!createUserResult.success) {
   97 |       console.error('❌ Failed to create test user, skipping test');
   98 |       throw new Error(`User creation failed: ${createUserResult.error}`);
   99 |     }
  100 |     
  101 |     console.log(`✅ Test user created successfully: ${testUser.email}`);
  102 |     
  103 |     // =====================================================
  104 |     // SETUP: Browser Console Capture
  105 |     // =====================================================
  106 |     
  107 |     const consoleLogs = [];
  108 |     const consoleErrors = [];
  109 |     
  110 |     // Capture all console messages for debugging
  111 |     page.on('console', msg => {
  112 |       const logEntry = {
  113 |         type: msg.type(),
  114 |         text: msg.text(),
  115 |         timestamp: new Date().toISOString(),
  116 |         url: page.url()
  117 |       };
  118 |       
  119 |       if (msg.type() === 'error') {
  120 |         consoleErrors.push(logEntry);
  121 |         console.log(`🔴 Browser Error: ${msg.text()}`);
  122 |       } else {
  123 |         consoleLogs.push(logEntry);
  124 |         console.log(`🌐 Browser ${msg.type()}: ${msg.text()}`);
  125 |       }
  126 |     });
  127 |     
  128 |     // Capture page errors
  129 |     page.on('pageerror', exception => {
  130 |       const errorEntry = {
  131 |         type: 'pageerror',
  132 |         text: exception.message,
  133 |         timestamp: new Date().toISOString(),
  134 |         url: page.url()
  135 |       };
  136 |       consoleErrors.push(errorEntry);
  137 |       console.log(`🔴 Page Error: ${exception.message}`);
  138 |     });
  139 |     
  140 |     // =====================================================
  141 |     // PART 1: COMPLETE PLAYWRIGHT WORKFLOW
  142 |     // =====================================================
  143 |     
  144 |     console.log('\n🎭 === PART 1: COMPLETE PLAYWRIGHT WORKFLOW ===');
  145 |     
  146 |     // Variables to track our test
  147 |     let scriptId = null;
  148 |     let scriptName = null;
  149 |     
  150 |     // Step 1: Login with fixed test user (500ms delay - 50% faster than before)
  151 |     console.log(`🔑 Step 1: Login with test user ${testUser.email} (lightning fast 500ms)...`);
  152 |     
  153 |     await page.goto('https://192.168.2.111:8443');
  154 |     await page.fill('input[type="email"]', testUser.email);
  155 |     await page.fill('input[type="password"]', testUser.password);
  156 |     await page.click('button[type="submit"]');
  157 |     
  158 |     // Reduced delay for faster testing
  159 |     await page.waitForTimeout(500);
  160 |     
> 161 |     await expect(page.locator('text=Scripts')).toBeVisible();
      |                                                ^ Error: expect(locator).toBeVisible()
  162 |     console.log('✅ Login successful with test user');
  163 |     
  164 |     // Step 2: Create New Script (500ms delay - 50% faster than before)
  165 |     console.log('📝 Step 2: Create new script (lightning fast 500ms)...');
  166 |     
  167 |     await page.click('text=+');
  168 |     
  169 |     // Reduced delay for faster testing
  170 |     await page.waitForTimeout(500);
  171 |     
  172 |     // Click on "Create New Script" button
  173 |     await page.click('text=Create New Script');
  174 |     
  175 |     scriptName = `MCP-${timestamp}`;
  176 |     
  177 |     await page.fill('input[placeholder="New script name"]', scriptName);
  178 |     await page.click('text=Create');
  179 |     
  180 |     // Wait 300ms for script to appear in list, then click it
  181 |     console.log('⏳ Waiting 300ms for script to appear in list...');
  182 |     await page.waitForTimeout(300);
  183 |     
  184 |     // Step 2b: Click on newly created script after 300ms
  185 |     console.log('🖱️  Clicking on newly created script...');
  186 |     await page.click(`text=${scriptName}`);
  187 |     
  188 |     // Now wait for editor to load
  189 |     console.log('⏳ Waiting for editor to load...');
  190 |     await page.waitForURL(/\/editor\/(.+)$/, { timeout: 10000 });
  191 |     
  192 |     // Capture the script ID from the URL
  193 |     const url = page.url();
  194 |     scriptId = url.split('/').pop();
  195 |     console.log(`📋 Script ID captured: ${scriptId}`);
  196 |     console.log(`📋 Script name: ${scriptName}`);
  197 |     console.log('✅ Script creation successful - editor loaded');
  198 |     
  199 |     // Step 3: Write short speed test content
  200 |     console.log('✏️  Step 3: Writing short speed test...');
  201 |     
  202 |     const quickTestContent = `Speed test ${timestamp} - FAST with user ${testUser.username}!`;
  203 |     
  204 |     // Wait for editor to be ready
  205 |     await expect(page.locator('.ProseMirror')).toBeVisible();
  206 |     
  207 |     // Write quick test content
  208 |     await page.locator('.ProseMirror').click();
  209 |     await page.keyboard.press('Control+A');
  210 |     await page.keyboard.press('Delete');
  211 |     await page.locator('.ProseMirror').fill(quickTestContent);
  212 |     
  213 |     console.log('✅ Quick content written');
  214 |     
  215 |     // Step 4: Wait 1 second 
  216 |     console.log('⏱️  Step 4: Wait 1 second...');
  217 |     await page.waitForTimeout(1000);
  218 |     console.log('✅ 1 second wait completed');
  219 |     
  220 |     // Step 5: Navigate Back (instant)
  221 |     console.log('🔄 Step 5: Navigate back to scripts...');
  222 |     
  223 |     await page.getByRole('main').getByRole('button', { name: 'Scripts' }).click();
  224 |     
  225 |     // Wait for scripts page to load and then check for our script
  226 |     // Fix: Use more specific locator to avoid strict mode violation (there are 2 Scripts buttons)
  227 |     await expect(page.getByRole('main').getByRole('button', { name: 'Scripts' })).toBeVisible();
  228 |     console.log('✅ Navigation back to scripts successful');
  229 |     
  230 |     // Step 6: Logout (instant)
  231 |     console.log('🚪 Step 6: Logout...');
  232 |     
  233 |     // Small wait to ensure page is stable after navigation
  234 |     await page.waitForTimeout(200);
  235 |     
  236 |     // Try banner hamburger menu first (likely location on scripts page)
  237 |     try {
  238 |       await page.getByRole('banner').getByRole('button', { name: '☰' }).click();
  239 |     } catch (error) {
  240 |       // Fallback to main hamburger menu
  241 |       await page.getByRole('main').getByRole('button', { name: '☰' }).click();
  242 |     }
  243 |     
  244 |     await page.getByRole('button', { name: 'Logout' }).click();
  245 |     
  246 |     await expect(page.locator('h2:has-text("Login")')).toBeVisible();
  247 |     console.log('✅ Logout successful');
  248 |     
  249 |     // =====================================================
  250 |     // PART 2: DATABASE VERIFICATION
  251 |     // =====================================================
  252 |     
  253 |     console.log('\n🔍 === PART 2: DATABASE VERIFICATION ===');
  254 |     
  255 |     // Step 7: Check if content is in database
  256 |     console.log('🔍 Step 7: Verifying content in database...');
  257 |     
  258 |     // Query for the script we just created
  259 |     const scriptQuery = `SELECT * FROM scripts WHERE id = $1`;
  260 |     const scriptResult = await executeDatabaseQuery(scriptQuery, [scriptId]);
  261 |     
```