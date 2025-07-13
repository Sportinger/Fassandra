import { test, expect } from '@playwright/test';

test.describe('Pessoa Application Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('https://192.168.2.111:8443/');
    
    // Resize browser to 700px width as per testing guidelines
    await page.setViewportSize({ width: 700, height: 800 });
  });

  test('should load the application homepage', async ({ page }) => {
    await expect(page).toHaveTitle(/Pessoa/);
    
    // Check if the main elements are present
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle user authentication flow', async ({ page }) => {
    // Look for login elements
    const loginButton = page.locator('text=Login').first();
    const registerButton = page.locator('text=Register').first();
    
    // Test if login/register elements are present
    await expect(loginButton.or(registerButton)).toBeVisible();
    
    // If login form exists, test it
    if (await loginButton.isVisible()) {
      await loginButton.click();
      
      // Fill login form (adjust selectors based on your actual form)
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      
      if (await emailInput.isVisible()) {
        await emailInput.fill('test@example.com');
        await passwordInput.fill('password123');
        
        // Submit form
        await page.locator('button[type="submit"]').click();
        
        // Wait for navigation or success message
        await page.waitForTimeout(2000);
      }
    }
  });

  test('should test script management functionality', async ({ page }) => {
    // This test assumes user is logged in or can access scripts
    
    // Look for script-related elements
    const scriptList = page.locator('[data-testid="script-list"]');
    const addScriptButton = page.locator('text=Add Script').or(page.locator('text=Create Script'));
    
    // Test script creation if button exists
    if (await addScriptButton.isVisible()) {
      await addScriptButton.click();
      
      // Fill script details
      const titleInput = page.locator('input[placeholder*="title"]').or(page.locator('input[name="title"]'));
      if (await titleInput.isVisible()) {
        await titleInput.fill('Test Script');
        
        // Submit script creation
        await page.locator('button[type="submit"]').or(page.locator('text=Create')).click();
        
        // Wait for script to be created
        await page.waitForTimeout(2000);
        
        // Verify script appears in list
        await expect(page.locator('text=Test Script')).toBeVisible();
      }
    }
  });

  test('should test editor functionality', async ({ page }) => {
    // Navigate to editor if available
    const editorArea = page.locator('[data-testid="editor"]').or(page.locator('.editor'));
    
    if (await editorArea.isVisible()) {
      await editorArea.click();
      
      // Test typing in editor
      await page.keyboard.type('FADE IN:');
      await page.keyboard.press('Enter');
      await page.keyboard.type('INT. THEATER - DAY');
      
      // Wait for content to be saved
      await page.waitForTimeout(1000);
      
      // Verify content exists
      await expect(page.locator('text=FADE IN:')).toBeVisible();
    }
  });

  test('should test responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    // Check if mobile layout is working
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    
    // Check if tablet layout is working
    await expect(page.locator('body')).toBeVisible();
    
    // Return to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should handle error scenarios', async ({ page }) => {
    // Test network failure handling
    await page.route('**/api/**', route => route.abort());
    
    // Try to perform an action that requires API
    await page.reload();
    
    // Check if error handling is working
    // This depends on your error handling implementation
    await page.waitForTimeout(2000);
  });
}); 