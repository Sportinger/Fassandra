# Playwright MCP Service Patterns

This directory contains practical code examples and reusable patterns for using Playwright MCP services effectively. These patterns are based on testing results and demonstrate best practices for common automation tasks.

## Pattern Categories

1. **Authentication & Session Management** - Login flows, session handling, logout procedures
2. **Form Handling** - Form filling, validation, submission patterns  
3. **Navigation & Routing** - Page navigation, URL handling, route testing
4. **Data Extraction** - Content scraping, data validation, information gathering
5. **Interactive Elements** - Dropdowns, modals, dynamic content handling
6. **Error Handling & Recovery** - Robust error handling, retry mechanisms
7. **Performance & Optimization** - Fast execution patterns, resource management

## Quick Start

```javascript
// Import pattern utilities
const { AuthPattern } = require('./patterns/AuthPattern');
const { FormPattern } = require('./patterns/FormPattern');

// Use patterns in your automation
const auth = new AuthPattern();
await auth.loginWithCredentials(email, password);

const form = new FormPattern();
await form.fillAndSubmit(formData);
```

## Available MCP Tools

The patterns use these Playwright MCP tools:
- `mcp__playwright__browser_navigate` - Navigate to URLs
- `mcp__playwright__browser_snapshot` - Get page state
- `mcp__playwright__browser_click` - Click elements  
- `mcp__playwright__browser_type` - Type text
- `mcp__playwright__browser_evaluate` - Execute JavaScript
- `mcp__playwright__browser_take_screenshot` - Capture screenshots
- `mcp__playwright__browser_wait_for` - Wait for conditions
- `mcp__playwright__browser_select_option` - Select dropdown options

## Pattern Files

- `AuthPattern.js` - Authentication and session management
- `FormPattern.js` - Form handling and validation
- `NavigationPattern.js` - Page navigation and routing  
- `DataExtractorPattern.js` - Content extraction and validation
- `ElementPattern.js` - Interactive element handling
- `ErrorPattern.js` - Error handling and recovery
- `PerformancePattern.js` - Optimization and speed patterns