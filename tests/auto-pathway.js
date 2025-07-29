/**
 * AUTO PATHWAY TO FRESH EDITOR
 * 
 * Execute this in browser console or via MCP to automatically:
 * 1. Register new user
 * 2. Create new script  
 * 3. Enter editor
 * 
 * Then AI has manual control in editor!
 */

window.autoPathwayToEditor = async function() {
  console.log('🚀 AUTO PATHWAY: Starting...');
  
  try {
    // Create unique user
    const timestamp = Date.now();
    const shortId = timestamp.toString().slice(-8);
    const user = {
      email: `autouser${timestamp}@example.com`,
      username: `auto${shortId}`,
      password: 'Test123@Pass!'
    };
    
    console.log(`👤 Creating user: ${user.username}`);
    
    // Step 1: Go to registration if needed
    if (window.location.pathname === '/' && document.querySelector('input[type="email"]')) {
      const registerBtn = document.querySelector('button:contains("Go to Register"), a[href*="register"]');
      if (registerBtn) {
        registerBtn.click();
        await new Promise(r => setTimeout(r, 800));
      }
    }
    
    // Step 2: Fill and submit registration
    const emailInput = document.querySelector('input[type="email"]');
    const usernameInput = document.querySelector('input[name="username"], input[placeholder*="username" i]');
    const passwordInput = document.querySelector('input[type="password"]');
    
    if (emailInput && usernameInput && passwordInput) {
      emailInput.value = user.email;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      usernameInput.value = user.username;
      usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      passwordInput.value = user.password;
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      const registerBtn = document.querySelector('button[type="submit"], button:contains("Register")');
      if (registerBtn) {
        registerBtn.click();
        console.log('✅ Registration submitted');
        await new Promise(r => setTimeout(r, 3000)); // Wait for login
      }
    }
    
    // Step 3: Create new script
    console.log('📄 Creating new script...');
    const addBtn = document.querySelector('[class*="addIcon"], div:contains("+"):visible');
    if (addBtn) {
      addBtn.click();
      await new Promise(r => setTimeout(r, 800));
      
      const createBtn = document.querySelector('button:contains("Create New Script")');
      if (createBtn) {
        createBtn.click();
        await new Promise(r => setTimeout(r, 800));
        
        const nameInput = document.querySelector('input[placeholder*="script" i], input[type="text"]:visible');
        if (nameInput) {
          const scriptName = `Auto Script ${shortId}`;
          nameInput.value = scriptName;
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          
          const finalCreateBtn = document.querySelector('button:contains("Create"):not(:contains("New"))');
          if (finalCreateBtn) {
            finalCreateBtn.click();
            console.log(`✅ Script created: ${scriptName}`);
            await new Promise(r => setTimeout(r, 1000));
            
            // Step 4: Enter editor
            const scriptElement = document.querySelector(`[class*="scriptPage"], h3:contains("${scriptName}")`);
            if (scriptElement) {
              scriptElement.click();
              console.log('✅ Entering editor...');
              await new Promise(r => setTimeout(r, 2000));
              
              console.log('🎯 AUTO PATHWAY COMPLETE!');
              console.log('👤 User:', user.username);
              console.log('📄 Script:', scriptName);
              console.log('✏️ Fresh editor ready for manual AI control!');
              
              return { success: true, user, scriptName };
            }
          }
        }
      }
    }
    
    throw new Error('Pathway failed at some step');
    
  } catch (error) {
    console.error('❌ Auto pathway failed:', error);
    return { success: false, error: error.message };
  }
};

// Auto-execute if loaded directly
if (typeof window !== 'undefined') {
  console.log('🔧 Auto-pathway function loaded! Call: autoPathwayToEditor()');
} 