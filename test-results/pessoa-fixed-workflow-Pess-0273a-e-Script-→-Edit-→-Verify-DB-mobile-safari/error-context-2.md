# Test info

- Name: Pessoa Fixed Workflow Tests >> Complete workflow: Register → Navigate → Create Script → Edit → Verify DB
- Location: /home/admins/projects/pessoa/tests/pessoa-fixed-workflow.spec.js:16:7

# Error details

```
Error: browserContext._wrapApiCall: Test ended.
Browser logs:

<launching> /home/admins/.cache/ms-playwright/webkit-2158/pw_run.sh --inspector-pipe --no-startup-window
<launched> pid=163699
[pid=163699][err] 
[pid=163699][err] ** (MiniBrowser:163728): CRITICAL **: 20:49:06.542: WebKitWebView is-controlled-by-automation set but automation is not allowed in the context, falling back to default session.
[pid=163699] <gracefully close start>
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Pessoa Fixed Workflow Tests', () => {
   4 |   const testUser = {
   5 |     email: 'a@b.c',
   6 |     username: 'testuser',
   7 |     password: 'a@b.c'
   8 |   };
   9 |
   10 |   test.beforeEach(async ({ page }) => {
   11 |     await page.goto('https://192.168.2.111:8443/');
   12 |     await page.setViewportSize({ width: 700, height: 800 });
   13 |     await page.waitForLoadState('networkidle');
   14 |   });
   15 |
>  16 |   test('Complete workflow: Register → Navigate → Create Script → Edit → Verify DB', async ({ page }) => {
      |       ^ Error: browserContext._wrapApiCall: Test ended.
   17 |     // Step 1: Handle Complete Registration
   18 |     console.log('Step 1: Handling complete registration...');
   19 |     
   20 |     const loginHeading = page.locator('h2:has-text("Login")');
   21 |     const registerButton = page.locator('button:has-text("Go to Register")');
   22 |     
   23 |     if (await loginHeading.isVisible()) {
   24 |       console.log('Found login page, going to registration...');
   25 |       await registerButton.click();
   26 |       await page.waitForTimeout(1000);
   27 |     }
   28 |     
   29 |     // Fill complete registration form
   30 |     const emailInput = page.locator('input[placeholder="Enter your email"]');
   31 |     const usernameInput = page.locator('input[placeholder="Choose a username"]');
   32 |     const passwordInput = page.locator('input[placeholder="Create a password"]');
   33 |     const registerSubmitButton = page.locator('button:has-text("Register")');
   34 |     
   35 |     if (await emailInput.isVisible()) {
   36 |       console.log('Filling registration form...');
   37 |       await emailInput.fill(testUser.email);
   38 |       await usernameInput.fill(testUser.username);
   39 |       await passwordInput.fill(testUser.password);
   40 |       await registerSubmitButton.click();
   41 |       
   42 |       // Wait for registration to complete
   43 |       await page.waitForTimeout(3000);
   44 |       console.log('✅ Registration completed');
   45 |     }
   46 |     
   47 |     // Step 2: Navigate using hamburger menu
   48 |     console.log('Step 2: Navigating using hamburger menu...');
   49 |     
   50 |     const hamburgerButton = page.locator('button:has-text("☰")');
   51 |     if (await hamburgerButton.isVisible()) {
   52 |       await hamburgerButton.click();
   53 |       await page.waitForTimeout(1000);
   54 |       
   55 |       // Take screenshot to see menu options
   56 |       await page.screenshot({ path: 'debug-hamburger-menu.png' });
   57 |       console.log('📸 Screenshot: Hamburger menu opened');
   58 |       
   59 |       // Look for navigation options
   60 |       const menuButtons = await page.locator('button').all();
   61 |       console.log('🔍 Menu buttons available:');
   62 |       for (let i = 0; i < menuButtons.length; i++) {
   63 |         const buttonText = await menuButtons[i].textContent();
   64 |         const buttonVisible = await menuButtons[i].isVisible();
   65 |         console.log(`  Menu Button ${i + 1}: "${buttonText}" (visible: ${buttonVisible})`);
   66 |       }
   67 |       
   68 |       // Look for links in the menu
   69 |       const menuLinks = await page.locator('a').all();
   70 |       console.log('🔍 Menu links available:');
   71 |       for (let i = 0; i < menuLinks.length; i++) {
   72 |         const linkText = await menuLinks[i].textContent();
   73 |         const linkHref = await menuLinks[i].getAttribute('href');
   74 |         const linkVisible = await menuLinks[i].isVisible();
   75 |         console.log(`  Menu Link ${i + 1}: "${linkText}" (href: ${linkHref}, visible: ${linkVisible})`);
   76 |       }
   77 |       
   78 |       // Try to find scripts or dashboard link
   79 |       const scriptsLink = page.locator('a:has-text("Scripts")').or(
   80 |         page.locator('a:has-text("Dashboard")')
   81 |       ).or(
   82 |         page.locator('a:has-text("Home")')
   83 |       ).or(
   84 |         page.locator('button:has-text("Scripts")')
   85 |       ).or(
   86 |         page.locator('button:has-text("Dashboard")')
   87 |       );
   88 |       
   89 |       if (await scriptsLink.isVisible()) {
   90 |         console.log('Found scripts/dashboard link, clicking...');
   91 |         await scriptsLink.click();
   92 |         await page.waitForTimeout(2000);
   93 |       }
   94 |     }
   95 |     
   96 |     // Step 3: Take screenshot of current state
   97 |     await page.screenshot({ path: 'debug-after-navigation.png' });
   98 |     console.log('📸 Screenshot: After navigation attempt');
   99 |     
  100 |     // Step 4: Look for script creation elements again
  101 |     console.log('Step 4: Looking for script creation elements...');
  102 |     
  103 |     // Re-scan the page for all elements
  104 |     const allButtons = await page.locator('button').all();
  105 |     console.log('🔍 All buttons on current page:');
  106 |     for (let i = 0; i < allButtons.length; i++) {
  107 |       const buttonText = await allButtons[i].textContent();
  108 |       const buttonVisible = await allButtons[i].isVisible();
  109 |       console.log(`  Button ${i + 1}: "${buttonText}" (visible: ${buttonVisible})`);
  110 |     }
  111 |     
  112 |     // Look for any script-related elements
  113 |     const scriptElements = await page.locator('*').filter({
  114 |       hasText: /script|create|new|add|write|editor|document/i
  115 |     }).all();
  116 |     
```