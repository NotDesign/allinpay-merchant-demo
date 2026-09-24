const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.EXTERNAL_URL||'http://127.0.0.1:4321/external.html';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 const click=a=>page.locator('[data-action="'+a+'"]').first().click();
 const email='merchant.account.with.a.very.long.name.for.layout.testing@example.com';
 await page.goto(base+'#/login');await page.locator('[data-field="authEmail"]').fill(email);await click('login');
 await page.waitForSelector('[data-otp]');for(let i=0;i<6;i++)await page.locator('[data-otp="'+i+'"]').fill(String(i+1));await click('verify');await page.waitForSelector('.header');
 assert.equal(await page.locator('.header .email').getAttribute('title'),email);
 for(const width of [1920,1440,1024,900,768,700,390,320]){
  await page.setViewportSize({width,height:900});
  for(const route of ['applications','form/1','review']){
   await page.evaluate(r=>location.hash='/'+r,route);await page.waitForFunction(r=>location.hash==='#/'+r,route);
   await page.waitForSelector(route==='applications'?'.cards':route==='review'?'.review':'.application');
   const geometry=await page.locator('.header').evaluate(header=>{
    const h=header.getBoundingClientRect(),els=[...header.querySelectorAll('.brand,.header-actions>select,.header-actions>.email,.header-actions>button')].filter(n=>getComputedStyle(n).display!=='none');
    const r=els.map(n=>({left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom}));
    return {contained:r.every(b=>b.left>=h.left&&b.right<=h.right&&b.top>=h.top&&b.bottom<=h.bottom),overlap:r.some((a,i)=>r.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)),buttons:[...header.querySelectorAll('.header-actions>button')].map(n=>{const range=document.createRange();range.selectNodeContents(n);return {text:n.textContent,lines:range.getClientRects().length,height:n.getBoundingClientRect().height,overflow:n.scrollWidth>n.clientWidth};}),headerOverflow:header.scrollWidth>header.clientWidth};
   });
   assert(geometry.contained,width+' '+route+' header content clipped');assert(!geometry.overlap,width+' '+route+' overlapping controls');assert(!geometry.headerOverflow,width+' '+route+' header overflow');
   for(const b of geometry.buttons){assert.equal(b.lines,1,width+' '+route+' wrapped '+b.text);assert.equal(b.height,40);assert.equal(b.overflow,false);}
   if(route==='applications')await page.locator('.header').screenshot({path:'qa-external-header-'+width+'.png'});
  }
 }
 checks.push('1920/1440/1024/900/768/700/390/320 widths across applications, form and review: no header overflow, overlap or wrapped button labels');
 await page.setViewportSize({width:1440,height:900});await page.locator('.header [data-action="home"]').click();await page.waitForSelector('.cards');await click('new');await page.waitForSelector('.application');
 await page.locator('[data-field="companyZh"]').fill('Header layout demo');await click('save');assert.equal(await page.locator('#modal-title').innerText(),'草稿儲存成功');await page.locator('#modal [data-action="close"]').first().click();
 await page.locator('.header [data-action="home"]').click();await page.waitForSelector('.cards');assert((await page.locator('.cards').innerText()).includes('Header layout demo'));
 await page.locator('.header [data-action="logout"]').click();await page.locator('#modal [data-action="close"]').first().click();assert.equal(await page.locator('.header').count(),1);
 await page.locator('.header [data-action="logout"]').click();await click('confirm-logout');await page.waitForSelector('#auth-form');assert.equal(await page.locator('.header').count(),0);
 checks.push('Email OTP login, draft save, My Applications, logout cancel and confirmed logout retain their behavior');
 assert.deepEqual(errors,[]);await browser.close();const result={passed:true,url:base,date:new Date().toISOString(),checks,errors};fs.writeFileSync('qa-external-header-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
