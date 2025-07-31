// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Site Verification Tests', () => {
  test('should load the page and check for errors', async ({ page }) => {
    // Collect console messages
    const consoleMessages = [];
    const consoleErrors = [];
    
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      
      consoleMessages.push({
        type: type,
        text: text,
        location: msg.location()
      });
      
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    // Navigate to the page
    console.log('Navigating to https://192.168.2.111:8080/');
    const response = await page.goto('https://192.168.2.111:8080/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Check response status
    expect(response).not.toBeNull();
    console.log(`Response status: ${response.status()}`);
    expect(response.status()).toBeLessThan(400);

    // Take screenshots
    await page.screenshot({ 
      path: './debug-screenshots/homepage-full.png',
      fullPage: true 
    });
    console.log('Full page screenshot saved to ./debug-screenshots/homepage-full.png');

    await page.screenshot({ 
      path: './debug-screenshots/homepage-viewport.png',
      fullPage: false 
    });
    console.log('Viewport screenshot saved to ./debug-screenshots/homepage-viewport.png');

    // Wait a bit for any async errors to appear
    await page.waitForTimeout(2000);

    // Check page title
    const title = await page.title();
    console.log(`Page title: "${title}"`);
    expect(title).toBeTruthy();

    // Check for basic content
    const body = await page.$('body');
    expect(body).not.toBeNull();

    // Log all console messages
    if (consoleMessages.length > 0) {
      console.log('\n=== Console Messages ===');
      consoleMessages.forEach(msg => {
        console.log(`[${msg.type}] ${msg.text}`);
        if (msg.location.url) {
          console.log(`  at ${msg.location.url}:${msg.location.lineNumber}`);
        }
      });
    }

    // Report errors
    if (consoleErrors.length > 0) {
      console.error('\n=== Console Errors Found ===');
      consoleErrors.forEach(error => console.error(error));
    }

    if (pageErrors.length > 0) {
      console.error('\n=== Page Errors Found ===');
      pageErrors.forEach(error => console.error(error));
    }

    // Test should pass if page loads, but we log any errors found
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('should check page elements and interactions', async ({ page }) => {
    await page.goto('https://192.168.2.111:8080/', {
      waitUntil: 'networkidle'
    });

    // Check for common elements
    const elements = {
      'forms': await page.$$('form'),
      'inputs': await page.$$('input'),
      'buttons': await page.$$('button'),
      'links': await page.$$('a'),
      'images': await page.$$('img')
    };

    console.log('\n=== Page Elements ===');
    for (const [name, elems] of Object.entries(elements)) {
      console.log(`${name}: ${elems.length}`);
    }

    // Check for specific content
    const hasLoginForm = await page.$('input[type="email"], input[type="username"]');
    const hasPasswordField = await page.$('input[type="password"]');
    
    if (hasLoginForm && hasPasswordField) {
      console.log('\nLogin form detected');
      await page.screenshot({ 
        path: './debug-screenshots/login-form.png',
        fullPage: false 
      });
    }

    // Check page performance
    const performanceTiming = JSON.parse(
      await page.evaluate(() => JSON.stringify(window.performance.timing))
    );
    
    const pageLoadTime = performanceTiming.loadEventEnd - performanceTiming.navigationStart;
    console.log(`\nPage load time: ${pageLoadTime}ms`);
  });
});