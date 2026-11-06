const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=(process.env.DEMO_URL||'http://127.0.0.1:4321/backoffice.html').replace(/\/(backoffice|external|index)\.html.*$/,'');
const checks=[],errors=[];
const click=async(p,a)=>{const modal=p.locator('#modal[open] [data-action="'+a+'"]');await(await modal.count()?modal.first():p.locator('[data-action="'+a+'"]').first()).click();};
const info=p=>p.evaluate(()=>AllinPayDemo.getSessionTimeout());
const stored=(p,t)=>p.evaluate(t=>{const raw=localStorage.getItem(t==='backoffice'?'allinpay-backoffice-20260923-v1':'allinpay-external-v2');return t==='backoffice'?JSON.stringify(JSON.parse(raw||'{}').drafts||[]):raw;},t);
async function login(p,t){
 if(t==='backoffice'){await p.locator('[data-action="pick-role"][data-index="0"]').click();await click(p,'bo-login');await p.waitForSelector('.metrics');}
 else{await p.locator('#authEmail').fill('idle.qa@example.com');await click(p,'login');for(let i=0;i<6;i++)await p.locator('[data-otp="'+i+'"]').fill(String(i+1));await click(p,'verify');await p.waitForSelector('.cards');}
 assert.equal((await info(p)).authenticated,true);
}
(async()=>{const b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});try{
 for(const t of ['backoffice','external']){
  const c=await b.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage();p.on('pageerror',e=>errors.push(t+': '+e.message));
  const now=Date.now();await p.clock.install({time:new Date(now)});await p.clock.pauseAt(new Date(now+1000));await p.goto(base+'/'+t+'.html#/login');
  await p.clock.fastForward(600000);assert.equal((await info(p)).authenticated,false);assert.equal(await p.locator('#idle-session-dialog').count(),0);
  await login(p,t);assert.equal((await info(p)).timeoutMs,300000);assert.equal((await info(p)).warningMs,30000);
  const original=(await info(p)).expiresAt;await p.clock.fastForward(240000);await p.mouse.move(600,300);assert((await info(p)).expiresAt>=original+240000);
  await p.clock.fastForward(60000);assert.equal((await info(p)).authenticated,true);
  // Save a draft, then open another overlay. The warning must not replace it.
  await click(p,'new');await p.evaluate(t=>location.hash='/'+(t==='backoffice'?'application':'form')+'/2',t);await p.locator('[data-field="merchantName"]').fill('閒置逾時測試商戶');await click(p,t==='backoffice'?'save-draft':'save');await click(p,'close');
  const before=await stored(p,t);assert(before);
  await click(p,t==='backoffice'?'settings':'mt-library');const title=await p.locator('#modal-title').innerText();
  await p.clock.fastForward(269000);assert.equal(await p.locator('#idle-session-dialog').count(),0);await p.clock.fastForward(1000);await p.waitForSelector('#idle-session-dialog[open]');
  assert.equal(await p.locator('#idle-session-seconds').innerText(),'30');assert.equal(await p.locator('#modal-title').innerText(),title);assert.equal(await p.locator('#modal').evaluate(d=>d.open),true);
  await p.keyboard.press('Escape');assert.equal(await p.locator('#idle-session-dialog').evaluate(d=>d.open),true);
  for(const width of [1440,390,320]){await p.setViewportSize({width,height:900});assert(await p.locator('#idle-session-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return d.scrollWidth<=d.clientWidth+1&&r.left>=15&&r.right<=innerWidth-15;}));}
  await p.screenshot({path:'qa-idle-warning-'+t+'.png'});await p.locator('[data-idle-action="continue"]').click();assert.equal(await p.locator('#idle-session-dialog').count(),0);assert.equal(await p.locator('#modal-title').innerText(),title);assert.equal(await p.locator('#modal').evaluate(d=>d.open),true);
  assert.equal((await info(p)).remainingMs,300000);await click(p,'close');await p.clock.fastForward(270000);await p.waitForSelector('#idle-session-dialog[open]');await p.clock.fastForward(29000);assert.equal((await info(p)).authenticated,true);assert.equal(await p.locator('#idle-session-seconds').innerText(),'1');
  await p.clock.fastForward(1000);await p.waitForSelector('#idle-session-expired');assert.equal((await info(p)).authenticated,false);assert.equal(await p.locator('dialog[open]').count(),0);assert.equal(await p.locator('.sidebar,.header').count(),0);assert.match(await p.locator('#idle-session-expired').innerText(),/已閒置 5 分鐘/);assert.match(p.url(),/#\/login$/);assert.equal(await stored(p,t),before);
  assert.equal(await p.evaluate(t=>sessionStorage.getItem('allinpay-idle-session-'+t+'-v1'),t),null);
  if(t==='backoffice')assert.equal(await p.evaluate(()=>sessionStorage.getItem('allinpay-backoffice-20260923-v1-session')),null);
  else{await p.evaluate(()=>location.hash='/verify');for(let i=0;i<6;i++)await p.locator('[data-otp="'+i+'"]').fill(String(i+1));await click(p,'verify');assert.match(await p.locator('#otp-error').innerText(),/過期/);assert.equal((await info(p)).authenticated,false);await p.evaluate(()=>location.hash='/login');}
  await p.setViewportSize({width:1440,height:1000});await login(p,t);assert.equal(await p.locator('#idle-session-expired').count(),0);assert.equal((await info(p)).remainingMs,300000);
  if(t==='backoffice'){const deadline=(await info(p)).expiresAt;await p.clock.fastForward(100000);await p.reload();await p.waitForSelector('.metrics');assert.equal((await info(p)).expiresAt,deadline);checks.push('Backoffice reload preserves the original idle deadline instead of granting another five minutes.');}
  // Wall-clock expiry is checked immediately on return from a sleeping/background tab.
  const deadline=(await info(p)).expiresAt;await p.clock.setSystemTime(new Date(deadline+1000));await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForSelector('#idle-session-expired');assert.equal((await info(p)).authenticated,false);assert.equal(await stored(p,t),before);
  await login(p,t);await p.clock.fastForward(270000);await p.locator('[data-idle-action="logout"]').click();assert.equal((await info(p)).authenticated,false);assert.equal(await p.locator('#idle-session-dialog,#idle-session-expired').count(),0);
  checks.push(t+': unauthenticated pages excluded; trusted activity resets the five-minute deadline; 30-second top-layer warning; Escape cannot hide it; explicit extension preserves the original modal and fields; expiry closes protected UI, invalidates login/OTP and preserves saved drafts; wake-up, re-login, manual logout and 1440/390/320 layouts verified.');
  await c.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('qa-session-timeout-report.json',JSON.stringify({passed:true,date:new Date().toISOString(),url:base,checks,errors},null,2));console.log('PASS five-minute idle session:',checks.join('\n'));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
