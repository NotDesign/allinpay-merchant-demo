const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const base=process.env.DEMO_URL||'http://127.0.0.1:4321/backoffice.html',key='allinpay-backoffice-20260923-v1';
 const click=a=>p.locator('[data-action="'+a+'"]').first().click();
 const close=()=>p.locator('#modal [data-action="close"]').first().click();
 const data=()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)).rows,key);
 const row=id=>p.locator('.merchants tbody tr').filter({has:p.locator('[data-select="'+id+'"]')});
 await p.goto(base);await click('pick-role');await click('bo-login');await p.evaluate(()=>location.hash='/merchants');await p.waitForSelector('.merchants');
 for(const status of ['Draft','MoreInfo','Pending','Approved','Syncing','AwaitingResponse','SyncFailed','assigned'])assert(await p.locator('.merchants [data-mid-state="'+status+'"]').count(),status+' must be represented on the first demo page');
 let rows=await data();assert.equal(new Set(rows.map(r=>r.id)).size,240);assert(rows.filter(r=>!r['公司 MID']).length>100);
 assert.equal(rows.find(r=>r.id==='M000412')['公司 MID'],'');
 await row('M000412').locator('[data-action="sync"]').click();await close();
 assert.equal((await data()).find(r=>r.id==='M000412')['公司 MID'],'');
 await p.reload();await p.waitForSelector('.merchants');assert.equal(await row('M000412').locator('[data-mid-state="Syncing"]').innerText(),'處理中');
 assert.equal(await row('M000412').locator('[data-action="sync"]').count(),0,'Pending sync cannot be submitted again');
 await row('M000412').locator('[data-action="mid-check"]').click();await click('mid-demo-wait');await close();
 assert.equal(await row('M000412').locator('[data-mid-state="AwaitingResponse"]').innerText(),'等待回應');
 await row('M000412').locator('[data-action="mid-check"]').click();await click('mid-demo-fail');await close();
 assert.equal((await data()).find(r=>r.id==='M000412')['公司 MID'],'');
 await row('M000412').locator('[data-action="sync"]').click();await click('mid-demo-success');await close();
 const mid=(await data()).find(r=>r.id==='M000412')['公司 MID'];assert.match(mid,/^M[0-9A-F]{12}$/);
 await row('M000412').locator('[data-action="detail"]').click();assert((await p.locator('.profile-summary').innerText()).includes(mid));await close();
 await row('M000531').locator('[data-action="detail"]').click();assert((await p.locator('.profile-summary').innerText()).includes('待審核'));assert(!(await p.locator('.profile-summary').innerText()).includes('M000531'));await close();
 await p.locator('#search-scope').selectOption('公司 MID');await p.locator('#merchant-search').fill(mid);await click('search');assert.equal(await p.locator('.merchants tbody tr').count(),1);await click('reset-search');
 const download=p.waitForEvent('download');await click('export-merchants');const csv=await fs.readFile(await (await download).path(),'utf8');assert(csv.includes('MID 狀態'));assert(csv.includes(mid));assert(!csv.includes('M000531'),'CSV must not export internal IDs as MID');
 await p.locator('#search-scope').selectOption('公司 MID');await p.locator('#merchant-search').fill('等待回應');await click('search');assert(await p.locator('[data-mid-state="AwaitingResponse"]').count());await click('reset-search');
 // Upgrade a previous demo snapshot in place, preserving edits and drafts.
 await p.evaluate(k=>{const d=JSON.parse(localStorage.getItem(k));for(const r of d.rows){if(r.id==='M000531'){r['公司 MID']=r.id;r['客戶中文名稱']='保留的商戶修改';delete r.id;}if(r.id==='M000826'){r.id='M123456789';r['公司 MID']=r.id;r.application={values:{merchantName:'舊版已提交申請'}};}}localStorage.setItem(k,JSON.stringify(d));},key);
 await p.reload();await p.waitForSelector('.merchants');assert((await row('M000531').innerText()).includes('保留的商戶修改'));assert.equal(await row('M000531').locator('[data-mid-state="Pending"]').innerText(),'待審核');
 const legacy=(await data()).find(r=>r.id==='M123456789');
 // Migration runs on read; saving a demo action persists it without replacing the application.
 await row('M123456789').locator('[data-action="detail"]').click();assert((await p.locator('.profile-summary').innerText()).includes('待審核'));await close();
 assert.equal(await row('M123456789').locator('[data-mid-state="Pending"]').innerText(),'待審核');assert.equal(legacy.application.values.merchantName,'舊版已提交申請');
 await p.locator('[data-action="column-menu"][data-col="公司 MID"]').click();await click('column-freeze');
 await p.locator('.table-wrap').evaluate(e=>e.scrollLeft=500);await p.screenshot({path:'qa-excel-freeze-mid.png'});
 for(const width of [1440,768,390]){await p.setViewportSize({width,height:1000});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.deepEqual(errors,[]);console.log('PASS: nullable MID, stable identity, migration, async demo response, retry, reload, detail, search, CSV and responsive freeze.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
