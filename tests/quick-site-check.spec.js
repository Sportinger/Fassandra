const { test } = require('@playwright/test');

test('Quick site check', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();
  
  await page.goto('https://192.168.2.141:8080');
  await page.waitForTimeout(2000);
  
  // Take screenshots
  await page.screenshot({ 
    path: 'debug-screenshots/site-homepage.png',
    fullPage: true 
  });
  
  // Check for key elements
  const hasLoginForm = await page.locator('input[type="email"]').isVisible();
  const hasRegisterButton = await page.getByRole('button', { name: /register/i }).isVisible();
  
  console.log('Site Check Results:');
  console.log('- Homepage loaded: ✓');
  console.log(`- Login form visible: ${hasLoginForm ? '✓' : '✗'}`);
  console.log(`- Register button visible: ${hasRegisterButton ? '✓' : '✗'}`);
  
  await context.close();
});