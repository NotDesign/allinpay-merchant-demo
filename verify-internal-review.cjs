const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.DEMO_URL||'http://127.0.0.1:4321/backoffice.html';
const out=process.env.QA_DIR||path.join(__dirname,'../work');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='darwin'?{executablePath:'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'}:{})});
 const context=await browser.newContext({viewport:{width:1600,height:1320}}),p=await context.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const click=async(a)=>p.locator(`[data-action="${a}"]`).first().click();
 const close=async()=>p.locator('#modal [data-action="close"]').first().click();
 const route=async(s)=>{await p.evaluate(s=>location.hash='/'+s,s);await p.waitForTimeout(100)};
 const store=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('allinpay-backoffice-20260923-v1')));
 const assertFill=async()=>{
  const boxes=await p.locator('.ir-approval').evaluate(e=>{
   const box=x=>{const r=x.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,right:r.right,height:r.height}};
   return{approval:box(e),note:box(e.querySelector('textarea')),actions:box(e.querySelector('.ir-actions')),buttons:[...e.querySelectorAll('.ir-actions button')].map(box)};
  });
  for(const b of [boxes.note,boxes.actions]){assert(Math.abs(b.x-boxes.approval.x)<1);assert(Math.abs(b.width-boxes.approval.width)<1);}
  const buttons=boxes.buttons;assert.equal(buttons.length,4);for(const b of buttons){assert(Math.abs(b.width-buttons[0].width)<1);assert.equal(b.height,buttons[0].height);}
  assert(Math.abs(buttons[0].x-boxes.actions.x)<1);assert(Math.abs(buttons.at(-1).right-boxes.actions.right)<1);
  if(p.viewportSize().width>1100)assert(buttons.every(b=>Math.abs(b.y-buttons[0].y)<1));
  else{assert.equal(buttons[0].y,buttons[1].y);assert.equal(buttons[2].y,buttons[3].y);assert(buttons[2].y>buttons[0].y);}
 };
 await p.goto(base+'#/login');await p.locator('[data-action="pick-role"][data-index="0"]').click();await click('bo-login');await p.waitForSelector('.metrics');
 await p.locator('a[href="#/internal-review"]').click();await p.waitForSelector('#ir-count');
 await assertFill();
 assert.equal(await p.locator('.ir-case .ir-badges').count(),5);assert.equal(await p.locator('.ir-case.selected .ir-badge.blue').count(),1);assert.equal(await p.locator('.ir-stage-badge.red').filter({hasText:'L3 終審'}).count(),1);assert(await p.locator('.ir-badge.green').count()>0);
 assert.equal(await p.locator('.ir-case').count(),5);assert(await p.locator('.ir-case.selected').count());
 const nav=await p.locator('a[href="#/internal-review"]').evaluate(e=>({sub:e.classList.contains('sub'),icon:e.querySelector('img').naturalWidth,next:e.nextElementSibling.className,prev:e.previousElementSibling.textContent}));assert(!nav.sub);assert(nav.icon>0);assert(nav.next.includes('nav-divider'));assert(nav.prev.includes('查閱更新'));
 await p.screenshot({path:path.join(out,'internal-review-desktop.png'),fullPage:true});
 const initialMid=await p.locator('.ir-case.selected').getAttribute('data-mid');const firstName=await p.locator('#ir-company').innerText();
 await p.locator('[data-action="ir-page"]').last().click();assert((await p.locator('#ir-count').innerText()).includes('6–10'));assert.equal(await p.locator('#ir-company').innerText(),firstName);
 await p.locator('#ir-size').selectOption('20');assert.equal(await p.locator('.ir-case').count(),20);
 await p.locator('#ir-query').fill('不存在XYZ');await p.locator('#ir-search-form button[type="submit"]').click();assert.equal(await p.locator('.ir-case').count(),0);assert((await p.locator('#ir-count').innerText()).includes('0'));
 await click('ir-reset');await p.locator('#ir-scope').selectOption('公司 MID');await p.locator('#ir-query').fill(initialMid);await p.locator('#ir-search-form button[type="submit"]').click();assert.equal(await p.locator('.ir-case').count(),1);
 await p.locator('[data-action="ir-document"][data-index="3"]').click();assert((await p.locator('#ir-document-preview').innerText()).includes('結算銀行對帳單'));await click('ir-zoom');assert((await p.locator('#modal-title').innerText()).includes('結算銀行'));await close();
 await p.locator('[data-action="ir-tab"][data-tab="risk"]').click();assert((await p.locator('#ir-tab-panel').innerText()).includes('33 / 100'));await p.locator('[data-action="ir-tab"][data-tab="trail"]').click();assert(await p.locator('.ir-trail li').count()>=2);
 await p.locator('[data-action="ir-tab"][data-tab="fields"]').click();assert.equal(await p.locator('.ir-diff').count(),2);
 await p.locator('[data-action="ir-approve"][data-stage="L2"]').click();assert((await p.locator('#ir-action-error').innerText()).includes('勾選'));
 await click('ir-reject');await click('ir-save');assert((await p.locator('#ir-decision-error').innerText()).includes('原因'));await p.locator('#ir-reason').selectOption({label:'BR 圖片模糊／文件不完整'});await click('ir-save');assert((await p.locator('#ir-decision-error').innerText()).includes('補充'));await close();
 await p.locator('#ir-checked').check();await p.locator('#ir-note').fill('已核對示例文件及差異');await p.locator('#ir-fail').check();await p.locator('[data-action="ir-approve"][data-stage="L2"]').click();await click('ir-save');assert((await p.locator('#ir-decision-error').innerText()).includes('儲存失敗'));assert.equal((await store()).rows.find(r=>r['公司 MID']===initialMid).status,'Pending');await close();await p.locator('#ir-fail').uncheck();
 await p.locator('[data-action="ir-approve"][data-stage="L2"]').click();await click('ir-save');assert((await p.locator('#modal-title').innerText()).includes('已更新'));await close();let db=await store();assert.equal(db.rows.find(r=>r['公司 MID']===initialMid).status,'Approved');assert(db.rows.find(r=>r['公司 MID']===initialMid).internalReview.trail.at(-1).message.includes('已核對示例'));
 await p.reload();await p.waitForSelector('#ir-count');await p.locator('#ir-status').selectOption('Approved');await p.locator('#ir-scope').selectOption('公司 MID');await p.locator('#ir-query').fill(initialMid);await p.locator('#ir-search-form button[type="submit"]').click();assert.equal(await p.locator('.ir-case').count(),1);assert(await p.locator('[data-action="ir-reject"]').isDisabled());
 // High-risk final review requires a real typed reason, never an automatic sentence.
 await click('ir-reset');await p.locator('#ir-role').selectOption('L3');await p.locator('.ir-case').filter({hasText:'L3 終審'}).first().click();await p.locator('#ir-checked').check();await p.locator('[data-action="ir-approve"][data-stage="L3"]').click();await click('ir-save');assert((await p.locator('#ir-decision-error').innerText()).includes('終審必須'));await p.locator('#ir-decision-note').fill('已覆核證明文件，採用 T7 及保證金限制。');await click('ir-save');await close();
 // Rejection and supplementation update the same merchant dataset and trail.
 await click('ir-reset');await p.locator('#ir-role').selectOption('L1');const l1=p.locator('.ir-case').filter({hasText:'L1 初審'}).first();await l1.click();const rejectMid=await l1.getAttribute('data-mid');await click('ir-reject');await p.locator('#ir-decision').selectOption('MoreInfo');await p.locator('#ir-reason').selectOption({label:'BR 圖片模糊／文件不完整'});await p.locator('#ir-decision-note').fill('請重新提供清晰 BR 四角照片。');await click('ir-save');await close();db=await store();assert.equal(db.rows.find(r=>r['公司 MID']===rejectMid).status,'MoreInfo');
 for(const width of [1280,768,390]){await p.setViewportSize({width,height:1000});await click('ir-reset');await assertFill();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);await p.screenshot({path:path.join(out,'internal-review-'+width+'.png'),fullPage:true});}
 await p.setViewportSize({width:1600,height:1000});await route('merchants');await p.locator('#merchant-search').fill(initialMid);await click('search');assert((await p.locator('.merchants tbody').innerText()).includes('通過審核'));
 // A submitted case owned by the signed-in reviewer must remain read-only.
 await p.evaluate(()=>{const k='allinpay-backoffice-20260923-v1',d=JSON.parse(localStorage.getItem(k)),r=d.rows.find(r=>r.status==='Pending');r.owner='ACC-1';r['客戶中文名稱']='自己的待審申請';localStorage.setItem(k,JSON.stringify(d));});await p.reload();await route('internal-review');await p.locator('#ir-query').fill('自己的待審申請');await p.locator('#ir-search-form button[type="submit"]').click();assert(await p.locator('[data-action="ir-reject"]').isDisabled());assert((await p.locator('.ir-detail').innerText()).includes('不得審批自己'));
 await click('logout');await click('bo-logout');await p.locator('[data-action="pick-role"][data-index="2"]').click();await click('bo-login');await p.waitForSelector('.metrics');assert.equal(await p.locator('a[href="#/internal-review"]').count(),0);await route('internal-review');assert.equal(await p.locator('.ir-case').count(),0);assert((await p.locator('.readonly-banner').innerText()).includes('權限不足'));
 assert.deepEqual(errors,[]);await context.close();
 const offline=await browser.newContext({offline:true});const op=await offline.newPage();await op.goto('file://'+path.join(__dirname,'backoffice.html'));await op.locator('[data-action="pick-role"][data-index="0"]').click();await op.locator('[data-action="bo-login"]').click();await op.locator('a[href="#/internal-review"]').click();await op.waitForSelector('.ir-case');assert(await op.locator('.ir-case').count()>0);await offline.close();
 fs.writeFileSync(path.join(out,'internal-review-qa.json'),JSON.stringify({passed:true,url:base,date:new Date().toISOString(),checks:['menu placement/icon','queue pagination/page sizes','cross-field search/empty/reset','document switch/zoom','fields/risk/audit tabs','approval/check-required','reject/reason/note-required','L3 final justification','failure rollback','persistence/merchant sync','self-review denied','unauthorized route denied','1600/1280/768/390 responsive','standalone offline'],errors},null,2));await browser.close();console.log('PASS internal review: workflows, permissions, persistence, responsive and offline');
})().catch(e=>{console.error(e);process.exit(1)});
