const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🧪 Testing YJS Content Persistence...\n');

    // 1. Navigate to the application
    console.log('1️⃣ Navigating to the application...');
    await page.goto('https://192.168.2.141:8080', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // 2. Handle SSL certificate warning (self-signed cert in dev)
    if (page.url().includes('privacy-error')) {
      console.log('   Bypassing SSL warning...');
      await page.click('text=Advanced');
      await page.click('text=Proceed');
    }

    // 3. Wait for the page to fully load
    await page.waitForTimeout(3000);

    // 4. Check if we need to login
    if (await page.isVisible('input[type="email"]') || await page.isVisible('input[name="email"]')) {
      console.log('2️⃣ Logging in...');
      await page.fill('input[type="email"], input[name="email"]', 'dev@example.com');
      await page.fill('input[type="password"], input[name="password"]', 'dev_password_123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    }

    // 5. Navigate to editor or create new script
    console.log('3️⃣ Opening editor...');
    
    // Try to find a create/new script button
    const newScriptButton = await page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add"), button:has-text("+")').first();
    if (await newScriptButton.isVisible()) {
      await newScriptButton.click();
      await page.waitForTimeout(2000);
    }

    // 6. Wait for editor to be ready
    console.log('4️⃣ Waiting for editor to initialize...');
    await page.waitForTimeout(3000);

    // 7. Find the editor - try multiple selectors
    const editorSelectors = [
      '[contenteditable="true"]',
      '.ProseMirror',
      '.editor',
      '[data-editor]',
      'div[role="textbox"]',
      '.tiptap',
      '.quill-editor'
    ];

    let editor = null;
    for (const selector of editorSelectors) {
      const el = await page.locator(selector).first();
      if (await el.isVisible()) {
        editor = el;
        console.log(`   Found editor with selector: ${selector}`);
        break;
      }
    }

    if (!editor) {
      throw new Error('Could not find editor element');
    }

    // 8. Clear existing content and type test content
    console.log('5️⃣ Typing test content...');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    
    const testContent = `TEST PERSISTENCE ${new Date().toISOString()}\nThis content should persist after reload.`;
    await editor.type(testContent);
    
    // 9. Wait for autosave
    console.log('6️⃣ Waiting for autosave (5 seconds)...');
    await page.waitForTimeout(5000);

    // 10. Get the current URL to reload the same page
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);

    // 11. Reload the page
    console.log('7️⃣ Reloading page...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 12. Find the editor again after reload
    console.log('8️⃣ Checking content after reload...');
    editor = null;
    for (const selector of editorSelectors) {
      const el = await page.locator(selector).first();
      if (await el.isVisible()) {
        editor = el;
        break;
      }
    }

    if (!editor) {
      throw new Error('Could not find editor element after reload');
    }

    // 13. Get the content after reload
    const contentAfterReload = await editor.textContent();
    console.log(`   Content after reload: "${contentAfterReload}"`);

    // 14. Check if content persisted
    if (contentAfterReload.includes('TEST PERSISTENCE') && contentAfterReload.includes('This content should persist')) {
      console.log('\n✅ SUCCESS: Content persisted correctly after reload!');
      console.log('   The YJS persistence fix is working properly.');
    } else {
      console.log('\n❌ FAILED: Content was NOT persisted after reload.');
      console.log('   Expected to find the test content but got:', contentAfterReload);
    }

    // 15. Take screenshot for evidence
    await page.screenshot({ path: 'persistence-test-result.png' });
    console.log('\n📸 Screenshot saved as persistence-test-result.png');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    await page.screenshot({ path: 'persistence-test-error.png' });
  } finally {
    await browser.close();
  }
})();