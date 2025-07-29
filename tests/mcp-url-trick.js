// URL TRICK - Navigate with special parameter that triggers auto-setup
// This would require frontend changes to detect and execute

// Example usage:
// await browser_navigate('https://192.168.2.111:8080/?auto-setup=true');

// The frontend would need to add this code:
if (new URLSearchParams(window.location.search).get('auto-setup') === 'true') {
  // Auto execute the fast-to-editor workflow
  // This runs IN the page, not via MCP evaluate
} 