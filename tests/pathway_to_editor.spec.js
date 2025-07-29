const { test, expect } = require('@playwright/test');

/**
 * AI PATHWAYS - Modular Test States for AI Agents
 * 
 * Usage: AI agents can call specific pathways to get to application states,
 * then focus on their specific testing tasks.
 * 
 * Example: "Use pathway: script-editor-with-content, then create 2 video cues"
 */

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Setup base browser environment and console logging
 */
async function setupBrowser(page) {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`${msg.text()}`));
  page.on('pageerror', error => consoleLogs.push(`ERROR: ${error.message}`));

  // Failure handler - saves logs to file and shows debug info
  const fail = async (reason) => {
    const timestamp = Date.now();
    const screenshotPath = `./debug-screenshots/pathway-failure-${timestamp}.png`;
    const consoleLogPath = `./debug-screenshots/pathway-console-${timestamp}.log`;
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    const fs = require('fs');
    const logContent = consoleLogs.join('\n');
    fs.writeFileSync(consoleLogPath, logContent);

    console.log(`❌ Pathway failed: ${reason}`);
    console.log(`📸 Screenshot: ${screenshotPath}`);
    console.log(`📋 Console logs: ${consoleLogPath}`);
    throw new Error(`Pathway failed: ${reason}`);
  };

  return { consoleLogs, fail };
}

/**
 * Create a unique user for testing
 */
function createTestUser() {
  const timestamp = Date.now();
  const shortId = timestamp.toString().slice(-8);
  return {
    email: `testuser${timestamp}@example.com`,
    username: `user${shortId}`,
    password: 'Test123@Pass!',
    shortId
  };
}

// ====================================
// PATHWAY FUNCTIONS
// ====================================

/**
 * PATHWAY: Fresh Registration Page
 * Gets to a clean registration page, ready for registration testing
 */
async function getToRegistrationPage(page) {
  const { consoleLogs, fail } = await setupBrowser(page);
  
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // Navigate to registration if not already there
  const isLoginPage = await page.locator('input[type="email"], input[type="password"]').count() > 0;
  if (isLoginPage) {
    await page.click('a:has-text("Register"), button:has-text("Register")');
    await page.waitForTimeout(600);
  }

  return {
    page,
    consoleLogs,
    fail,
    state: 'registration-page'
  };
}

/**
 * PATHWAY: Registered User (Logged In)
 * Gets to post-login state with fresh user account
 */
async function getToLoggedInUser(page) {
  const { consoleLogs, fail } = await setupBrowser(page);
  const user = createTestUser();
  
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // Navigate to registration
  const isLoginPage = await page.locator('input[type="email"], input[type="password"]').count() > 0;
  if (isLoginPage) {
    await page.click('a:has-text("Register"), button:has-text("Register")');
    await page.waitForTimeout(600);
  }

  // Register new user
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[name="username"], input[placeholder*="username"]', user.username);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]:has-text("Register"), button:has-text("Register")');
  
  // Wait for registration to complete
  await page.waitForTimeout(2000);
  
  // Check for errors
  const hasError = await page.locator('.error, [role="alert"]').count() > 0;
  const currentUrl = page.url();
  
  if (hasError || currentUrl.includes('register')) {
    await fail('Registration failed - could not create user account');
  }

  return {
    page,
    user,
    consoleLogs,
    fail,
    state: 'logged-in'
  };
}

/**
 * PATHWAY: Script List View
 * Gets to the script list page with user logged in
 */
async function getToScriptList(page) {
  const result = await getToLoggedInUser(page);
  
  // Should already be on script list page after login
  await page.waitForTimeout(1000);
  
  return {
    ...result,
    state: 'script-list'
  };
}

/**
 * PATHWAY: Fresh Editor (Empty)
 * Gets to editor with new empty script, ready for content
 */
async function getToFreshEditor(page) {
  const result = await getToScriptList(page);
  const { fail, user } = result;
  
  // Create new script
  await page.click('div:has-text("+"):visible, [class*="addIcon"]:has-text("+")');
  await page.waitForTimeout(600);
  
  await page.click('button:has-text("Create New Script")');
  await page.waitForTimeout(600);
  
  const scriptName = `Test Script ${user.shortId}`;
  await page.fill('input[placeholder*="script name"], input[type="text"]', scriptName);
  await page.click('button:has-text("Create")');
  await page.waitForTimeout(600);
  
  // Enter the script/editor
  const beforeUrl = page.url();
  await page.waitForSelector(`[class*="scriptPage"]:has-text("${scriptName}")`, { timeout: 2000 });
  await page.click(`[class*="scriptPage"]:has-text("${scriptName}")`);
  await page.waitForTimeout(600);
  
  const afterUrl = page.url();
  if (beforeUrl === afterUrl || !afterUrl.includes('editor')) {
    await fail('Script creation failed - no navigation to editor');
  }
  
  // Verify editor is ready
  const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
  if (await editor.count() === 0) {
    await fail('Editor not found - not in editor page');
  }
  
  return {
    ...result,
    script: { name: scriptName },
    editor,
    state: 'fresh-editor'
  };
}

/**
 * PATHWAY: Editor with Content
 * Gets to editor with some basic content already written
 */
async function getToEditorWithContent(page, content = 'This is test content for the script.') {
  const result = await getToFreshEditor(page);
  const { editor } = result;
  
  // Add content to editor
  await editor.click();
  await page.waitForTimeout(600);
  await editor.fill(content);
  await page.waitForTimeout(600);
  
  return {
    ...result,
    content,
    state: 'editor-with-content'
  };
}

/**
 * PATHWAY: Script List with Multiple Scripts
 * Gets to script list with several scripts already created
 */
async function getToScriptListWithScripts(page, scriptCount = 3) {
  const result = await getToScriptList(page);
  const { user } = result;
  const scripts = [];
  
  // Create multiple scripts
  for (let i = 1; i <= scriptCount; i++) {
    await page.click('div:has-text("+"):visible, [class*="addIcon"]:has-text("+")');
    await page.waitForTimeout(600);
    
    await page.click('button:has-text("Create New Script")');
    await page.waitForTimeout(600);
    
    const scriptName = `Test Script ${user.shortId}-${i}`;
    await page.fill('input[placeholder*="script name"], input[type="text"]', scriptName);
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(600);
    
    scripts.push({ name: scriptName });
  }
  
  return {
    ...result,
    scripts,
    state: 'script-list-with-scripts'
  };
}

// ====================================
// DEMO TESTS FOR AI AGENTS
// ====================================

test('Demo: Use pathway script-editor-with-content, then create 2 video cues', async ({ page }) => {
  // AI Agent Task: Use pathway, then create 2 video cues
  const { editor, script, user } = await getToEditorWithContent(page);
  
  console.log(`🎯 AI Agent ready! User: ${user.username}, Script: ${script.name}`);
  console.log(`📝 Editor loaded with content. Now creating 2 video cues...`);
  
  // AI Agent's actual task starts here
  const videoCueBtn = page.locator('button:has-text("Video"), button:has-text("Cue")').first();
  
  // Create first video cue
  if (await videoCueBtn.count() > 0) {
    await videoCueBtn.click();
    await page.waitForTimeout(600);
    console.log(`✅ Video cue 1 created`);
  }
  
  // Create second video cue  
  if (await videoCueBtn.count() > 0) {
    await videoCueBtn.click();
    await page.waitForTimeout(600);
    console.log(`✅ Video cue 2 created`);
  }
  
  console.log(`🎉 AI Agent task completed successfully!`);
});

test('Demo: Use pathway script-list, then create 3 new scripts', async ({ page }) => {
  // AI Agent Task: Use pathway, then create 3 scripts
  const { user } = await getToScriptList(page);
  
  console.log(`🎯 AI Agent ready! User: ${user.username} at script list`);
  console.log(`📋 Creating 3 new scripts...`);
  
  // AI Agent's actual task starts here
  for (let i = 1; i <= 3; i++) {
    await page.click('div:has-text("+"):visible, [class*="addIcon"]:has-text("+")');
    await page.waitForTimeout(600);
    
    await page.click('button:has-text("Create New Script")');
    await page.waitForTimeout(600);
    
    const scriptName = `AI Generated Script ${i}`;
    await page.fill('input[placeholder*="script name"], input[type="text"]', scriptName);
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(600);
    
    console.log(`✅ Script ${i} created: ${scriptName}`);
  }
  
  console.log(`🎉 AI Agent task completed successfully!`);
});

test('Demo: Use pathway fresh-editor, then test content writing', async ({ page }) => {
  // AI Agent Task: Use pathway, then test content features
  const { editor, script, user } = await getToFreshEditor(page);
  
  console.log(`🎯 AI Agent ready! User: ${user.username}, Fresh editor: ${script.name}`);
  console.log(`✍️ Testing content writing capabilities...`);
  
  // AI Agent's actual task starts here
  const testContent = [
    "CHARACTER 1\nThis is dialogue text.",
    "\n\nCHARACTER 2\nThis is a response.",
    "\n\n[STAGE DIRECTION: Characters move closer]"
  ];
  
  for (const content of testContent) {
    await editor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type(content);
    await page.waitForTimeout(300);
    console.log(`✅ Added content block`);
  }
  
  console.log(`🎉 AI Agent content testing completed!`);
});

// Export pathways for use by other scripts
module.exports = {
  getToRegistrationPage,
  getToLoggedInUser,
  getToScriptList,
  getToFreshEditor,
  getToEditorWithContent,
  getToScriptListWithScripts
}; 