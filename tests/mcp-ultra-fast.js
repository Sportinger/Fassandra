// ULTRA-FAST MCP TO EDITOR - Minimal code for speed
(async()=>{
const t=Date.now(),u=`m${t}`,e=`${u}@t.co`,p='Test123@Pass!',s=`S${t.toString().slice(-6)}`;
const w=m=>new Promise(r=>setTimeout(r,m));
const v=(i,x)=>{
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(i,x);
  i.dispatchEvent(new Event('input',{bubbles:true}));
};
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));

// Go to register if needed
if($('input[type="email"]')){
  const b=$$(('button')).find(x=>x.textContent.includes('Register'));
  if(b){b.click();await w(600);}
}

// Register
await w(300);
v($('input[type="email"]'),e);
v($('input[name="username"]')||$('input[placeholder*="sername"]'),u);  
v($('input[type="password"]'),p);
await w(300);
($('button[type="submit"]')||$$('button').find(x=>x.textContent==='Register')).click();

// Create script
await w(2500);
($('[class*="addIcon"]')||$$('div').find(x=>x.textContent.trim()==='+')).click();
await w(600);
$$('button').find(x=>x.textContent.includes('Create New Script')).click();
await w(600);
v($('input[type="text"]'),s);
await w(300);
$$('button').find(x=>x.textContent==='Create').click();

// Enter editor
await w(1000);
($$('h3').find(x=>x.textContent.includes(s))||$('[class*="scriptPage"]')).click();
await w(2000);

console.log('✅ Editor ready!',{user:u,script:s});
return{ok:1,u,s};
})() 🚀 ULTRA-FAST PATHWAY - EXAKTE CLAUDE CODE BEFEHLE

═══════════════════════════════════════════════════════

BEFEHL 1: Browser öffnen
═══════════════════════════════════════════════════════

mcp__playwright__browser_navigate

Parameter:
{
  "url": "https://192.168.2.111:8080"
}

═══════════════════════════════════════════════════════

BEFEHL 2: Ultra-Fast Script ausführen  
═══════════════════════════════════════════════════════

mcp__playwright__browser_evaluate

Parameter:
{
  "function": "async () => { const t=Date.now(); const u=`m${t}`; const e=`${u}@t.co`; const p='Test123@Pass!'; const s=`S${t.toString().slice(-6)}`; const wait = ms => new Promise(r => setTimeout(r, ms)); const setValue = (input, value) => { const nativeInputValueSetter = Object.getOwnPropertyDescriptor( window.HTMLInputElement.prototype, 'value' ).set; nativeInputValueSetter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }; if (document.querySelector('.scriptList')) { console.log('Already logged in, need to logout first'); const menuBtn = document.querySelector('button[aria-label=\"☰\"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent === '☰'); if (menuBtn) { menuBtn.click(); await wait(300); const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Logout') || b.textContent.includes('Sign Out') ); if (logoutBtn) { logoutBtn.click(); await wait(1000); } } } await wait(300); if (document.querySelector('input[type=\"email\"]')) { const registerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Register') ); if (registerBtn) { registerBtn.click(); await wait(600); } } await wait(300); setValue(document.querySelector('input[type=\"email\"]'), e); setValue(document.querySelector('input[name=\"username\"]') || document.querySelector('input[placeholder*=\"sername\"]'), u); setValue(document.querySelector('input[type=\"password\"]'), p); await wait(300); const submitBtn = document.querySelector('button[type=\"submit\"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Register'); submitBtn.click(); await wait(2500); const addBtn = document.querySelector('[class*=\"addIcon\"]') || Array.from(document.querySelectorAll('div')).find(d => d.textContent.trim() === '+'); addBtn.click(); await wait(600); Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create New Script') ).click(); await wait(600); setValue(document.querySelector('input[type=\"text\"]'), s); await wait(300); Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Create' && !b.textContent.includes('New') ).click(); await wait(1000); const scriptEl = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes(s) ) || document.querySelector('[class*=\"scriptPage\"]'); scriptEl.click(); await wait(2000); console.log('✅ Editor ready!', {user: u, script: s}); return {ok: 1, user: u, script: s}; }"
}

═══════════════════════════════════════════════════════

COPY-PASTE READY FÜR CLAUDE CODE:
═══════════════════════════════════════════════════════

Führe diese 2 MCP Befehle nacheinander aus:

1. Tool: mcp__playwright__browser_navigate
   URL: https://192.168.2.111:8080

2. Tool: mcp__playwright__browser_evaluate  
   Function: [DER KOMPLETTE JAVASCRIPT CODE VON OBEN]

Das wird automatisch:
✅ Einen neuen User registrieren
✅ Ein neues Script erstellen
✅ Den Editor öffnen
✅ Browser offen lassen für weitere Befehle

═══════════════════════════════════════════════════════

NACH DEM PATHWAY - WEITERE BEFEHLE:
═══════════════════════════════════════════════════════

mcp__playwright__browser_type - Text in Editor schreiben
mcp__playwright__browser_click - Video Cues hinzufügen  
mcp__playwright__browser_take_screenshot - Screenshots machen
mcp__playwright__browser_snapshot - Page Status prüfen