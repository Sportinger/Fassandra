const { test, expect } = require('@playwright/test');

/**
 * AI FRESH EDITOR PATHWAY
 * 
 * Simple pathway: Gets AI to fresh editor and stays open for manual interaction
 * 
 * Usage: AI runs this, gets fresh editor, then manually interacts
 */

test('AI Fresh Editor Pathway', async ({ page }) => {
  console.log(`🚀 Starting AI Fresh Editor Pathway...`);
  
  // ====================================
  // SETUP: GET TO FRESH EDITOR
  // ====================================
  
  // Create unique user
  const timestamp = Date.now();
  const shortId = timestamp.toString().slice(-8);
  const user = {
    email: `testuser${timestamp}@example.com`,
    username: `user${shortId}`,
    password: 'Test123@Pass!'
  };
  
  console.log(`👤 Creating user: ${user.username}`);
  
  // Navigate and register
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  
  const isLoginPage = await page.locator('input[type="email"], input[type="password"]').count() > 0;
  if (isLoginPage) {
    await page.click('a:has-text("Register"), button:has-text("Register")');
    await page.waitForTimeout(600);
  }
  
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[name="username"], input[placeholder*="username"]', user.username);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]:has-text("Register"), button:has-text("Register")');
  await page.waitForTimeout(2000);
  
  console.log(`✅ User registered and logged in`);
  
  // Create new script
  await page.click('div:has-text("+"):visible, [class*="addIcon"]:has-text("+")');
  await page.waitForTimeout(600);
  
  await page.click('button:has-text("Create New Script")');
  await page.waitForTimeout(600);
  
  const scriptName = `AI Script ${shortId}`;
  await page.fill('input[placeholder*="script name"], input[type="text"]', scriptName);
  await page.click('button:has-text("Create")');
  await page.waitForTimeout(600);
  
  console.log(`📄 Script created: ${scriptName}`);
  
  // Enter editor
  await page.waitForSelector(`[class*="scriptPage"]:has-text("${scriptName}")`, { timeout: 2000 });
  await page.click(`[class*="scriptPage"]:has-text("${scriptName}")`);
  await page.waitForTimeout(600);
  
  // Verify editor is ready
  const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
  if (await editor.count() === 0) {
    throw new Error('Editor not found');
  }
  
  console.log(`✏️ Fresh editor ready!`);
  
  // ====================================
  // AI CONTROL ZONE
  // ====================================
  
  console.log(`\n🎯 AI CONTROL READY!`);
  console.log(`👤 User: ${user.username}`);
  console.log(`📄 Script: ${scriptName}`);
  console.log(`✏️ Fresh Editor: Ready for content`);
  console.log(`\n🎮 AI can now manually interact with the browser`);
  console.log(`🔧 Click, type, test anything you want!`);
  console.log(`🛑 Press Ctrl+C when finished\n`);
  
  // Keep browser open for AI manual interaction
  await page.waitForTimeout(999999000); // ~16 minutes
}); 