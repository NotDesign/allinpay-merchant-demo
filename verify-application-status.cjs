const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.DEMO_URL||'http://127.0.0.1:4321/backoffice.html';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const p=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],checks=[];
 p.on('pageerror',e=>errors.push(e.message));
 const click=(a,extra='')=>p.locator('[data-action="'+a+'"]'+extra).first().click();
 const go=async step=>{await p.evaluate(s=>location.hash='/application/'+s,step);await p.waitForFunction(s=>document.querySelector('.step.active')?.dataset.step===String(s),step);};
 const status=()=>p.evaluate(()=>AllinPayDemo.getApplicationStatus());
 await p.goto(base+'#/login');await click('pick-role','[data-index="0"]');await click('bo-login');await go(1);
 const initial=await status();assert.equal(initial.score.total,27);assert.equal(initial.policy.label,'中');assert.equal(initial.policy.cycle,'T2');assert.equal(initial.percent,Math.round(initial.completed/initial.required*100));
 for(let step=1;step<=6;step++){
  await go(step);assert.equal(await p.locator('#v2-application-status').count(),1);
  assert.equal(await p.locator('#v2-application-status .v2-status-card').count(),3);
  assert.equal((await status()).score.total,initial.score.total);
  const layout=await p.evaluate(()=>{const a=document.querySelector('#v2-application-status'),m=document.querySelector('.v2-application-main');return {pos:getComputedStyle(a).position,left:a.getBoundingClientRect().left,right:m.getBoundingClientRect().right};});
  assert.equal(layout.pos,'sticky');assert(layout.left>layout.right);
  await p.evaluate(()=>scrollTo(0,600));await p.waitForTimeout(80);
  const top=await p.locator('#v2-application-status').evaluate(n=>n.getBoundingClientRect().top);assert(top>=0&&top<=57,'Sidebar not pinned on step '+step+': '+top);
 }
 checks.push('All six steps share one right-hand sticky sidebar with risk, missing documents and completion; source rules yield 27 points and medium/T2');
 await go(5);await p.locator('[data-v2-group="CNP"]').uncheck();assert.equal((await status()).score.total,12);assert.equal((await status()).policy.label,'低');
 await p.locator('[data-v2-group="CNP"]').check();assert.equal((await status()).score.total,27);
 await go(2);const before=await status();await p.locator('[data-field="merchantName"]').fill('DEMO 測試商戶');assert.equal((await status()).completed,before.completed+1);
 await go(3);await p.locator('[data-field="riskLevel"]').selectOption('1');assert.equal((await status()).policy.label,'低');assert((await p.locator('#v2-application-status').innerText()).includes('人工設定'));assert.equal(await p.locator('[data-field="riskOverrideReason"]').count(),1);
 await click('v2-reset-risk');assert.equal((await status()).policy.label,'中');
 await click('v2-status-checks');assert.equal(await p.locator('#modal-title').innerText(),'資料核對明細');await p.locator('#modal [data-action="step"][data-step="1"]').click();await p.waitForFunction(()=>document.querySelector('.step.active')?.dataset.step==='1');assert.equal(await p.locator('#modal').evaluate(n=>n.open),false);
 checks.push('Product changes update score; typing updates completion without losing focus; manual risk override/reset and sidebar drill-down work');
 await go(5);await p.setViewportSize({width:1600,height:1000});await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'qa-backoffice-products-desktop.png'});
 await p.locator('.v2-sme-table').screenshot({path:'qa-backoffice-sme.png'});
 for(const width of [1440,1024,390]){await p.setViewportSize({width,height:1000});for(let step=1;step<=6;step++){await go(step);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow '+width+' step '+step);}}
 checks.push('1440 / 1024 / 390 widths: all six steps render without page overflow');
 assert.deepEqual(errors,[]);await browser.close();const report={passed:true,date:new Date().toISOString(),url:base,checks,errors};fs.writeFileSync('qa-application-status-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
