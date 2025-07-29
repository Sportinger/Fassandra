# 🚀 SIMPLE AUTO-PATHWAY TO FRESH EDITOR

**Schneller Weg zum Editor mit MCP Playwright-Befehlen**

## Step-by-Step Commands:

### 1. Navigate to App
```
mcp_playwright-test_browser_navigate: https://192.168.2.111:8080
```

### 2. Go to Registration (if on login page)
```
mcp_playwright-test_browser_click: "Go to Register" button
```

### 3. Fill Registration Form
```
mcp_playwright-test_browser_type: Email textbox → "autouser[timestamp]@example.com"
mcp_playwright-test_browser_type: Username textbox → "auto[shortid]"  
mcp_playwright-test_browser_type: Password textbox → "Test123@Pass!"
mcp_playwright-test_browser_click: "Register" button
```

### 4. Create New Script
```
mcp_playwright-test_browser_click: "+" button
mcp_playwright-test_browser_click: "Create New Script" button
mcp_playwright-test_browser_type: Script name textbox → "Auto Script [id]"
mcp_playwright-test_browser_click: "Create" button
```

### 5. Enter Editor
```
mcp_playwright-test_browser_click: Script name/heading
```

## 🎯 Result:
- **Fresh Editor Ready**
- **~1-2 minutes to complete**
- **AI has manual MCP control**

## Usage:
AI executes these commands in sequence, then has full manual control in editor! 