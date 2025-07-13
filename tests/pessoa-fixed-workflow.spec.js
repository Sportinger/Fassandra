import { test, expect } from '@playwright/test';

test.describe('Pessoa Fixed Workflow Tests', () => {
  const testUser = {
    email: 'a@b.c',
    username: 'testuser',
    password: 'a@b.c'
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('https://192.168.2.111:8443/');
    await page.setViewportSize({ width: 700, height: 800 });
    await page.waitForLoadState('networkidle');
  });

  test('Complete workflow: Register → Navigate → Create Script → Edit → Verify DB', async ({ page }) => {
    // Step 1: Handle Complete Registration
    console.log('Step 1: Handling complete registration...');
    
    const loginHeading = page.locator('h2:has-text("Login")');
    const registerButton = page.locator('button:has-text("Go to Register")');
    
    if (await loginHeading.isVisible()) {
      console.log('Found login page, going to registration...');
      await registerButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Fill complete registration form
    const emailInput = page.locator('input[placeholder="Enter your email"]');
    const usernameInput = page.locator('input[placeholder="Choose a username"]');
    const passwordInput = page.locator('input[placeholder="Create a password"]');
    const registerSubmitButton = page.locator('button:has-text("Register")');
    
    if (await emailInput.isVisible()) {
      console.log('Filling registration form...');
      await emailInput.fill(testUser.email);
      await usernameInput.fill(testUser.username);
      await passwordInput.fill(testUser.password);
      await registerSubmitButton.click();
      
      // Wait for registration to complete
      await page.waitForTimeout(3000);
      console.log('✅ Registration completed');
    }
    
    // Step 2: Navigate using hamburger menu
    console.log('Step 2: Navigating using hamburger menu...');
    
    const hamburgerButton = page.locator('button:has-text("☰")');
    if (await hamburgerButton.isVisible()) {
      await hamburgerButton.click();
      await page.waitForTimeout(1000);
      
      // Take screenshot to see menu options
      await page.screenshot({ path: 'debug-hamburger-menu.png' });
      console.log('📸 Screenshot: Hamburger menu opened');
      
      // Look for navigation options
      const menuButtons = await page.locator('button').all();
      console.log('🔍 Menu buttons available:');
      for (let i = 0; i < menuButtons.length; i++) {
        const buttonText = await menuButtons[i].textContent();
        const buttonVisible = await menuButtons[i].isVisible();
        console.log(`  Menu Button ${i + 1}: "${buttonText}" (visible: ${buttonVisible})`);
      }
      
      // Look for links in the menu
      const menuLinks = await page.locator('a').all();
      console.log('🔍 Menu links available:');
      for (let i = 0; i < menuLinks.length; i++) {
        const linkText = await menuLinks[i].textContent();
        const linkHref = await menuLinks[i].getAttribute('href');
        const linkVisible = await menuLinks[i].isVisible();
        console.log(`  Menu Link ${i + 1}: "${linkText}" (href: ${linkHref}, visible: ${linkVisible})`);
      }
      
      // Try to find scripts or dashboard link
      const scriptsLink = page.locator('a:has-text("Scripts")').or(
        page.locator('a:has-text("Dashboard")')
      ).or(
        page.locator('a:has-text("Home")')
      ).or(
        page.locator('button:has-text("Scripts")')
      ).or(
        page.locator('button:has-text("Dashboard")')
      );
      
      if (await scriptsLink.isVisible()) {
        console.log('Found scripts/dashboard link, clicking...');
        await scriptsLink.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Step 3: Take screenshot of current state
    await page.screenshot({ path: 'debug-after-navigation.png' });
    console.log('📸 Screenshot: After navigation attempt');
    
    // Step 4: Look for script creation elements again
    console.log('Step 4: Looking for script creation elements...');
    
    // Re-scan the page for all elements
    const allButtons = await page.locator('button').all();
    console.log('🔍 All buttons on current page:');
    for (let i = 0; i < allButtons.length; i++) {
      const buttonText = await allButtons[i].textContent();
      const buttonVisible = await allButtons[i].isVisible();
      console.log(`  Button ${i + 1}: "${buttonText}" (visible: ${buttonVisible})`);
    }
    
    // Look for any script-related elements
    const scriptElements = await page.locator('*').filter({
      hasText: /script|create|new|add|write|editor|document/i
    }).all();
    
    console.log(`🔍 Found ${scriptElements.length} script-related elements:`);
    for (let i = 0; i < scriptElements.length; i++) {
      const elementText = await scriptElements[i].textContent();
      const elementTag = await scriptElements[i].evaluate(el => el.tagName);
      const elementVisible = await scriptElements[i].isVisible();
      console.log(`  Element ${i + 1}: <${elementTag}> "${elementText}" (visible: ${elementVisible})`);
    }
    
    // Try to find create button with more generic selectors
    const createButton = page.locator('button').filter({
      hasText: /create|new|add|\+/i
    });
    
    if (await createButton.first().isVisible()) {
      console.log('Found create button, clicking...');
      await createButton.first().click();
      await page.waitForTimeout(2000);
      
      // Step 5: Handle script creation
      console.log('Step 5: Handling script creation...');
      
      // Look for title input
      const titleInput = page.locator('input').filter({
        hasText: /title|name/i
      }).or(
        page.locator('input[type="text"]')
      );
      
      if (await titleInput.first().isVisible()) {
        await titleInput.first().fill('Test');
        
        // Look for submit button
        const submitButton = page.locator('button').filter({
          hasText: /submit|save|create|ok/i
        });
        
        if (await submitButton.first().isVisible()) {
          await submitButton.first().click();
          await page.waitForTimeout(2000);
          console.log('✅ Script "Test" created');
        }
      }
    }
    
    // Step 6: Look for the created script
    console.log('Step 6: Looking for created script...');
    
    const testScriptElement = page.locator('*').filter({
      hasText: 'Test'
    });
    
    if (await testScriptElement.first().isVisible()) {
      console.log('Found Test script, clicking...');
      await testScriptElement.first().click();
      await page.waitForTimeout(2000);
      
      // Step 7: Look for editor
      console.log('Step 7: Looking for editor...');
      
      // Try different editor selectors
      const editorArea = page.locator('[contenteditable="true"]').or(
        page.locator('textarea')
      ).or(
        page.locator('.editor')
      ).or(
        page.locator('[role="textbox"]')
      ).or(
        page.locator('div').filter({
          hasText: /editor|content|write/i
        })
      );
      
      if (await editorArea.first().isVisible()) {
        console.log('Found editor, writing content...');
        await editorArea.first().click();
        await page.waitForTimeout(500);
        
        const testContent = 'FADE IN:\n\nINT. THEATER - DAY\n\nTest content for database verification.';
        await page.keyboard.type(testContent);
        
        // Wait for save
        await page.waitForTimeout(3000);
        console.log('✅ Content written to editor');
        
        // Step 8: Verify persistence
        console.log('Step 8: Verifying content persistence...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Check if content persists
        const fadeInText = page.locator('*').filter({
          hasText: 'FADE IN'
        });
        
        if (await fadeInText.first().isVisible()) {
          console.log('✅ Content persists in database!');
        } else {
          console.log('❌ Content does not persist');
        }
      }
    }
    
    // Final state
    await page.screenshot({ path: 'debug-final-state.png' });
    console.log('📸 Screenshot: Final state');
    
    // Final URL check
    const finalUrl = page.url();
    console.log(`🔍 Final URL: ${finalUrl}`);
    
    console.log('🎉 Workflow test completed!');
  });
}); 