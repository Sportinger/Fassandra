const { test } = require('@playwright/test');

test('Ultra-fast registration and editor setup', async ({ page }) => {
  // Since browser is already open at the URL, we'll just execute the script
  console.log('Executing ultra-fast registration and editor setup...');
  
  const result = await page.evaluate(async () => {
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
  });
  
  console.log('Test completed with result:', result);
  
  // Keep browser open by adding a long wait
  await page.waitForTimeout(300000); // 5 minutes
});