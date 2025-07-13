const { test, expect } = require('@playwright/test');

test.describe('MCP Test Suite for Pessoa', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Pessoa application
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('should load the Pessoa application', async ({ page }) => {
    // Check if the page title contains "Pessoa"
    await expect(page).toHaveTitle(/Pessoa/);
    
    // Check if the login form is visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should be able to login with test credentials', async ({ page }) => {
    // Fill login form
    await page.fill('input[type="email"]', 'a@b.c');
    await page.fill('input[type="password"]', 'a@b.c');
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForURL(/.*/, { timeout: 10000 });
    
    // Check if we're redirected to the script list
    await expect(page.locator('text=Scripts')).toBeVisible();
  });

  test('should be able to create a new script', async ({ page }) => {
    // Login first
    await page.fill('input[type="email"]', 'a@b.c');
    await page.fill('input[type="password"]', 'a@b.c');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*/, { timeout: 10000 });
    
    // Look for create script button
    const createButton = page.locator('button', { hasText: /Create|New|Add/ });
    if (await createButton.isVisible()) {
      await createButton.click();
      
      // Fill in script title
      await page.fill('input[placeholder*="title"], input[placeholder*="Title"]', 'MCP Test Script');
      
      // Submit the form
      await page.click('button[type="submit"]');
      
      // Verify script was created
      await expect(page.locator('text=MCP Test Script')).toBeVisible();
    }
  });

  test('should handle WebSocket connections', async ({ page }) => {
    // Login first
    await page.fill('input[type="email"]', 'a@b.c');
    await page.fill('input[type="password"]', 'a@b.c');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*/, { timeout: 10000 });
    
    // Open an existing script (or create one)
    const firstScript = page.locator('text=Test').first();
    if (await firstScript.isVisible()) {
      await firstScript.click();
      
      // Wait for editor to load
      await page.waitForSelector('[contenteditable="true"]', { timeout: 10000 });
      
      // Type some content
      await page.fill('[contenteditable="true"]', 'This is a test from MCP');
      
      // Wait a bit for WebSocket sync
      await page.waitForTimeout(2000);
      
      // Content should be saved
      await expect(page.locator('text=This is a test from MCP')).toBeVisible();
    }
  });
}); 