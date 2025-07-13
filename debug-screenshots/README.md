# 📸 Playwright Vision Debug Screenshots

## 🎯 **Quick Overview**

This folder contains **organized screenshots** from Playwright Vision (MCP) and regular Playwright tests for debugging the Pessoa theater collaboration platform.

## 📁 **Folder Structure**

```
debug-screenshots/
├── mcp-vision/              # Screenshots from MCP Playwright Vision
│   ├── 2025-07-13/         # Daily session folders
│   │   ├── 01-login.png    # Numbered screenshots with descriptions
│   │   ├── 02-dashboard.png
│   │   └── debug-report.json
│   └── [other-dates]/
└── playwright-tests/        # Screenshots from regular Playwright tests
    ├── test-results/
    └── videos/
```

## 🚀 **Using MCP Playwright Vision for Debugging**

### **Basic Commands:**

```bash
# Navigate to Pessoa app
mcp_playwright-test_browser_navigate url="https://192.168.2.111:8443/"

# Take a screenshot (auto-saves to mcp-vision folder)
mcp_playwright-test_browser_snapshot

# Resize for mobile debugging  
mcp_playwright-test_browser_resize width=700 height=900

# Take another screenshot after action
mcp_playwright-test_browser_click element="login button"
mcp_playwright-test_browser_snapshot
```

### **Complete Debug Workflow:**

```bash
# 1. Start debugging session
mcp_playwright-test_browser_navigate url="https://192.168.2.111:8443/"
mcp_playwright-test_browser_snapshot  # 01-initial-load.png

# 2. Test login
mcp_playwright-test_browser_type element="email input" text="a@b.c"
mcp_playwright-test_browser_snapshot  # 02-email-entered.png

mcp_playwright-test_browser_click element="login button"  
mcp_playwright-test_browser_snapshot  # 03-after-login.png

# 3. Test script creation
mcp_playwright-test_browser_click element="new script button"
mcp_playwright-test_browser_snapshot  # 04-new-script-dialog.png

# 4. Verify database changes
mcp_database_execute_query connection_name="pessoa_db" query="SELECT * FROM scripts ORDER BY created_at DESC LIMIT 1;"
```

## 🔍 **Debugging Benefits**

### **Visual Debugging:**
- **See exactly what the browser sees** during automation
- **Catch UI issues** that aren't obvious in code
- **Verify responsive design** across different screen sizes
- **Debug complex user flows** step by step

### **Organized Screenshots:**
- **Daily folders** keep sessions separate
- **Numbered files** show exact sequence
- **Descriptive names** make issues easy to find
- **Automatic organization** via MCP Vision

### **Combined with Database Verification:**
- **Take screenshot** → **Check database** → **Verify data persistence**
- **Visual confirmation** that UI actions actually save data
- **Catch timing issues** between frontend and backend

## 🎭 **Pessoa-Specific Debug Scenarios**

### **1. Login Flow Debug:**
```bash
# Navigate and capture login page
mcp_playwright-test_browser_navigate url="https://192.168.2.111:8443/"
mcp_playwright-test_browser_snapshot

# Test login and capture result
mcp_playwright-test_browser_type element="input[type='email']" text="a@b.c"
mcp_playwright-test_browser_click element="button[type='submit']"
mcp_playwright-test_browser_snapshot

# Verify in database
mcp_database_execute_query connection_name="pessoa_db" query="SELECT email, last_login FROM users WHERE email = 'a@b.c';"
```

### **2. Script Creation Debug:**
```bash
# Create new script and capture each step
mcp_playwright-test_browser_click element="[data-testid='new-script']"
mcp_playwright-test_browser_snapshot

mcp_playwright-test_browser_type element="input[name='title']" text="Debug Test Script"
mcp_playwright-test_browser_snapshot

mcp_playwright-test_browser_click element="button[type='submit']"
mcp_playwright-test_browser_snapshot

# Verify script was created
mcp_database_execute_query connection_name="pessoa_db" query="SELECT id, title, created_at FROM scripts WHERE title = 'Debug Test Script';"
```

### **3. Editor Content Debug:**
```bash
# Test content input and real-time collaboration
mcp_playwright-test_browser_type element=".editor-content" text="HAMLET: To be or not to be..."
mcp_playwright-test_browser_snapshot

# Check if content persisted
mcp_database_execute_query connection_name="pessoa_db" query="SELECT script_id, content FROM blocks ORDER BY created_at DESC LIMIT 1;"

# Check WebSocket activity
mcp_database_execute_query connection_name="pessoa_db" query="SELECT script_id, user_id, created_at FROM yjs_document_updates ORDER BY created_at DESC LIMIT 5;"
```

## 📊 **Screenshot Analysis Tips**

### **What to Look For:**
- **Loading states** - Are spinners showing?
- **Error messages** - Any red text or alerts?
- **Form validation** - Are required fields highlighted?
- **Mobile responsiveness** - Does layout break at 700px width?
- **Authentication state** - Is user logged in/out correctly?

### **Common Issues to Debug:**
- **Login redirect loops**
- **Missing form data after submission**  
- **Editor content not saving**
- **WebSocket connection failures**
- **Mobile layout problems**

## 🛠️ **Advanced Debugging**

### **Console Monitoring:**
```bash
# Capture screenshot + console logs
mcp_playwright-test_browser_snapshot
mcp_playwright-test_browser_console_messages
```

### **Network Request Monitoring:**
```bash
# Monitor API calls during actions
mcp_playwright-test_browser_network_requests
mcp_playwright-test_browser_snapshot
```

### **Error State Debugging:**
```bash
# Deliberately trigger errors and capture
mcp_playwright-test_browser_type element="input[type='email']" text="invalid-email"
mcp_playwright-test_browser_click element="submit"
mcp_playwright-test_browser_snapshot  # Should show validation error
```

## 🎯 **Integration with Code Reviews**

### **For Pull Requests:**
1. **Run debug workflow** on new features
2. **Capture screenshots** of before/after states  
3. **Include database queries** showing data changes
4. **Attach screenshots** to PR comments for visual verification

### **For Bug Reports:**
1. **Reproduce bug** with MCP Vision
2. **Capture exact sequence** leading to failure
3. **Include database state** at time of failure
4. **Provide visual evidence** for developers

---

## 💡 **Pro Tips**

- **Use descriptive text** when taking screenshots: `mcp_playwright-test_browser_snapshot element="login form after error"`
- **Combine with database queries** for complete verification
- **Test at mobile width (700px)** for responsive issues
- **Capture both success and error states**
- **Use console monitoring** for JavaScript errors
- **Archive old sessions** periodically to save space

**Screenshots are automatically organized by date - just focus on debugging!** 🚀 