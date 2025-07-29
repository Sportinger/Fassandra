# 🚀 CLAUDE CODE ULTRA-FAST PATHWAY

## Schritt 1: Browser öffnen
```javascript
// Standard MCP Playwright Tool (sollte in Claude Code funktionieren):
await mcp_playwright_browser_navigate({
  "url": "https://192.168.2.111:8080"
});
```

## Schritt 2: Ultra-Fast Script ausführen
```javascript
// Standard MCP Browser Evaluate:
await mcp_playwright_browser_evaluate({
  "function": `async () => {
    const t=Date.now();
    const u=\`m\${t}\`;
    const e=\`\${u}@t.co\`;
    const p='Test123@Pass!';
    const s=\`S\${t.toString().slice(-6)}\`;
    
    const wait = ms => new Promise(r => setTimeout(r, ms));
    
    const setValue = (input, value) => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 
        "value"
      ).set;
      nativeInputValueSetter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    
    // Check if we need to logout first
    if (document.querySelector('.scriptList')) {
      console.log('Already logged in, need to logout first');
      const menuBtn = document.querySelector('button[aria-label="☰"]') || 
                      Array.from(document.querySelectorAll('button')).find(b => b.textContent === '☰');
      if (menuBtn) {
        menuBtn.click();
        await wait(300);
        const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent.includes('Logout') || b.textContent.includes('Sign Out')
        );
        if (logoutBtn) {
          logoutBtn.click();
          await wait(1000);
        }
      }
    }
    
    // Go to register if needed
    await wait(300);
    if (document.querySelector('input[type="email"]')) {
      const registerBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.includes('Register')
      );
      if (registerBtn) {
        registerBtn.click();
        await wait(600);
      }
    }
    
    // Register
    await wait(300);
    setValue(document.querySelector('input[type="email"]'), e);
    setValue(document.querySelector('input[name="username"]') || 
            document.querySelector('input[placeholder*="sername"]'), u);  
    setValue(document.querySelector('input[type="password"]'), p);
    await wait(300);
    
    const submitBtn = document.querySelector('button[type="submit"]') || 
                     Array.from(document.querySelectorAll('button')).find(b => 
                       b.textContent === 'Register');
    submitBtn.click();
    
    // Create script
    await wait(2500);
    const addBtn = document.querySelector('[class*="addIcon"]') ||
                   Array.from(document.querySelectorAll('div')).find(d => 
                     d.textContent.trim() === '+');
    addBtn.click();
    
    await wait(600);
    Array.from(document.querySelectorAll('button')).find(b => 
      b.textContent.includes('Create New Script')
    ).click();
    
    await wait(600);
    setValue(document.querySelector('input[type="text"]'), s);
    
    await wait(300);
    Array.from(document.querySelectorAll('button')).find(b => 
      b.textContent === 'Create' && !b.textContent.includes('New')
    ).click();
    
    // Enter editor
    await wait(1000);
    const scriptEl = Array.from(document.querySelectorAll('h3')).find(h => 
      h.textContent.includes(s)
    ) || document.querySelector('[class*="scriptPage"]');
    scriptEl.click();
    
    await wait(2000);
    console.log('✅ Editor ready!', {user: u, script: s});
    return {ok: 1, user: u, script: s};
  }`
});
```

## Mögliche Tool-Namen Varianten:
- `browser_navigate` statt `mcp_playwright-test_browser_navigate`
- `browser_evaluate` statt `mcp_playwright-test_browser_evaluate`
- `playwright_navigate` statt `mcp_playwright-test_browser_navigate`
- `mcp_playwright_browser_navigate` statt `mcp_playwright-test_browser_navigate`

## Debugging in Claude Code:
```javascript
// 1. Liste verfügbare Tools auf:
"Zeige mir alle verfügbaren MCP Tools die mit 'browser' oder 'playwright' beginnen"

// 2. Teste ein einfaches Navigate:
await [TOOL_NAME]({ "url": "https://192.168.2.111:8080" });

// 3. Teste einfaches Evaluate:
await [TOOL_NAME]({ "function": "() => { return 'test'; }" });
```

## Copy-Paste für Claude Code:
```
Führe diese 2 MCP Befehle aus:

1. Navigiere zu: https://192.168.2.111:8080

2. Führe dieses JavaScript aus: [DER KOMPLETTE ULTRA-FAST SCRIPT VON OBEN]

Das sollte automatisch einen User registrieren, ein Script erstellen und den Editor öffnen.
``` 