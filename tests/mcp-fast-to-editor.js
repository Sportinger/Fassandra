/**
 * MCP FAST-TO-EDITOR Script
 * 
 * Executes automatically via MCP evaluate to:
 * 1. Register new user
 * 2. Create script
 * 3. Enter editor
 * 4. STOP - leaves browser open for manual work
 */

async function fastToEditor() {
  console.log('🚀 MCP Fast-to-Editor starting...');
  
  const timestamp = Date.now();
  const shortId = timestamp.toString().slice(-8);
  const email = `mcp${timestamp}@example.com`;
  const username = `mcp${shortId}`;
  const password = 'Test123@Pass!';
  const scriptName = `MCP Script ${shortId}`;
  
  try {
    // Wait helper
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    
    // STEP 1: Navigate to registration if needed
    console.log('📍 Step 1: Checking current page...');
    if (window.location.pathname !== '/') {
      window.location.href = '/';
      await wait(1000);
    }
    
    // If on login page, go to register
    const loginForm = document.querySelector('input[type="email"]');
    if (loginForm) {
      const registerBtn = document.querySelector('button').textContent.includes('Go to Register') 
        ? document.querySelector('button:last-child')
        : null;
      if (registerBtn) {
        console.log('➡️ Navigating to register...');
        registerBtn.click();
        await wait(600);
      }
    }
    
    // STEP 2: Fill registration form
    console.log('📝 Step 2: Registering user:', username);
    const emailInput = document.querySelector('input[type="email"]');
    const usernameInput = document.querySelector('input[name="username"]') || 
                          document.querySelector('input[placeholder*="sername"]');
    const passwordInput = document.querySelector('input[type="password"]');
    
    if (emailInput && usernameInput && passwordInput) {
      // Use React-friendly value setting
      const setValue = (input, value) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 
          "value"
        ).set;
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      
      setValue(emailInput, email);
      setValue(usernameInput, username);
      setValue(passwordInput, password);
      
      await wait(300);
      
      // Submit registration
      const submitBtn = document.querySelector('button[type="submit"]') || 
                       Array.from(document.querySelectorAll('button')).find(b => 
                         b.textContent === 'Register');
      if (submitBtn) {
        submitBtn.click();
        console.log('✅ Registration submitted');
        await wait(2000); // Wait for login
      }
    }
    
    // STEP 3: Create new script
    console.log('📄 Step 3: Creating script...');
    await wait(600);
    
    // Find and click + button - more robust selector
    const addBtn = document.querySelector('[class*="addIcon"]') ||
                   document.querySelector('div:last-child') ||
                   Array.from(document.querySelectorAll('div')).find(d => 
                     d.textContent.trim() === '+'
                   );
    if (addBtn) {
      console.log('✅ Found + button, clicking...');
      addBtn.click();
      await wait(600);
      
      // Click Create New Script
      const createNewBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.includes('Create New Script')
      );
      if (createNewBtn) {
        createNewBtn.click();
        await wait(600);
        
        // Fill script name
        const nameInput = document.querySelector('input[type="text"]') ||
                         document.querySelector('input[placeholder*="script"]');
        if (nameInput) {
          const setValue = (input, value) => {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype, 
              "value"
            ).set;
            nativeInputValueSetter.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          };
          
          setValue(nameInput, scriptName);
          await wait(300);
          
          // Click Create
          const createBtn = Array.from(document.querySelectorAll('button')).find(b => 
            b.textContent === 'Create' && !b.textContent.includes('New')
          );
          if (createBtn) {
            createBtn.click();
            console.log('✅ Script created:', scriptName);
            await wait(1000);
          }
        }
      }
    }
    
    // STEP 4: Enter editor
    console.log('🎯 Step 4: Entering editor...');
    await wait(600);
    
    // Find and click the script - try multiple selectors
    const scriptElement = Array.from(document.querySelectorAll('h3')).find(h => 
      h.textContent.includes(scriptName)
    ) || document.querySelector('[class*="scriptPage"]');
    
    if (scriptElement) {
      console.log('✅ Found script, clicking to enter editor...');
      scriptElement.click();
      await wait(2000); // Wait for editor to load
      
      // Verify we're in editor
      const editor = document.querySelector('.ProseMirror') || 
                    document.querySelector('[contenteditable="true"]');
      
      if (editor) {
        console.log('✅ SUCCESS! Fresh editor ready!');
        console.log('📝 User:', username);
        console.log('📄 Script:', scriptName);
        console.log('✏️ Editor element:', editor);
        console.log('\n🎮 MCP manual control ready - browser stays open!');
        return { success: true, username, scriptName };
      }
    }
    
    throw new Error('Failed to reach editor');
    
  } catch (error) {
    console.error('❌ Fast-to-editor failed:', error);
    return { success: false, error: error.message };
  }
}

// Export for MCP
window.mcpFastToEditor = fastToEditor; 