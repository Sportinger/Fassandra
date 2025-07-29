# 🚀 ONE COMMAND TO EDITOR

## Der MCP Befehl:

```javascript
// 1. Lade das Script
const scriptContent = fs.readFileSync('/home/admins/projects/pessoa/tests/mcp-fast-to-editor.js', 'utf8');

// 2. Führe es aus - EIN BEFEHL!
await mcp_playwright_browser_evaluate(scriptContent + '; mcpFastToEditor();');
```

## Was passiert automatisch:
1. ✅ Navigiert zur App
2. ✅ Registriert neuen User
3. ✅ Erstellt neues Script  
4. ✅ Öffnet den Editor
5. ⏸️ **STOPPT** - Browser bleibt offen!

## Danach kannst du:
```javascript
// Manuell im Editor arbeiten mit MCP:
await mcp_playwright_browser_type('Mein Text...');
await mcp_playwright_browser_click('Bold button');
// etc...
```

## Zeitdauer:
- **~10-15 Sekunden** bis Editor ready
- Dann volle manuelle Kontrolle! 