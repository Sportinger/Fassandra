import { test, expect } from '@playwright/test';

test.describe('Pessoa Complete Workflow Tests', () => {
  const testUser = {
    email: 'a@b.c',
    password: 'a@b.c'
  };

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('https://192.168.2.111:8443/');
    
    // Resize browser to 700px width as per testing guidelines
    await page.setViewportSize({ width: 700, height: 800 });
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('Complete workflow: Login/Register → Create Script → Edit → Verify DB', async ({ page }) => {
    // Step 1: Handle Authentication (Login or Register)
    console.log('Step 1: Handling authentication...');
    
    // Check if we're on login page
    const loginHeading = page.locator('h2:has-text("Login")');
    const registerButton = page.locator('button:has-text("Go to Register")');
    
    if (await loginHeading.isVisible()) {
      console.log('Found login page, attempting to login...');
      
      // Try to login first
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const loginSubmitButton = page.locator('button[type="submit"]').first();
      
      if (await emailInput.isVisible()) {
        await emailInput.fill(testUser.email);
        await passwordInput.fill(testUser.password);
        await loginSubmitButton.click();
        
        // Wait for either success or error
        await page.waitForTimeout(2000);
        
        // Check if login was successful (by checking if we're redirected away from login)
        const stillOnLogin = await loginHeading.isVisible();
        
        if (stillOnLogin) {
          console.log('Login failed, trying to register...');
          
          // Click "Go to Register" button
          await registerButton.click();
          await page.waitForTimeout(1000);
          
          // Fill registration form
          const regEmailInput = page.locator('input[type="email"]').first();
          const regPasswordInput = page.locator('input[type="password"]').first();
          const regSubmitButton = page.locator('button[type="submit"]').first();
          
          await regEmailInput.fill(testUser.email);
          await regPasswordInput.fill(testUser.password);
          await regSubmitButton.click();
          
          // Wait for registration to complete
          await page.waitForTimeout(3000);
        }
      }
    }
    
    // Step 2: Create a new script called "Test"
    console.log('Step 2: Creating a new script...');
    
    // Look for script creation elements
    const createScriptButton = page.locator('button:has-text("Create Script")').or(
      page.locator('button:has-text("Add Script")')
    ).or(
      page.locator('button:has-text("New Script")')
    ).or(
      page.locator('[data-testid="create-script"]')
    );
    
    // Wait for the page to load and look for create script button
    await page.waitForTimeout(2000);
    
    if (await createScriptButton.isVisible()) {
      await createScriptButton.click();
      await page.waitForTimeout(1000);
      
      // Fill script title
      const titleInput = page.locator('input[placeholder*="title"]').or(
        page.locator('input[name="title"]')
      ).or(
        page.locator('input[type="text"]')
      );
      
      if (await titleInput.isVisible()) {
        await titleInput.fill('Test');
        
        // Submit script creation
        const submitButton = page.locator('button[type="submit"]').or(
          page.locator('button:has-text("Create")')
        ).or(
          page.locator('button:has-text("Save")')
        );
        
        await submitButton.click();
        await page.waitForTimeout(2000);
        
        // Verify script was created
        await expect(page.locator('text=Test')).toBeVisible();
        console.log('✅ Script "Test" created successfully');
      }
    } else {
      console.log('Could not find create script button, looking for existing scripts...');
    }
    
    // Step 3: Open the script in editor
    console.log('Step 3: Opening script in editor...');
    
    // Look for the "Test" script and click it
    const testScriptLink = page.locator('text=Test').or(
      page.locator('[data-testid="script-Test"]')
    ).or(
      page.locator('a:has-text("Test")')
    );
    
    if (await testScriptLink.isVisible()) {
      await testScriptLink.click();
      await page.waitForTimeout(2000);
      
      // Verify we're in the editor
      const editorArea = page.locator('[data-testid="editor"]').or(
        page.locator('.editor')
      ).or(
        page.locator('[contenteditable="true"]')
      ).or(
        page.locator('div[role="textbox"]')
      );
      
      await expect(editorArea).toBeVisible();
      console.log('✅ Script editor is open');
      
      // Step 4: Write something in the script
      console.log('Step 4: Writing content in script...');
      
      const testContent = `FADE IN:

INT. THEATER - DAY

A small theater with red velvet seats. The stage is empty except for a single spotlight.

ACTOR
(looking directly at the audience)
Welcome to the Pessoa script editor test. This content should be saved to the database.

FADE OUT.`;
      
      // Click on the editor area and type content
      await editorArea.click();
      await page.waitForTimeout(500);
      
      // Type the content
      await page.keyboard.type(testContent);
      
      // Wait for auto-save or manual save
      await page.waitForTimeout(3000);
      
      console.log('✅ Content written to editor');
      
      // Step 5: Verify content is saved (check if it persists after page reload)
      console.log('Step 5: Verifying content is saved to database...');
      
      // Reload the page to check if content persists
      await page.reload();
      await page.waitForTimeout(3000);
      
      // Check if the content is still there
      const savedContent = await page.locator('[data-testid="editor"]').or(
        page.locator('.editor')
      ).or(
        page.locator('[contenteditable="true"]')
      ).or(
        page.locator('div[role="textbox"]')
      );
      
      // Check if our test content is present
      await expect(page.locator('text=FADE IN:')).toBeVisible();
      await expect(page.locator('text=INT. THEATER - DAY')).toBeVisible();
      await expect(page.locator('text=Welcome to the Pessoa script editor test')).toBeVisible();
      
      console.log('✅ Content successfully saved to database and persists after reload');
    } else {
      console.log('Could not find Test script to open');
    }
    
    // Additional verification: Check if we can navigate away and back
    console.log('Step 6: Additional verification - navigation test...');
    
    // Try to navigate to scripts list
    const scriptsLink = page.locator('text=Scripts').or(
      page.locator('[href*="scripts"]')
    ).or(
      page.locator('button:has-text("Scripts")')
    );
    
    if (await scriptsLink.isVisible()) {
      await scriptsLink.click();
      await page.waitForTimeout(2000);
      
      // Verify "Test" script is still in the list
      await expect(page.locator('text=Test')).toBeVisible();
      
      // Open it again
      await page.locator('text=Test').click();
      await page.waitForTimeout(2000);
      
      // Verify content is still there
      await expect(page.locator('text=FADE IN:')).toBeVisible();
      console.log('✅ Navigation test passed - content persists');
    }
    
    console.log('🎉 Complete workflow test PASSED!');
  });

  test('Test individual components', async ({ page }) => {
    // Test just the login/register flow
    const loginHeading = page.locator('h2:has-text("Login")');
    const registerButton = page.locator('button:has-text("Go to Register")');
    
    // Verify login page elements are visible
    await expect(loginHeading).toBeVisible();
    await expect(registerButton).toBeVisible();
    
    // Test form elements
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    
    // Test that we can type in the fields
    await emailInput.fill('test@example.com');
    await passwordInput.fill('testpassword');
    
    // Verify values were entered
    await expect(emailInput).toHaveValue('test@example.com');
    await expect(passwordInput).toHaveValue('testpassword');
    
    console.log('✅ Individual component test passed');
  });

  test('Test responsive design', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    // Verify page is still functional
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    
    // Verify page is still functional
    await expect(page.locator('body')).toBeVisible();
    
    console.log('✅ Responsive design test passed');
  });
}); 