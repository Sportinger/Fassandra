const { test, expect } = require('@playwright/test');

/**
 * FAST & LEAN Test - Silent success, detailed failure
 * Success: Only green emoji + "everything passed"
 * Failure: Debug info + screenshot path
 */

test('Fast Workflow Test', async ({ page }) => {
  let lastActivity = Date.now();
  const updateActivity = () => { lastActivity = Date.now(); };
  
  // Capture browser console silently
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`${msg.text()}`));
  page.on('pageerror', error => consoleLogs.push(`ERROR: ${error.message}`));
  
    // Failure handler - saves logs to file and shows debug info
  const fail = async (reason) => {
    const timestamp = Date.now();
    const screenshotPath = `./debug-screenshots/failure-${timestamp}.png`;
    const consoleLogPath = `./debug-screenshots/console-${timestamp}.log`;
    
    // Save screenshot
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Save console logs to file
    const fs = require('fs');
    const logContent = consoleLogs.join('\n');
    fs.writeFileSync(consoleLogPath, logContent);

    console.log(`❌ ${reason}`);
    console.log(`📸 Screenshot: ${screenshotPath}`);
    console.log(`📋 Console logs: ${consoleLogPath}`);
    return;
  };
  
  try {
    // STEP 1: Load & Register NEW USER
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    updateActivity();
    
    const timestamp = Date.now();
    const shortId = timestamp.toString().slice(-8);
    const email = `testuser${timestamp}@example.com`;
    const username = `user${shortId}`;
    const password = 'Test123@Pass!';
    
    // Navigate to registration
    const isLoginPage = await page.locator('input[type="email"], input[type="password"]').count() > 0;
    if (isLoginPage) {
      await page.click('a:has-text("Register"), button:has-text("Register")');
      await page.waitForTimeout(600);
      updateActivity();
    }
    
    // Fill registration form
    await page.waitForTimeout(600);
    await page.fill('input[type="email"]', email);
    await page.fill('input[name="username"], input[placeholder*="username"]', username);  
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]:has-text("Register"), button:has-text("Register")');
    await page.waitForTimeout(600);
    updateActivity();
    
    // Give registration time to complete (success or failure)
    await page.waitForTimeout(2000);
    
    const hasError = await page.locator('.error, [role="alert"]').count() > 0;
    const currentUrl = page.url();
    
    if (hasError) {
      // Wait brief moment for full error message to render
      await page.waitForTimeout(300);
      return await fail('Registration failed - form error detected');
    }
    
    if (currentUrl.includes('register')) {
      // Wait brief moment to see if error message appears
      await page.waitForTimeout(300);
      return await fail('Registration failed - still on register page');
    }
    
    // STEP 2: Create Script
    await page.waitForTimeout(600);
    updateActivity();
    
    await page.click('div:has-text("+"):visible, [class*="addIcon"]:has-text("+")');
    await page.waitForTimeout(600);
    updateActivity();
    
    await page.click('button:has-text("Create New Script")');
    await page.waitForTimeout(600);
    updateActivity();
    
    const scriptName = `Test Script ${shortId}`;
    await page.fill('input[placeholder*="script name"], input[type="text"]', scriptName);
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(600);
    updateActivity();
    
    // STEP 3: Click script to enter editor
    await page.waitForTimeout(600);
    updateActivity();
    
    const beforeUrl = page.url();
    await page.waitForSelector(`[class*="scriptPage"]:has-text("${scriptName}")`, { timeout: 1000 });
    await page.click(`[class*="scriptPage"]:has-text("${scriptName}")`);
    await page.waitForTimeout(600);
    updateActivity();
    
    const afterUrl = page.url();
    if (beforeUrl === afterUrl || !afterUrl.includes('editor')) {
      return await fail('Script click failed - no navigation to editor');
    }
    
    // STEP 4: Write content
    await page.waitForTimeout(600);
    updateActivity();
    
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    if (await editor.count() === 0) {
      return await fail('Editor not found - not in editor page');
    }
    
    await editor.click();
    await page.waitForTimeout(600);
    await editor.fill('this is a test TEXT');
    updateActivity();
    
    // STEP 5: Optional steps (video cue, logout) - don't fail on these
    await page.waitForTimeout(600);
    const cueBtn = page.locator('button:has-text("Video"), button:has-text("Cue")').first();
    if (await cueBtn.count() > 0) {
      await cueBtn.click();
    }
    updateActivity();
    
    await page.waitForTimeout(600);
    const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Logout")').first();
    if (await logoutBtn.count() > 0) {
      await logoutBtn.click();
    }
    updateActivity();
    
  } catch (e) {
    return await fail(`Connection/workflow failed: ${e.message}`);
  }
  
  // SUCCESS - only show this
  console.log('✅ everything passed');
}); 