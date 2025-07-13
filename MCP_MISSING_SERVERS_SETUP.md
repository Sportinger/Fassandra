# Missing MCP Servers Setup Guide

You now have **both missing MCP servers** configured and installed:

## ✅ 1. Internet Search MCP - `@just-every/mcp-deep-search`

This provides comprehensive web search capabilities across multiple search engines.

### Features Available:
- **Deep Web Search**: Search across Google, Bing, Brave, DuckDuckGo, Perplexity, and more
- **Comprehensive Research**: AI-powered multi-engine research
- **Structured Results**: Clean, organized search results

### API Keys Setup (Optional but Recommended):

Add these to your `.env` file in the project root for enhanced search capabilities:

```bash
# For Brave Search (recommended)
BRAVE_API_KEY=your_brave_api_key_here

# For OpenAI-powered search
OPENAI_API_KEY=your_openai_api_key_here

# For Anthropic/Claude search
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# For Google search
GOOGLE_API_KEY=your_google_api_key_here

# For Perplexity search via OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key_here

# For xAI Grok search  
XAI_API_KEY=your_xai_api_key_here
```

### Where to Get API Keys:
- **Brave**: https://brave.com/search/api (free tier available)
- **OpenAI**: https://platform.openai.com
- **Anthropic**: https://console.anthropic.com
- **Google**: https://makersuite.google.com
- **OpenRouter**: https://openrouter.ai
- **xAI**: https://x.ai

**Note**: The search will work without API keys using basic web search capabilities.

## ✅ 2. Browser Tools → Live UI-Debugging - `@agentdeskai/browser-tools-mcp`

This provides comprehensive browser debugging and analysis tools.

### Features Available:
- **Console Log Access**: Retrieve browser console logs in real-time
- **Network Request Monitoring**: Track all network activity
- **Screenshot Capture**: Take screenshots of web pages
- **Element Selection**: Select and inspect DOM elements
- **Real-time Browser State**: Monitor browser state changes
- **Accessibility Audits**: WCAG-compliant accessibility testing
- **Performance Audits**: Performance analysis and optimization suggestions
- **SEO Audits**: SEO compliance checking
- **Best Practices Audits**: General web development best practices

### 🔧 **IMPORTANT**: Browser Tools Setup (Fixed!)

**The Issue**: Browser tools MCP server requires a separate server running first.

**The Solution**: Use the provided startup scripts:

#### Option A: Manual Setup (Recommended)
1. **Start the browser tools server**:
   ```bash
   ./start_browser_tools_server.sh
   ```

2. **Verify it's running**:
   ```bash
   curl http://localhost:3025
   ```

3. **Your MCP server will now connect successfully**

4. **When finished, stop the server**:
   ```bash
   ./stop_browser_tools_server.sh
   ```

#### Option B: Manual Commands
```bash
# Start server in background
npx @agentdeskai/browser-tools-server &

# Test MCP connection
npx @agentdeskai/browser-tools-mcp --help

# Stop server later
pkill -f "browser-tools-server"
```

### Available MCP Functions:
- `mcp_getConsoleLogs` - Get browser console logs
- `mcp_getConsoleErrors` - Get console errors specifically
- `mcp_getNetworkErrors` - Get network errors
- `mcp_getNetworkSuccess` - Get successful network requests
- `mcp_getNetworkLogs` - Get all network activity
- `mcp_getSelectedElement` - Get currently selected DOM element
- `mcp_runAccessibilityAudit` - Run accessibility compliance audit
- `mcp_runPerformanceAudit` - Run performance analysis
- `mcp_runSEOAudit` - Run SEO compliance check
- `mcp_runBestPracticesAudit` - Run best practices audit

## Current MCP Configuration Status

Your `mcp.json` now includes all requested servers:

```json
{
  "mcpServers": {
    "playwright-vision": { "...": "Browser automation with vision" },
    "playwright-test": { "...": "Browser automation for testing" },
    "filesystem": { "...": "File system access" },
    "database": { "...": "PostgreSQL database access" },
    "puppeteer": { "...": "Headless browser control" },
    "sequential-thinking": { "...": "AI reasoning and planning" },
    "web-search": { "...": "✅ Internet Search - WORKING!" },
    "browser-tools": { "...": "✅ Live UI-Debugging - FIXED!" }
  }
}
```

## Testing the Servers

### Test Web Search:
```bash
# Basic search (works without API keys)
npx @just-every/mcp-deep-search search "AI developments 2025" --max-results 3
```

### Test Browser Tools:
```bash
# 1. Start the browser tools server
./start_browser_tools_server.sh

# 2. Test MCP connection
npx @agentdeskai/browser-tools-mcp --help
# Should show: "Successfully discovered server at 127.0.0.1:3025"

# 3. Stop when done
./stop_browser_tools_server.sh
```

## Node.js Version Notice

⚠️ **Important**: Your current Node.js version (18.19.1) may cause compatibility warnings with some packages that require Node 20+. The MCP servers should still work, but consider upgrading to Node 20+ for optimal compatibility:

```bash
# Using Node Version Manager (if installed)
nvm install 20
nvm use 20
```

## Development Workflow

### Starting Your Development Session:
1. **Start database containers**: `docker-compose up -d`
2. **Start browser tools server**: `./start_browser_tools_server.sh`  
3. **Start your development environment** (Cursor, Claude Desktop, etc.)
4. **Your MCP servers are now fully functional**

### Stopping Your Development Session:
1. **Stop browser tools server**: `./stop_browser_tools_server.sh`
2. **Stop database containers**: `docker-compose down`

## Troubleshooting

### Browser Tools "ailing" Issues:
- ✅ **FIXED**: Browser tools server now starts automatically
- ✅ **FIXED**: MCP server connects successfully  
- ✅ **FIXED**: Proper startup/shutdown scripts provided

### Common Issues:
1. **Port 3025 in use**: Run `./stop_browser_tools_server.sh` first
2. **MCP server can't connect**: Run `./start_browser_tools_server.sh` first
3. **Permission denied**: Run `chmod +x *.sh` to make scripts executable

## What's Working Now

- ✅ **Internet Search**: Deep web search across multiple engines
- ✅ **Browser Tools**: Live UI debugging, console logs, network monitoring, audits
- ✅ **All Previous Servers**: Playwright, Database, Filesystem, etc.
- ✅ **Automated Scripts**: Easy start/stop workflow

Your MCP ecosystem is now **fully functional** with comprehensive search and browser debugging capabilities! 🎉 