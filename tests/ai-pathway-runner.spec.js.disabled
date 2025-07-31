const { test, expect } = require('@playwright/test');

/**
 * AI PATHWAY RUNNER - Setup Service for AI Agents
 * 
 * Usage: AI calls a pathway function to get to application state,
 * then gets full control of the page to navigate manually.
 * 
 * Example: 
 * 1. "Get me to editor with content"
 * 2. → AI gets page control at editor state
 * 3. → AI manually navigates/tests whatever it wants
 */

// Import pathway functions
const {
  getToRegistrationPage,
  getToLoggedInUser,
  getToScriptList,
  getToFreshEditor,
  getToEditorWithContent,
  getToScriptListWithScripts
} = require('./ai-pathways.spec.js');

// ====================================
// AI PATHWAY RUNNER TESTS
// ====================================

/**
 * Template for AI agents to get to specific states
 * AI can modify the test body to do whatever they want
 */

test('AI Control: Get to Editor with Content', async ({ page }) => {
  // PATHWAY: Setup complete - AI gets control here
  const { editor, script, user, consoleLogs, fail } = await getToEditorWithContent(page);
  
  console.log(`🎯 AI Control Ready!`);
  console.log(`👤 User: ${user.username}`);
  console.log(`📄 Script: ${script.name}`);
  console.log(`✏️ Editor: Ready for interaction`);
  console.log(`🎮 AI has full page control now...`);
  
  // ===================================
  // AI MANUAL CONTROL ZONE
  // ===================================
  
  console.log(`⏸️  Browser staying open for AI manual control...`);
  console.log(`🔧 AI can now manually interact with the editor`);
  console.log(`📝 Current content: "${result.content}"`);
  console.log(`🛑 Press Ctrl+C to stop when finished`);
  
  // Keep browser open indefinitely for AI manual interaction
  // AI can now manually click, type, test whatever they want
  await page.waitForTimeout(999999000); // ~16 minutes - AI stops manually
});

test('AI Control: Get to Fresh Editor', async ({ page }) => {
  // PATHWAY: Setup complete - AI gets control here
  const { editor, script, user } = await getToFreshEditor(page);
  
  console.log(`🎯 AI Control Ready!`);
  console.log(`👤 User: ${user.username}`);
  console.log(`📄 Empty Script: ${script.name}`);
  console.log(`✏️ Fresh Editor: Ready for content creation`);
  console.log(`🎮 AI has full page control now...`);
  
  // ===================================
  // AI MANUAL CONTROL ZONE
  // ===================================
  
  console.log(`⏸️  Browser staying open for AI manual control...`);
  console.log(`🔧 AI can now manually interact with the editor`);
  console.log(`🛑 Press Ctrl+C to stop when finished`);
  
  // Keep browser open indefinitely for AI manual interaction
  // AI can now manually click, type, test whatever they want
  await page.waitForTimeout(999999000); // ~16 minutes - AI stops manually
});

test('AI Control: Get to Script List', async ({ page }) => {
  // PATHWAY: Setup complete - AI gets control here
  const { user } = await getToScriptList(page);
  
  console.log(`🎯 AI Control Ready!`);
  console.log(`👤 User: ${user.username}`);
  console.log(`📋 Script List: Ready for script management`);
  console.log(`🎮 AI has full page control now...`);
  
  // ===================================
  // AI MANUAL CONTROL ZONE
  // ===================================
  
  // AI can test script creation, deletion, sharing, etc.
  
  // Example: AI testing rapid script creation
  for (let i = 1; i <= 2; i++) {
    await page.click('div:has-text("+"):visible, [class*="addIcon"]:has-text("+")');
    await page.waitForTimeout(600);
    
    await page.click('button:has-text("Create New Script")');
    await page.waitForTimeout(600);
    
    await page.fill('input[placeholder*="script name"], input[type="text"]', `AI Test ${i}`);
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(600);
    
    console.log(`✅ AI created script: AI Test ${i}`);
  }
  
  // AI can continue with script management testing...
  
  console.log(`🎉 AI finished script list session`);
});

test('AI Control: Get to Registration Page', async ({ page }) => {
  // PATHWAY: Setup complete - AI gets control here
  const { consoleLogs, fail } = await getToRegistrationPage(page);
  
  console.log(`🎯 AI Control Ready!`);
  console.log(`📝 Registration Page: Ready for auth testing`);
  console.log(`🎮 AI has full page control now...`);
  
  // ===================================
  // AI MANUAL CONTROL ZONE
  // ===================================
  
  // AI can test registration validation, different inputs, etc.
  
  // Example: AI testing password validation
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[name="username"], input[placeholder*="username"]', 'testuser');
  
  // Test weak password
  await page.fill('input[type="password"]', 'weak');
  await page.click('button[type="submit"]:has-text("Register"), button:has-text("Register")');
  await page.waitForTimeout(1000);
  
  const hasError = await page.locator('.error, [role="alert"]').count() > 0;
  if (hasError) {
    console.log(`✅ AI confirmed password validation works`);
  }
  
  // AI can continue with auth testing...
  
  console.log(`🎉 AI finished registration testing session`);
});

// ====================================
// PATHWAY INTERFACE FOR EXTERNAL AI
// ====================================

/**
 * Simple interface for AI agents to request pathways
 * AI can call this with pathway name and get ready-to-use page state
 */
test('AI Interface: Dynamic Pathway', async ({ page }) => {
  // AI specifies which pathway they want
  const PATHWAY_REQUEST = 'editor-with-content'; // AI sets this
  
  let result;
  switch(PATHWAY_REQUEST) {
    case 'registration':
      result = await getToRegistrationPage(page);
      break;
    case 'logged-in':
      result = await getToLoggedInUser(page);
      break;
    case 'script-list':
      result = await getToScriptList(page);
      break;
    case 'fresh-editor':
      result = await getToFreshEditor(page);
      break;
    case 'editor-with-content':
      result = await getToEditorWithContent(page);
      break;
    case 'script-list-with-scripts':
      result = await getToScriptListWithScripts(page);
      break;
    default:
      throw new Error(`Unknown pathway: ${PATHWAY_REQUEST}`);
  }
  
  console.log(`🎯 Pathway '${PATHWAY_REQUEST}' ready!`);
  console.log(`🎮 AI has full control of:`, Object.keys(result));
  
  // ===================================
  // AI MANUAL CONTROL ZONE
  // ===================================
  // AI replaces this entire section with their custom testing
  
  await page.waitForTimeout(2000); // AI removes this and adds their actions
  
  console.log(`🎉 AI session completed`);
}); 