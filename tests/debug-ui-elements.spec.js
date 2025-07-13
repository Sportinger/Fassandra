import { test, expect } from '@playwright/test';

test.describe('Debug UI Elements', () => {
  const testUser = {
    email: 'a@b.c',
    password: 'a@b.c'
  };

  test('Debug: Login and explore UI elements', async ({ page }) => {
    // Navigate to the application
    await page.goto('https://192.168.2.111:8443/');
    await page.setViewportSize({ width: 700, height: 800 });
    await page.waitForLoadState('networkidle');

    // Step 1: Take screenshot of login page
    await page.screenshot({ path: 'debug-1-login-page.png' });
    console.log('📸 Screenshot 1: Login page');

    // Step 2: Handle authentication
    const loginHeading = page.locator('h2:has-text("Login")');
    const registerButton = page.locator('button:has-text("Go to Register")');
    
    if (await loginHeading.isVisible()) {
      console.log('🔍 Found login page');
      
      // Try to login first
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const loginSubmitButton = page.locator('button[type="submit"]').first();
      
      await emailInput.fill(testUser.email);
      await passwordInput.fill(testUser.password);
      await loginSubmitButton.click();
      
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'debug-2-after-login-attempt.png' });
      console.log('📸 Screenshot 2: After login attempt');
      
      // Check if still on login page
      const stillOnLogin = await loginHeading.isVisible();
      
      if (stillOnLogin) {
        console.log('🔄 Login failed, trying to register...');
        await registerButton.click();
        await page.waitForTimeout(1000);
        
        const regEmailInput = page.locator('input[type="email"]').first();
        const regPasswordInput = page.locator('input[type="password"]').first();
        const regSubmitButton = page.locator('button[type="submit"]').first();
        
        await regEmailInput.fill(testUser.email);
        await regPasswordInput.fill(testUser.password);
        await regSubmitButton.click();
        
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'debug-3-after-register.png' });
        console.log('📸 Screenshot 3: After registration');
      }
    }

    // Step 3: Explore what's available after login
    console.log('🔍 Exploring page after authentication...');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'debug-4-main-page.png' });
    console.log('📸 Screenshot 4: Main page after authentication');

    // Log all buttons on the page
    const buttons = await page.locator('button').all();
    console.log(`🔍 Found ${buttons.length} buttons on page:`);
    for (let i = 0; i < buttons.length; i++) {
      const buttonText = await buttons[i].textContent();
      const buttonVisible = await buttons[i].isVisible();
      console.log(`  Button ${i + 1}: "${buttonText}" (visible: ${buttonVisible})`);
    }

    // Log all links on the page
    const links = await page.locator('a').all();
    console.log(`🔍 Found ${links.length} links on page:`);
    for (let i = 0; i < links.length; i++) {
      const linkText = await links[i].textContent();
      const linkHref = await links[i].getAttribute('href');
      const linkVisible = await links[i].isVisible();
      console.log(`  Link ${i + 1}: "${linkText}" (href: ${linkHref}, visible: ${linkVisible})`);
    }

    // Log all input fields
    const inputs = await page.locator('input').all();
    console.log(`🔍 Found ${inputs.length} input fields on page:`);
    for (let i = 0; i < inputs.length; i++) {
      const inputType = await inputs[i].getAttribute('type');
      const inputPlaceholder = await inputs[i].getAttribute('placeholder');
      const inputName = await inputs[i].getAttribute('name');
      const inputVisible = await inputs[i].isVisible();
      console.log(`  Input ${i + 1}: type="${inputType}", placeholder="${inputPlaceholder}", name="${inputName}" (visible: ${inputVisible})`);
    }

    // Look for any elements that might be script-related
    const possibleScriptElements = await page.locator('*').filter({
      hasText: /script|create|new|add|editor|write/i
    }).all();
    
    console.log(`🔍 Found ${possibleScriptElements.length} elements with script-related text:`);
    for (let i = 0; i < possibleScriptElements.length; i++) {
      const elementText = await possibleScriptElements[i].textContent();
      const elementTag = await possibleScriptElements[i].evaluate(el => el.tagName);
      const elementVisible = await possibleScriptElements[i].isVisible();
      console.log(`  Element ${i + 1}: <${elementTag}> "${elementText}" (visible: ${elementVisible})`);
    }

    // Try to find any content editable areas
    const editableElements = await page.locator('[contenteditable="true"]').all();
    console.log(`🔍 Found ${editableElements.length} contenteditable elements`);

    // Look for any data-testid attributes
    const testIdElements = await page.locator('[data-testid]').all();
    console.log(`🔍 Found ${testIdElements.length} elements with data-testid attributes:`);
    for (let i = 0; i < testIdElements.length; i++) {
      const testId = await testIdElements[i].getAttribute('data-testid');
      const elementVisible = await testIdElements[i].isVisible();
      console.log(`  Element ${i + 1}: data-testid="${testId}" (visible: ${elementVisible})`);
    }

    // Check page title and URL
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log(`🔍 Page title: "${pageTitle}"`);
    console.log(`🔍 Page URL: "${pageUrl}"`);

    // Final screenshot
    await page.screenshot({ path: 'debug-5-final-state.png' });
    console.log('📸 Screenshot 5: Final state');

    console.log('✅ Debug exploration completed! Check the screenshots and logs above.');
  });
}); 