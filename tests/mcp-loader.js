// MCP LOADER - Loads external script file
async () => {
  // Load the script from file system via fetch
  const response = await fetch('/tests/mcp-ultra-fast.js');
  const scriptText = await response.text();
  
  // Create and execute
  const script = new Function(scriptText);
  return await script();
} 