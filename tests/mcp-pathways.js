/**
 * MCP PATHWAY FUNCTIONS
 * 
 * Fast pathways for AI to get to specific app states via MCP Playwright server
 * 
 * Usage with MCP:
 * 1. AI uses MCP to navigate to the app
 * 2. AI calls these pathway functions to quickly get to desired state
 * 3. AI continues with manual MCP commands
 */

// ====================================
// PATHWAY: Get to Fresh Editor
// ====================================
async function getToFreshEditor(page) {
  console.log(`🚀 MCP Pathway: Getting to fresh editor...`);
  
  // Create unique user
  const timestamp = Date.now();
  const shortId = timestamp.toString().slice(-8);
  const user = {
    email: `testuser${timestamp}@example.com`,
    username: `user${shortId}`,
    password: 'Test123@Pass!'
  };
  
  // Navigate to app
  await page.goto('https://192.168.2.111:8080', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  
  // Check if on login/register page
  const isAuthPage = await page.locator('input[type="email"], input[type="password"]').count() > 0;
  
  if (isAuthPage) {
    // Navigate to registration
    const registerLink = await page.locator('a:has-text("Register"), button:has-text("Register")').count() > 0;
    if (registerLink) {
      await page.click('a:has-text("Register"), button:has-text("Register")');
      await page.waitForTimeout(600);
    }
    
    // Fill registration form
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[name="username"], input[placeholder*="username"]', user.username);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]:has-text("Register"), button:has-text("Register")');
    await page.waitForTimeout(2000);
  }
  
  // Create new script
  await page.click('div:has-text("+"):visible, [class*="addIcon"]:has-text("+")');
  await page.waitForTimeout(600);
  
  await page.click('button:has-text("Create New Script")');
  await page.waitForTimeout(600);
  
  const scriptName = `AI Script ${shortId}`;
  await page.fill('input[placeholder*="script name"], input[type="text"]', scriptName);
  await page.click('button:has-text("Create")');
  await page.waitForTimeout(600);
  
  // Enter editor
  await page.waitForSelector(`[class*="scriptPage"]:has-text("${scriptName}")`, { timeout: 2000 });
  await page.click(`[class*="scriptPage"]:has-text("${scriptName}")`);
  await page.waitForTimeout(600);
  
  // Verify editor is ready
  const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
  const editorExists = await editor.count() > 0;
  
  if (!editorExists) {
    throw new Error('Editor not found - pathway failed');
  }
  
  console.log(`✅ MCP Pathway Complete!`);
  console.log(`👤 User: ${user.username}`);
  console.log(`📄 Script: ${scriptName}`);
  console.log(`✏️ Fresh editor ready for AI interaction`);
  
  return {
    user,
    scriptName,
    editor,
    success: true
  };
}

// ====================================
// PATHWAY: Get to Editor with Content
// ====================================
async function getToEditorWithContent(page, content = 'This is test content for the AI.') {
  // First get to fresh editor
  const result = await getToFreshEditor(page);
  
  // Add content
  await result.editor.click();
  await page.waitForTimeout(300);
  await result.editor.fill(content);
  await page.waitForTimeout(300);
  
  console.log(`📝 Added content: "${content}"`);
  
  return {
    ...result,
    content
  };
}

// ====================================
// PATHWAY: Get to Script List
// ====================================
async function getToScriptList(page) {
  console.log(`🚀 MCP Pathway: Getting to script list...`);
  
  // Create unique user
  const timestamp = Date.now();
  const shortId = timestamp.toString().slice(-8);
  const user = {
    email: `testuser${timestamp}@example.com`,
    username: `user${shortId}`,
    password: 'Test123@Pass!'
  };
  
  // Navigate and register
  await page.goto('https://192.168.2.111:8080', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  
  const isAuthPage = await page.locator('input[type="email"], input[type="password"]').count() > 0;
  
  if (isAuthPage) {
    const registerLink = await page.locator('a:has-text("Register"), button:has-text("Register")').count() > 0;
    if (registerLink) {
      await page.click('a:has-text("Register"), button:has-text("Register")');
      await page.waitForTimeout(600);
    }
    
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[name="username"], input[placeholder*="username"]', user.username);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]:has-text("Register"), button:has-text("Register")');
    await page.waitForTimeout(2000);
  }
  
  console.log(`✅ MCP Pathway Complete!`);
  console.log(`👤 User: ${user.username}`);
  console.log(`📋 At script list - ready for script management`);
  
  return {
    user,
    success: true
  };
}

// ====================================
// MCP HELPER: Execute Pathway
// ====================================
async function executePathway(page, pathwayName, options = {}) {
  console.log(`🎯 Executing MCP Pathway: ${pathwayName}`);
  
  try {
    switch(pathwayName) {
      case 'fresh-editor':
        return await getToFreshEditor(page);
        
      case 'editor-with-content':
        return await getToEditorWithContent(page, options.content);
        
      case 'script-list':
        return await getToScriptList(page);
        
      default:
        throw new Error(`Unknown pathway: ${pathwayName}`);
    }
  } catch (error) {
    console.error(`❌ Pathway failed: ${error.message}`);
    throw error;
  }
}

// Export for use in MCP context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getToFreshEditor,
    getToEditorWithContent,
    getToScriptList,
    executePathway
  };
} 