// MINIMAL - Under 1KB for instant load
async()=>{
const t=Date.now(),u=`m${t}`,s=`S${t%1000000}`;
const w=m=>new Promise(r=>setTimeout(r,m));
const v=(i,x)=>{i.value=x;i.dispatchEvent(new Event('input',{bubbles:1}))};
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));

// Logout if needed
if($('.scriptList')){
  $$('button').find(b=>b.textContent==='☰').click();
  await w(300);
  $$('button').find(b=>b.textContent.match(/Logout|Sign Out/)).click();
  await w(1000);
}

// Register
$$('button').find(b=>b.textContent.match(/Register/))?.click();
await w(600);
v($('[type="email"]'),u+'@t.co');
v($('[name="username"]'),u);
v($('[type="password"]'),'Test123@Pass!');
await w(300);
$$('button').find(b=>b.textContent==='Register').click();

// Script
await w(2500);
$$('div').find(d=>d.textContent.trim()==='+').click();
await w(600);
$$('button').find(b=>b.textContent.match(/Create New/)).click();
await w(600);
v($('[type="text"]'),s);
await w(300);
$$('button').find(b=>b.textContent==='Create').click();

// Editor
await w(1000);
$$('h3').find(h=>h.textContent.includes(s)).click();
await w(2000);
return{u,s};
} 