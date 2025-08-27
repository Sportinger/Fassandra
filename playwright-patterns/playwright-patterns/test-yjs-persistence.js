const { chromium } = require('playwright');

async function testYjsPersistence() {
  console.log('🧪 Testing YJS Persistence on fassandra.de...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const text = msg.text();
    // Filter for YJS-related logs
    if (text.includes('[YJS_') || text.includes('[WS_') || text.includes('[EDITOR_') || text.includes('[COLLAB_')) {
      console.log(`[CONSOLE] ${msg.type()}: ${text}`);
    }
  });

  try {
    // Navigate to login page
    console.log('1️⃣ Navigating to fassandra.de...');
    await page.goto('https://fassandra.de/login', { waitUntil: 'networkidle' });
    
    // Login with test credentials
    console.log('2️⃣ Logging in...');
    await page.fill('input[name="username"]', 'Diogo');
    await page.fill('input[name="password"]', 'assinado');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to scripts page
    await page.waitForURL('**/scripts', { timeout: 10000 });
    console.log('✅ Logged in successfully\n');
    
    // Find a test script or use the first available script
    console.log('3️⃣ Looking for scripts...');
    await page.waitForSelector('.script-item, [data-testid="script-card"]', { timeout: 10000 });
    
    // Get first script
    const firstScript = await page.locator('.script-item, [data-testid="script-card"]').first();
    const scriptTitle = await firstScript.textContent();
    console.log(`📄 Found script: ${scriptTitle}\n`);
    
    // Open the script
    console.log('4️⃣ Opening script editor...');
    await firstScript.click();
    
    // Wait for editor to load
    await page.waitForSelector('.ProseMirror, [data-testid="editor"]', { timeout: 15000 });
    console.log('✅ Editor loaded\n');
    
    // Wait a bit for YJS to sync
    await page.waitForTimeout(3000);
    
    // Get initial content
    const initialContent = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return editor ? editor.textContent : '';
    });
    console.log(`📝 Initial content length: ${initialContent.length} characters\n`);
    
    // Type some test content
    console.log('5️⃣ Adding test content...');
    const testContent = `\n\nTEST PERSISTENCE ${new Date().toISOString()}: This content should persist after reload.`;
    
    // Click in the editor and type
    await page.click('.ProseMirror');
    await page.keyboard.press('End'); // Go to end of document
    await page.keyboard.type(testContent);
    
    console.log(`✍️ Typed: "${testContent}"\n`);
    
    // Wait for YJS to sync
    console.log('6️⃣ Waiting for YJS sync...');
    await page.waitForTimeout(3000);
    
    // Check browser console for YJS update logs
    const logs = await page.evaluate(() => {
      return window.performance.getEntriesByType('resource')
        .filter(entry => entry.name.includes('/api/collab'))
        .map(entry => ({ url: entry.name, duration: entry.duration }));
    });
    console.log(`🔄 WebSocket connections: ${logs.length}\n`);
    
    // Reload the page
    console.log('7️⃣ Reloading page to test persistence...');
    await page.reload({ waitUntil: 'networkidle' });
    
    // Wait for editor to load again
    await page.waitForSelector('.ProseMirror', { timeout: 15000 });
    await page.waitForTimeout(3000); // Wait for YJS sync
    
    // Get content after reload
    const contentAfterReload = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return editor ? editor.textContent : '';
    });
    
    // Check if test content persisted
    console.log('8️⃣ Verifying persistence...');
    console.log(`📏 Content length after reload: ${contentAfterReload.length} characters`);
    
    if (contentAfterReload.includes(testContent.trim())) {
      console.log('✅ SUCCESS: Content persisted after reload!');
      console.log(`✅ Found test content: "${testContent.trim()}"`);
    } else {
      console.log('❌ FAILURE: Content did NOT persist after reload!');
      console.log(`❌ Expected to find: "${testContent.trim()}"`);
      console.log(`❌ Actual content preview: "${contentAfterReload.substring(0, 200)}..."`);
    }
    
    // Clean up test content
    console.log('\n9️⃣ Cleaning up test content...');
    await page.click('.ProseMirror');
    await page.keyboard.press('Control+A');
    await page.keyboard.type(initialContent);
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    
    // Take screenshot on failure
    await page.screenshot({ path: 'yjs-persistence-error.png' });
    console.log('📸 Screenshot saved as yjs-persistence-error.png');
  } finally {
    await browser.close();
    console.log('\n🏁 Test completed');
  }
}

// Run the test
testYjsPersistence().catch(console.error);