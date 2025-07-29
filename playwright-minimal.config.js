const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  outputDir: './debug-screenshots/playwright-tests',
  
  use: {
    baseURL: 'https://192.168.2.111:8080',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    viewport: { width: 700, height: 900 },
    actionTimeout: 2000,     // Fast fail: 2s max
    navigationTimeout: 2000, // Fast fail: 2s max
  },

  projects: [
    {
      name: 'chrome-debug',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          headless: false,
          slowMo: 100,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--disable-web-security',
            '--disable-dev-shm-usage',
            '--no-sandbox'
          ]
        }
      },
    },
  ],
}); 