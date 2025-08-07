# Playwright MCP Setup for Cursor - Automated Testing & QA

This guide shows you how to set up Playwright MCP (Model Context Protocol) with Cursor for automated testing and quality assurance of your Pessoa application.

## 🚀 Quick Start

### 1. Installation Complete ✅
- ✅ Playwright MCP v0.0.29 installed
- ✅ Playwright browsers installed
- ✅ System dependencies installed  
- ✅ Test configuration created

### 2. MCP Server Configuration

You now have two MCP servers configured:

#### **playwright-vision** (For UI Iteration)
- **Use for**: UI improvements, visual testing, design iteration
- **Features**: Can see and analyze UI screenshots
- **Best for**: "Make the UI look better" type tasks

#### **playwright-test** (For Automated Testing)  
- **Use for**: Precise testing, element interaction, form testing
- **Features**: Accurate element selection and interaction
- **Best for**: Login flows, form validation, functional testing

### 3. Cursor MCP Setup

Add this to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "playwright-vision": {
      "command": "npx",
      "args": [
        "@playwright/mcp@0.0.29",
        "--config=playwright.config.js",
        "--vision"
      ]
    },
    "playwright-test": {
      "command": "npx",
      "args": [
        "@playwright/mcp@0.0.29",
        "--config=playwright.config.js"
      ]
    }
  }
}
```

## 📝 Usage Examples

### UI Iteration Workflow

1. **Enable the `playwright-vision` MCP server**
2. **Use this prompt:**

```
Please use playwright MCP to view the UI. Identify areas to improve for UI and iterate it until it looks perfect. Make sure the width of browser in MCP to be 700 pixel.
```

**What happens:**
- Opens browser at 700px width
- Takes screenshot of current UI
- Analyzes design and suggests improvements
- Makes code changes to improve UI
- Repeats until UI looks perfect

### Automated Testing Workflow

1. **Enable the `playwright-test` MCP server**
2. **Use this prompt:**

```
Now let's test application using the playwright MCP. First let's test if you can login successfully and then test if users can successfully add scripts and mark things as completed.
```

**What happens:**
- Opens browser and navigates to your app
- Tests login functionality
- Tests script creation and management
- Tests editor functionality
- Validates all user flows work correctly

### Creating Reusable Tests

After successful testing, use this prompt:

```
Now let's create a reusable playwright UI test based on the flow above so I can run as automated test every time.
```

**What happens:**
- Generates actual Playwright test files
- Creates test scripts in `/tests` directory
- Sets up CI/CD integration
- Allows running tests manually anytime

## 🛠 Manual Testing Commands

```bash
# Run all tests
npm run test:e2e

# Run tests with UI (visual test runner)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug tests step by step
npm run test:e2e:debug

# Generate new test code
npm run playwright:codegen

# Run MCP servers manually
npm run mcp:vision     # With vision
npm run mcp:test       # Without vision
```

## 🎯 Testing Scenarios Covered

### Authentication Flow
- User registration
- Login/logout
- Password reset
- Session management

### Script Management
- Create new scripts
- Edit script titles
- Delete scripts
- Share scripts
- Script permissions

### Editor Functionality
- Text editing
- Formatting options
- Real-time collaboration
- Auto-save functionality
- Page breaks and layouts

### UI/UX Testing
- Responsive design (mobile, tablet, desktop)
- Accessibility checks
- Error handling
- Loading states
- Navigation flows

## 📁 File Structure

```
pessoa/
├── playwright.config.js          # Playwright configuration
├── mcp.json                      # MCP server configuration
├── tests/
│   └── example.spec.js          # Example test file
├── .cursorrules                 # Updated with MCP instructions
└── PLAYWRIGHT_MCP_README.md    # This file
```

## ⚙️ Configuration Details

### Playwright Configuration Features
- **Anti-bot detection bypass**: Custom user agents, headers
- **Multi-browser support**: Chrome, Firefox, Safari, Mobile
- **Screenshot/video recording**: For debugging failures
- **Parallel test execution**: Faster test runs
- **Automatic retry**: On test failures

### MCP Server Arguments
- `--config=playwright.config.js`: Uses our custom config
- `--vision`: Enables AI to see and analyze UI screenshots
- Browser viewport: Automatically set to 700px for better visibility

## 🔧 Troubleshooting

### Common Issues

1. **Browser not opening**
   ```bash
   npx playwright install
   sudo npx playwright install-deps
   ```

2. **Permission errors**
   ```bash
   sudo chown -R $USER:$USER node_modules
   ```

3. **MCP server not connecting**
   - Check if Cursor has the MCP configuration
   - Restart Cursor after adding MCP servers
   - Only enable one MCP server at a time

4. **Tests failing**
   - Make sure your app is running on `http://localhost:3000`
   - Check if elements exist with updated selectors
   - Use `--headed` mode to see what's happening

## 🚀 Advanced Usage

### Custom Test Creation

You can create custom tests for specific scenarios:

```javascript
test('should handle complex user flow', async ({ page }) => {
  // Your custom test logic
  await page.goto('/');
  await page.setViewportSize({ width: 700, height: 800 });
  // ... rest of your test
});
```

### CI/CD Integration

The generated tests include GitHub Actions configuration for:
- Running tests on every pull request
- Preventing deployment if tests fail
- Automated test reports

### Performance Testing

Add performance metrics to your tests:

```javascript
test('should load page within 2 seconds', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/');
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(2000);
});
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright MCP GitHub](https://github.com/microsoft/playwright-mcp)
- [Cursor MCP Documentation](https://docs.cursor.com/features/mcp)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)

## 🎉 Next Steps

1. **Start with UI iteration**: Use `playwright-vision` to improve your UI
2. **Create comprehensive tests**: Use `playwright-test` for functional testing
3. **Set up CI/CD**: Integrate tests into your deployment pipeline
4. **Monitor and maintain**: Keep tests updated as your app evolves

Your Playwright MCP setup is now ready! You can start using Cursor as your automated QA assistant. 🚀 