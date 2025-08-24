/**
 * Authentication Pattern - Reusable patterns for login, logout, and session management
 * Based on testing results and best practices for robust authentication flows
 */
class AuthPattern {
  constructor() {
    this.defaultTimeout = 5000;
    this.retryAttempts = 3;
  }

  /**
   * Standard login flow with email and password
   * Handles both login and registration pages automatically
   */
  async loginWithCredentials(email, password, options = {}) {
    const { 
      baseUrl = 'https://192.168.2.111:8080',
      timeout = this.defaultTimeout,
      autoRegister = true 
    } = options;

    try {
      // Navigate to login page
      await this.navigateToLogin(baseUrl);
      
      // Check if we need to switch to register page
      if (autoRegister) {
        await this.switchToRegisterIfNeeded();
      }
      
      // Fill credentials
      await this.fillCredentials(email, password);
      
      // Submit form
      await this.submitAuthForm();
      
      // Verify login success
      await this.verifyAuthSuccess(timeout);
      
      return { success: true, email, timestamp: Date.now() };
    } catch (error) {
      return { success: false, error: error.message, email };
    }
  }

  /**
   * Auto-registration with generated credentials
   * Creates unique user for testing purposes
   */
  async autoRegister(options = {}) {
    const timestamp = Date.now();
    const username = options.username || `m${timestamp}`;
    const email = options.email || `${username}@t.co`;
    const password = options.password || 'Test123@Pass!';

    return await this.loginWithCredentials(email, password, {
      ...options,
      autoRegister: true
    });
  }

  /**
   * Logout with cleanup
   * Ensures proper session termination
   */
  async logout(options = {}) {
    const { waitForRedirect = true } = options;

    try {
      // Find and click logout button
      const logoutScript = `
        // Look for menu button first
        const menuBtn = document.querySelector('button[aria-label="☰"]') || 
                       Array.from(document.querySelectorAll('button')).find(b => b.textContent === '☰');
        
        if (menuBtn) {
          menuBtn.click();
          await new Promise(r => setTimeout(r, 300));
        }
        
        // Find logout button
        const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent.includes('Logout') || 
          b.textContent.includes('Sign Out') ||
          b.textContent.includes('Log Out')
        );
        
        if (logoutBtn) {
          logoutBtn.click();
          return { found: true };
        }
        
        return { found: false, error: 'Logout button not found' };
      `;

      const result = await mcp__playwright__browser_evaluate({ 
        function: `async () => { ${logoutScript} }` 
      });

      if (waitForRedirect) {
        await this.waitForUrl(url => url.includes('login') || url.includes('auth'));
      }

      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Session validation
   * Checks if user is currently logged in
   */
  async validateSession() {
    try {
      const sessionCheck = `
        // Check for authenticated user indicators
        const indicators = [
          '.scriptList', // Script list indicates logged in user
          '[data-testid="user-menu"]',
          '.user-avatar',
          'button[aria-label="☰"]' // Main menu indicates auth
        ];
        
        const isLoggedIn = indicators.some(selector => document.querySelector(selector));
        const currentUrl = window.location.href;
        
        return {
          isLoggedIn,
          currentUrl,
          hasScriptList: !!document.querySelector('.scriptList'),
          hasUserMenu: !!document.querySelector('button[aria-label="☰"]')
        };
      `;

      const sessionInfo = await mcp__playwright__browser_evaluate({ 
        function: `() => { ${sessionCheck} }` 
      });

      return sessionInfo;
    } catch (error) {
      return { isLoggedIn: false, error: error.message };
    }
  }

  // Helper methods for internal use

  async navigateToLogin(baseUrl) {
    await mcp__playwright__browser_navigate({ url: baseUrl });
    await this.waitMs(1000); // Allow page to load
  }

  async switchToRegisterIfNeeded() {
    const switchScript = `
      // Check if we're on login page and need to switch to register
      if (document.querySelector('input[type="email"]')) {
        const registerBtn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent.includes('Register') || 
          b.textContent.includes('Sign Up')
        );
        
        if (registerBtn) {
          registerBtn.click();
          return { switched: true };
        }
      }
      return { switched: false };
    `;

    await mcp__playwright__browser_evaluate({ 
      function: `() => { ${switchScript} }` 
    });
    
    await this.waitMs(600);
  }

  async fillCredentials(email, password, username = null) {
    const fillScript = `
      const setValue = (input, value) => {
        if (!input) return false;
        
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 
          "value"
        ).set;
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      };

      // Fill email
      const emailInput = document.querySelector('input[type="email"]');
      const emailFilled = setValue(emailInput, '${email}');
      
      // Fill username if present
      let usernameFilled = true;
      if ('${username}' !== 'null') {
        const usernameInput = document.querySelector('input[name="username"]') || 
                             document.querySelector('input[placeholder*="sername"]');
        usernameFilled = setValue(usernameInput, '${username || email.split('@')[0]}');
      }
      
      // Fill password
      const passwordInput = document.querySelector('input[type="password"]');
      const passwordFilled = setValue(passwordInput, '${password}');
      
      return { 
        emailFilled, 
        usernameFilled, 
        passwordFilled,
        allFieldsFilled: emailFilled && usernameFilled && passwordFilled
      };
    `;

    const result = await mcp__playwright__browser_evaluate({ 
      function: `() => { ${fillScript} }` 
    });

    if (!result.allFieldsFilled) {
      throw new Error('Failed to fill all authentication fields');
    }

    await this.waitMs(300);
  }

  async submitAuthForm() {
    const submitScript = `
      const submitBtn = document.querySelector('button[type="submit"]') || 
                       Array.from(document.querySelectorAll('button')).find(b => 
                         b.textContent === 'Register' ||
                         b.textContent === 'Login' ||
                         b.textContent === 'Sign In' ||
                         b.textContent === 'Sign Up'
                       );
      
      if (submitBtn) {
        submitBtn.click();
        return { submitted: true };
      }
      
      throw new Error('Submit button not found');
    `;

    await mcp__playwright__browser_evaluate({ 
      function: `() => { ${submitScript} }` 
    });
  }

  async verifyAuthSuccess(timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const sessionInfo = await this.validateSession();
      
      if (sessionInfo.isLoggedIn) {
        return sessionInfo;
      }
      
      await this.waitMs(500);
    }
    
    throw new Error('Authentication verification timeout');
  }

  async waitForUrl(predicate, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const currentUrl = await mcp__playwright__browser_evaluate({ 
        function: '() => window.location.href' 
      });
      
      if (predicate(currentUrl)) {
        return currentUrl;
      }
      
      await this.waitMs(500);
    }
    
    throw new Error('URL condition timeout');
  }

  async waitMs(ms) {
    await mcp__playwright__browser_wait_for({ time: ms / 1000 });
  }
}

module.exports = { AuthPattern };