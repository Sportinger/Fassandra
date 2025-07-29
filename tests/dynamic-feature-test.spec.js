const { test, expect } = require('@playwright/test');

/**
 * Dynamic Feature Testing Script
 * This script can be modified on the fly during our testing session
 * with custom timings and steps based on your instructions
 */

test.describe('Dynamic Feature Testing', () => {
  
  test('Live Feature Test Session', async ({ page }) => {
    // Enable detailed logging and capture console
    const consoleMessages = [];
    page.on('console', msg => {
      const message = `Browser: ${msg.text()}`;
      console.log(message);
      consoleMessages.push(message);
    });
    page.on('pageerror', error => {
      const message = `Page Error: ${error.message}`;
      console.log(message);
      consoleMessages.push(message);
    });
    
    // Activity tracker for auto-finish
    let lastActivityTime = Date.now();
    const updateActivity = () => { lastActivityTime = Date.now(); };
    
    // Helper function to check for inactivity
    const checkInactivity = async () => {
      if (Date.now() - lastActivityTime > 1500) {
        console.log('⏰ No activity for 1.5s - finishing test...');
        
        // Take final screenshot
        await page.screenshot({ 
          path: './debug-screenshots/playwright-tests/final-idle-state.png',
          fullPage: true 
        });
        
        // Log all console messages
        console.log('\n📋 Browser Console Log:');
        consoleMessages.forEach(msg => console.log(msg));
        
        console.log('🏁 Test finished due to inactivity');
        return true;
      }
      return false;
    };
    
    // STEP 1: Navigate to the application
    console.log('🚀 Starting fast dynamic feature test...');
    await page.goto('/', { waitUntil: 'networkidle' });
    updateActivity();
    
    // Fast wait for visual confirmation
    await page.waitForTimeout(600);
    
    // STEP 2: Take initial screenshot
    await page.screenshot({ 
      path: './debug-screenshots/playwright-tests/01-initial-load.png',
      fullPage: true 
    });
    
    // STEP 3: Register a new user
    console.log('👤 Registering new user...');
    
    // Generate unique user credentials with robust password
    const timestamp = Date.now();
    const shortId = timestamp.toString().slice(-8); // Last 8 digits for uniqueness
    const testEmail = `testuser${timestamp}@example.com`;
    const testUsername = `user${shortId}`; // Max 20 chars: user + 8 digits = 12 chars
    const testPassword = 'Test123@Pass!'; // Upper, lower, numbers, special chars (@!)
    
    // Check if we're on login page, navigate to register
    const isLoginPage = await page.locator('input[type="email"], input[type="password"]').count() > 0;
    
    if (isLoginPage) {
      // Look for register link/button
      const registerLink = page.locator('a:has-text("Register"), button:has-text("Register"), a:has-text("Sign up"), button:has-text("Sign up")');
      if (await registerLink.count() > 0) {
        console.log('🔗 Clicking register link...');
        await registerLink.first().click();
        await page.waitForTimeout(600);
        updateActivity();
      }
    }
    
    // Wait for register page to load
    await page.waitForTimeout(600);
    updateActivity();
    
    // Fill registration form with better error handling
    console.log(`📧 Entering email: ${testEmail}`);
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.count() > 0) {
      await emailInput.clear();
      await emailInput.fill(testEmail);
      await page.waitForTimeout(600);
      updateActivity();
    }
    
    // Fill username field
    console.log(`👤 Entering username: ${testUsername}`);
    const usernameInput = page.locator('input[name="username"], input[placeholder*="username"]').first();
    if (await usernameInput.count() > 0) {
      await usernameInput.clear();
      await usernameInput.fill(testUsername);
      await page.waitForTimeout(600);
      updateActivity();
    }
    
    console.log('🔑 Entering password...');
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    if (await passwordInput.count() > 0) {
      await passwordInput.clear();
      await passwordInput.fill(testPassword);
      await page.waitForTimeout(600);
      updateActivity();
    }
    
    // Take screenshot before submitting
    await page.screenshot({ 
      path: './debug-screenshots/playwright-tests/02-before-register.png',
      fullPage: true 
    });
    
    // Click register button
    console.log('📝 Clicking register button...');
    const registerButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign up"), button:has-text("Create")').first();
    if (await registerButton.count() > 0) {
      await registerButton.click();
      await page.waitForTimeout(600);
      updateActivity();
    }
    
    // Wait for registration response and check for success/error
    await page.waitForTimeout(600);
    updateActivity();
    
    // Check for API errors in console messages (faster detection)
    const hasApiError = consoleMessages.some(msg => msg.includes('400 Bad Request') || msg.includes('401') || msg.includes('403'));
    
    // Also check for visible error messages on page
    const errorMessages = page.locator('.error, .alert-danger, [role="alert"], .text-red-500');
    const errorCount = await errorMessages.count();
    
    if (hasApiError || errorCount > 0) {
      console.log('❌ Registration failed - stopping test immediately');
      console.log(`📧 Failed user: ${testEmail}`);
      console.log(`🔑 Password used: ${testPassword}`);
      
      await page.screenshot({ 
        path: './debug-screenshots/playwright-tests/registration-failed.png',
        fullPage: true 
      });
      
      // Log console messages immediately
      console.log('\n📋 Error Console Log:');
      consoleMessages.forEach(msg => console.log(msg));
      
      console.log('🏁 Test stopped due to registration failure');
      return; // Exit immediately - don't continue to script creation
    }
    
    // Registration appears successful
    console.log(`✅ User registration successful: ${testEmail}`);
    
    // Wait for potential navigation after successful registration
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    updateActivity();
    
         // STEP 4: Take post-registration screenshot
     await page.screenshot({ 
       path: './debug-screenshots/playwright-tests/03-after-registration.png',
       fullPage: true 
     });
    
    // STEP 5: Create a new script via the correct UI flow
    console.log('📝 Creating new script...');
    
    // Wait for scripts page to load
    await page.waitForTimeout(600);
    updateActivity();
    
    // Step 1: Click the "+" add icon (CSS modules-safe selector)
    console.log('➕ Looking for add script "+" icon...');
    const addIcon = page.locator('div:has-text("+"):visible, [class*="addIcon"]:has-text("+"), [class*="addSlot"]:has-text("+")').first();
    if (await addIcon.count() > 0) {
      console.log('➕ Found "+" icon, clicking...');
      await addIcon.click();
      await page.waitForTimeout(600);
      updateActivity();
      
      // Step 2: Click "Create New Script" option
      console.log('📄 Looking for "Create New Script" option...');
      const createOption = page.locator('button:has-text("Create New Script")').first();
      if (await createOption.count() > 0) {
        console.log('📄 Found "Create New Script", clicking...');
        await createOption.click();
        await page.waitForTimeout(600);
        updateActivity();
        
        // Step 3: Fill script name in the input form
        console.log('✏️ Looking for script name input...');
        const scriptNameInput = page.locator('input[placeholder*="script name"], input[placeholder*="New script"], [class*="createForm"] input[type="text"], form input[type="text"]').first();
        if (await scriptNameInput.count() > 0) {
          const scriptName = `Test Script ${shortId}`;
          console.log(`✏️ Entering script name: ${scriptName}`);
          await scriptNameInput.fill(scriptName);
          await page.waitForTimeout(600);
          updateActivity();
          
          // Step 4: Click "Create" button to submit
          console.log('✅ Looking for Create button...');
          const createButton = page.locator('button[type="submit"]:has-text("Create"), [class*="createForm"] button:has-text("Create"), form button:has-text("Create")').first();
          if (await createButton.count() > 0) {
            console.log('✅ Found Create button, clicking...');
            await createButton.click();
            await page.waitForTimeout(600);
            updateActivity();
            console.log(`✅ Script creation attempted: ${scriptName}`);
            
            // Wait for script to be created and page to update
            await page.waitForTimeout(600);
            updateActivity();
            
            // STEP 5.5: Click on the newly created script to enter editor
            console.log('🖱️ Looking for the newly created script to click...');
            
            // Debug: Show what's actually on the page
            const allText = await page.locator('body').textContent();
            console.log(`📊 Page contains "${scriptName}": ${allText?.includes(scriptName) ? 'YES' : 'NO'}`);
            
            // Get current URL before click attempt
            const beforeUrl = page.url();
            console.log(`🌐 Current URL: ${beforeUrl}`);
            
            // Try multiple selectors for the script
            const scriptSelectors = [
              `[class*="scriptPage"]:has-text("${scriptName}")`,
              `div:has-text("${scriptName}")`,
              `*:has-text("${scriptName}")`,
              `text="${scriptName}"`,
              `.script:has-text("${scriptName}")`,
              `[title*="${scriptName}"]`
            ];
            
            let scriptFound = false;
            for (const selector of scriptSelectors) {
              const scriptElement = page.locator(selector).first();
              if (await scriptElement.count() > 0) {
                console.log(`📝 Found script with selector "${selector}", attempting click...`);
                
                await scriptElement.click();
                await page.waitForTimeout(600);
                updateActivity();
                
                // Check if URL changed (indicating navigation)
                const afterUrl = page.url();
                console.log(`🌐 URL after click: ${afterUrl}`);
                
                if (beforeUrl !== afterUrl) {
                  console.log('✅ URL changed - navigation to editor successful!');
                  await page.waitForLoadState('networkidle');
                  await page.waitForTimeout(600);
                  updateActivity();
                  scriptFound = true;
                } else {
                  console.log('❌ URL unchanged - click did NOT work, trying next selector...');
                  continue;
                }
                break;
              }
            }
            
            if (!scriptFound) {
              console.log('❌ Script click completely failed - no navigation occurred');
              console.log('🔍 Debugging: Looking for any clickable script elements...');
              
              const clickableElements = await page.locator('div, button, a').allTextContents();
              const scriptElements = clickableElements.filter(text => text && text.includes('Script'));
              console.log('📋 Elements containing "Script":', scriptElements.slice(0, 5));
              
              if (await checkInactivity()) return;
            }
          } else {
            console.log('⚠️ Create button not found');
            if (await checkInactivity()) return;
          }
        } else {
          console.log('⚠️ Script name input not found');
          if (await checkInactivity()) return;
        }
      } else {
        console.log('⚠️ "Create New Script" option not found');
        if (await checkInactivity()) return;
      }
    } else {
      console.log('⚠️ Add script "+" icon not found - checking page state...');
      // Debug: Log what elements are visible
      const visibleElements = await page.locator('body *:visible').count();
      console.log(`📊 Visible elements on page: ${visibleElements}`);
      
      if (await checkInactivity()) return;
    }
    
    await page.screenshot({ 
      path: './debug-screenshots/playwright-tests/04-editor-loaded.png',
      fullPage: true 
    });
    
    console.log('✅ Script editor workflow completed');
    
    // STEP 6: Write content into the script editor (only if we're actually in editor)
    console.log('✍️ Checking if we are in the script editor...');
    
    // Verify we're actually in the editor by checking URL or page indicators
    const currentUrl = page.url();
    const isInEditor = currentUrl.includes('editor') || currentUrl.includes('script') || currentUrl.includes('edit');
    console.log(`🌐 Current URL: ${currentUrl}`);
    console.log(`📝 In editor: ${isInEditor ? 'YES' : 'NO'}`);
    
    if (!isInEditor) {
      console.log('❌ Not in editor - skipping content writing');
      if (await checkInactivity()) return;
    }
    
    console.log('✍️ Writing content into script editor...');
    
    // Wait for editor to fully load
    await page.waitForTimeout(600);
    updateActivity();
    
    // Look for editor area - enhanced selectors for the script editor
    const editorSelectors = [
      '.ProseMirror',
      '[contenteditable="true"]',
      '[class*="editor"] [contenteditable="true"]',
      '[class*="prosemirror"]',
      '.editor-content',
      '.tiptap',
      'div[role="textbox"]',
      '[data-testid*="editor"]',
      '.ql-editor',
      'textarea'
    ];
    
    let editorFound = false;
    for (const selector of editorSelectors) {
      const editor = page.locator(selector).first();
      if (await editor.count() > 0) {
        console.log(`📝 Found editor with selector: ${selector}`);
        await editor.click();
        await page.waitForTimeout(600);
        updateActivity();
        
        // Clear any existing content and add our test content
        await editor.fill('');
        await page.waitForTimeout(600);
        
        const testContent = 'FADE IN:\n\nINT. THEATER - DAY\n\nA beautiful theater with red velvet seats. The stage is empty, waiting for the magic to begin.\n\nJOHN enters from stage left, looking around in wonder.\n\nJOHN\nThis is where dreams come alive!\n\n(Video cue will be added next)\n\n';
        
        // Type content gradually to simulate real typing
        await page.type(selector, testContent);
        await page.waitForTimeout(600);
        updateActivity();
        
        console.log('✅ Content written to editor successfully');
        editorFound = true;
        break;
      }
    }
    
    if (!editorFound) {
      console.log('⚠️ Editor not found, trying to type directly into page...');
      await page.keyboard.type('FADE IN:\n\nINT. THEATER - DAY\n\nA beautiful theater with red velvet seats.\n\nJOHN\nThis is amazing!\n\n');
      await page.waitForTimeout(600);
      updateActivity();
      console.log('⚠️ Typed directly - editor may not be available');
    }
    
    await page.screenshot({ 
      path: './debug-screenshots/playwright-tests/05-content-written.png',
      fullPage: true 
    });
    
    console.log('✅ Content written to script');
    
    // STEP 7: Create a video cue in the editor
    console.log('🎬 Creating video cue in editor...');
    
    await page.waitForTimeout(600);
    updateActivity();
    
    // Look for cue/video insertion options in the editor toolbar
    const cueButtons = [
      'button:has-text("Video")',
      'button:has-text("Cue")',
      'button:has-text("Insert")',
      '[class*="toolbar"] button[title*="video"]',
      '[class*="toolbar"] button[title*="cue"]',
      '[class*="toolbar"] button:has-text("Video")',
      '[class*="toolbar"] button:has-text("Cue")',
      '[data-testid*="video"]',
      '[data-testid*="cue"]',
      'button[aria-label*="video"]',
      'button[aria-label*="cue"]'
    ];
    
    let cueFound = false;
    for (const selector of cueButtons) {
      const btn = page.locator(selector);
      if (await btn.count() > 0) {
        console.log(`🎬 Found video/cue button: ${selector}`);
        await btn.first().click();
        await page.waitForTimeout(600);
        updateActivity();
        cueFound = true;
        break;
      }
    }
    
    if (!cueFound) {
      // Try looking for any toolbar and click buttons there
      console.log('🎬 Looking for toolbar buttons...');
      const toolbarButtons = page.locator('[class*="toolbar"] button, [class*="menu"] button').all();
      const toolbarCount = await page.locator('[class*="toolbar"] button, [class*="menu"] button').count();
      console.log(`🔍 Found ${toolbarCount} toolbar buttons`);
      
      if (toolbarCount > 0) {
        // Try clicking the first few toolbar buttons to see if any open cue options
        for (let i = 0; i < Math.min(3, toolbarCount); i++) {
          const btn = page.locator('[class*="toolbar"] button, [class*="menu"] button').nth(i);
          const btnText = await btn.textContent();
          console.log(`🔍 Checking toolbar button ${i}: "${btnText}"`);
          
          if (btnText && (btnText.toLowerCase().includes('video') || btnText.toLowerCase().includes('cue') || btnText.toLowerCase().includes('insert'))) {
            console.log(`🎬 Found potential cue button: "${btnText}"`);
            await btn.click();
            await page.waitForTimeout(600);
            updateActivity();
            cueFound = true;
            break;
          }
        }
      }
    }
    
    if (!cueFound) {
      // Try keyboard shortcuts
      console.log('🎬 Trying keyboard shortcuts for video cue...');
      await page.keyboard.press('Control+Shift+V'); // Common shortcut
      await page.waitForTimeout(600);
      updateActivity();
    }
    
    // Check for inactivity before trying video input
    if (await checkInactivity()) return;
    
    // If video cue dialog appears, fill it
    const videoInput = page.locator('input[type="url"], input[placeholder*="video"], input[placeholder*="url"], input[placeholder*="URL"]');
    if (await videoInput.count() > 0) {
      console.log('🎬 Found video input field, entering URL...');
      await videoInput.fill('https://example.com/test-video.mp4');
      await page.waitForTimeout(600);
      updateActivity();
      
      // Confirm video cue creation
      const confirmButtons = page.locator('button:has-text("Add"), button:has-text("Insert"), button:has-text("OK"), button:has-text("Save")');
      if (await confirmButtons.count() > 0) {
        console.log('🎬 Confirming video cue creation...');
        await confirmButtons.first().click();
        await page.waitForTimeout(600);
        updateActivity();
        console.log('✅ Video cue added successfully');
      }
    }
    
    await page.screenshot({ 
      path: './debug-screenshots/playwright-tests/07-video-cue-added.png',
      fullPage: true 
    });
    
    console.log('✅ Video cue creation attempted');
    
    // STEP 8: Logout
    console.log('🚪 Logging out...');
    await page.waitForTimeout(600);
    updateActivity();
    
    // Look for logout/user menu options
    const logoutOptions = [
      'button:has-text("Logout")',
      'button:has-text("Log out")',
      'a:has-text("Logout")',
      'a:has-text("Log out")',
      '[class*="user"] button', // User menu button
      '[class*="menu"] button:has([class*="user"])', // User in menu
      'button[title*="logout"]',
      'button[title*="user"]'
    ];
    
    let logoutFound = false;
    for (const selector of logoutOptions) {
      const logoutBtn = page.locator(selector);
      if (await logoutBtn.count() > 0) {
        console.log(`🚪 Found logout option: ${selector}`);
        await logoutBtn.first().click();
        await page.waitForTimeout(600);
        updateActivity();
        logoutFound = true;
        break;
      }
    }
    
    if (!logoutFound) {
      // Try keyboard shortcut or header menu
      console.log('🚪 Trying alternative logout methods...');
      const headerMenu = page.locator('[class*="header"], [class*="nav"], [class*="menu"]').first();
      if (await headerMenu.count() > 0) {
        await headerMenu.click();
        await page.waitForTimeout(600);
        updateActivity();
        
        // Look for logout in opened menu
        const logoutInMenu = page.locator('button:has-text("Logout"), a:has-text("Logout")');
        if (await logoutInMenu.count() > 0) {
          await logoutInMenu.first().click();
          await page.waitForTimeout(600);
          updateActivity();
          logoutFound = true;
        }
      }
    }
    
    if (logoutFound) {
      console.log('✅ Logout attempted - waiting for redirect...');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);
      updateActivity();
    } else {
      console.log('⚠️ Logout option not found');
    }
    
    // STEP 9: Final verification
    console.log('🔍 Final verification...');
    await page.waitForTimeout(600);
    updateActivity();
    
    await page.screenshot({ 
      path: './debug-screenshots/playwright-tests/08-after-logout.png',
      fullPage: true 
    });
    
    // Final inactivity check - auto-finish if nothing happens
    console.log('⏱️ Waiting for final activity or auto-finish...');
    
    // Wait for potential activity, then auto-finish
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(600);
      if (await checkInactivity()) return;
    }
    
    // Manual finish if we get here
    console.log('🎯 Complete workflow test finished!');
    console.log(`📧 Registered user: ${testEmail}`);
    console.log(`👤 Username: ${testUsername}`);
    console.log(`📝 Script: Test Script ${shortId}`);
    console.log(`🚪 Logout: ${logoutFound ? 'Success' : 'Not found'}`);
    
    // Log final console messages
    console.log('\n📋 Final Browser Console Log:');
    consoleMessages.forEach(msg => console.log(msg));
  });
  
  test('Quick Debug Test', async ({ page }) => {
    // Ultra-fast test for quick checks
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // This test is designed for rapid iteration
    // Add your quick checks here based on live instructions
    
    await page.screenshot({ 
      path: './debug-screenshots/playwright-tests/quick-debug.png',
      fullPage: true 
    });
  });
  
  test('Performance Test with Timings', async ({ page }) => {
    // Test with performance monitoring
    const startTime = Date.now();
    
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    console.log(`⚡ Page load time: ${loadTime}ms`);
    
    // Add performance-sensitive operations here
    // with custom timings based on your requirements
    
    await page.waitForTimeout(2000);
  });
  
});

// Helper functions for common operations
async function waitAndClick(page, selector, timeout = 1000) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.waitForTimeout(timeout);
  await page.click(selector);
}

async function fillWithDelay(page, selector, text, delay = 500) {
  await page.fill(selector, text);
  await page.waitForTimeout(delay);
}

async function takeTimestampedScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ 
    path: `./debug-screenshots/playwright-tests/${timestamp}-${name}.png`,
    fullPage: true 
  });
}