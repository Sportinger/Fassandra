// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  // Screenshot and debugging configuration
  outputDir: './debug-screenshots/playwright-tests',
  
  use: {
    baseURL: 'https://192.168.2.111:8080',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
    
    // Screenshot configuration for debugging
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Anti-bot measures
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    },
    
    // Viewport for better visibility (optimized for debugging)
    viewport: { width: 700, height: 900 },
    
    // Fast timeouts for quick failure detection
    actionTimeout: 2000,         // Fast fail: 2s max
    navigationTimeout: 2000,     // Fast fail: 2s max
  },

  projects: [
    {
      name: 'chrome-debug',
      use: { 
        ...devices['Desktop Chrome'],
        // Chrome-specific configuration for debugging
        launchOptions: {
          headless: false, // Show browser for debugging
          slowMo: 100,     // Slow down for better debugging visibility
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list',
            '--ignore-certificate-errors-ssl-errors',
            // Additional debugging flags
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ]
        }
      },
    },
  ],

  // Development server configuration
  webServer: {
                    command: 'echo "Using existing server at https://192.168.2.111:8080"',
        url: 'https://192.168.2.111:8080',
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
  },
}); 