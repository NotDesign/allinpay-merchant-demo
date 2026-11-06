const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=(process.env.EXTERNAL_URL||'http://127.0.0.1:4321/external.html').split(/[?#]/)[0];
const REG='allinpay-external-registrations-v1',APP='allinpay-external-v2',checks=[],errors=[];
const invite='?inviter=ACC-1&agency=MA-001';
const click=(p,a)=>p.locator('#modal[open] [data-action="'+a+'"],body:not(:has(#modal[open])) [data-action="'+a+'"]').first().click();
const otp=async(p,code='123456')=>{await p.waitForSelector('[data-otp]');for(let i=0;i<6;i++)await p.locator('[data-otp="'+i+'"]').fill(code[i]);await click(p,'verify');};
const read=(p,key)=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)||'[]'),key);
const signup=async(p,company='INVITATION QA LIMITED',email='invite.qa@example.com',country='香港特別行政區')=>{
 await p.locator('#registerCountry').selectOption({label:country});await p.locator('#registerCompany').fill(company);
 await p.locator('#registerLast').fill('CHAN');await p.locator('#registerFirst').fill('QA');await p.locator('#authEmail').fill(email);
 await p.locator('#authority').check();await p.locator('#terms').check();await click(p,'register');
};
const goLogin=async p=>{await p.locator('a[href="#/login"]').first().click();await p.waitForSelector('[data-action="to-register"]');};
const login=async(p,email)=>{await p.locator('#authEmail').fill(email);await click(p,'login');await otp(p);};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 async function context(storage={}){const c=await browser.newContext({viewport:{width:1440,height:1000}});await c.addInitScript(storage=>{for(const [key,value] of Object.entries(storage))localStorage.setItem(key,JSON.stringify(value));},storage);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return {c,p};}
 try{
  let {c,p}=await context();
  for(const hash of ['#/form/1','#/login','#/register']){await p.goto('about:blank');await p.goto(base+invite+hash);await p.waitForSelector('#registerCompany');assert.equal(new URL(p.url()).hash,'#/register');assert.equal(await p.locator('.v2-form').count(),0);}
  assert.equal(await p.locator('#referrer').inputValue(),'MA-001');assert(await p.locator('#referrer').getAttribute('readonly')!==null);
  await signup(p);await p.waitForSelector('[data-otp]');assert.deepEqual(await read(p,REG),[]);assert.equal(await p.locator('.v2-form').count(),0);
  await otp(p,'000000');assert.match(await p.locator('#otp-error').innerText(),/不正確/);assert.deepEqual(await read(p,REG),[]);
  await click(p,'expire');await otp(p);assert.match(await p.locator('#otp-error').innerText(),/過期/);assert.deepEqual(await read(p,REG),[]);
  await click(p,'resend');await otp(p);await p.waitForSelector('.v2-form');assert.match(p.url(),/#\/form\/1$/);
  let state=await p.evaluate(()=>AllinPayDemo.getState());assert.equal(state.values.merchantEnglishName,'INVITATION QA LIMITED');assert.equal(state.values.contactEmail,'invite.qa@example.com');assert.deepEqual(state.values.__externalInvitation,{inviter:'ACC-1',agency:'MA-001'});
  const registered=await read(p,REG);assert.equal(registered.length,1);assert.equal(registered[0].email,'invite.qa@example.com');assert.deepEqual(await read(p,APP),[]);
  // Registration must remain discoverable even if the merchant has not saved a draft.
  await p.reload();await signup(p,'INVITATION QA LIMITED','  INVITE.QA@EXAMPLE.COM  ');await p.waitForSelector('#modal[open]');assert.match(await p.locator('#modal-title').innerText(),/已註冊/);assert.equal(await p.locator('[data-otp]').count(),0);
  for(const width of [1440,390,320]){await p.setViewportSize({width,height:1000});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await p.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
  await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:'qa-external-registration-duplicate.png'});
  await click(p,'er-existing-login');await p.waitForSelector('[data-action="to-register"]');assert.equal(await p.locator('#authEmail').inputValue(),'invite.qa@example.com');assert.equal(await p.locator('.v2-form').count(),0);
  await click(p,'login');assert.equal(await p.locator('.v2-form').count(),0);await otp(p);await p.waitForSelector('.v2-form');assert.equal((await read(p,REG)).length,1);
  // Create one real saved V2 record for continuation tests, without production data.
  await p.evaluate(()=>location.hash='/form/2');await p.locator('[data-field="merchantName"]').fill('邀請測試商戶');await click(p,'save');await click(p,'close');const saved=(await read(p,APP))[0];assert(saved);
  await p.screenshot({path:'qa-external-registration-continued.png'});
  checks.push('New and legacy invitations land on registration; wrong/expired OTP never registers or opens a form; verified registration persists before draft save; duplicate email routes to explicit login and OTP.');
  await c.close();

  ({c,p}=await context({[APP]:[saved]}));await p.goto(base+invite+'#/register');await signup(p,' INVITATION   qa LIMITED ','different.qa@example.com');await p.waitForSelector('#modal[open]');assert.match(await p.locator('#modal').innerText(),/該商戶已經註冊過/);assert(!(await p.locator('#modal').innerText()).includes(saved.email));await click(p,'er-existing-login');await login(p,'different.qa@example.com');await p.waitForSelector('.v2-form');assert.equal((await p.evaluate(()=>AllinPayDemo.getState())).values.merchantName||'','');assert.deepEqual(await read(p,APP),[saved]);await c.close();
  checks.push('Existing legacy application records detect normalized company duplicates without disclosing the original email or loading another email owner’s draft.');

  ({c,p}=await context({[APP]:[saved]}));await p.goto(base+invite+'#/register');await signup(p,saved.values.companyEn,saved.email);await click(p,'er-existing-login');await click(p,'login');await otp(p);await p.waitForSelector('.v2-form');assert.match(p.url(),/#\/form\/2$/);assert.equal((await p.evaluate(()=>AllinPayDemo.getState())).values.merchantName,'邀請測試商戶');assert.deepEqual(await read(p,APP),[saved]);await c.close();
  checks.push('An existing merchant resumes the matching draft and saved step after login; the saved record is unchanged.');

  const second={...structuredClone(saved),id:'QA-SECOND',values:{...saved.values,merchantName:'第二份草稿'}};
  ({c,p}=await context({[APP]:[saved,second]}));await p.goto(base+invite+'#/register');await goLogin(p);await login(p,saved.email);await p.waitForSelector('.cards');assert.match(p.url(),/#\/applications$/);assert.equal(await p.locator('.cards [data-action="open"]').count(),2);assert.equal((await read(p,APP)).length,2);await c.close();
  ({c,p}=await context({[APP]:[{...saved,status:'審核中'}]}));await p.goto(base+invite+'#/register');await goLogin(p);await login(p,saved.email);await p.waitForSelector('.cards');await p.locator('.cards [data-action="open"]').click();await p.waitForSelector('.review');assert.equal(await p.locator('[data-action="confirm-submit"]').count(),0);await c.close();
  checks.push('Multiple drafts show a chooser; submitted applications remain read-only and are not silently duplicated or reopened for editing.');

  ({c,p}=await context({[APP]:[saved],[REG]:registered}));await p.goto(base+invite+'#/register');await signup(p,'NEW COMPANY QA LIMITED',saved.email);await click(p,'er-existing-login');await click(p,'login');await otp(p);await p.waitForSelector('.v2-form');assert.match(p.url(),/#\/form\/1$/);state=await p.evaluate(()=>AllinPayDemo.getState());assert.equal(state.values.merchantEnglishName,'NEW COMPANY QA LIMITED');assert.deepEqual(await read(p,APP),[saved]);await c.close();
  const attributed={...structuredClone(saved),values:{...saved.values,__externalInvitation:{inviter:'ACC-OLD',agency:'MA-OLD'},referrer:'MA-OLD'}};
  ({c,p}=await context({[APP]:[attributed]}));await p.goto(base+invite+'#/register');await goLogin(p);await login(p,saved.email);await p.waitForSelector('.v2-form');state=await p.evaluate(()=>AllinPayDemo.getState());assert.equal(state.values.__externalInvitation.agency,'MA-OLD');assert.equal(state.values.referrer,'MA-OLD');await c.close();
  checks.push('An existing account can start another company after login; previous applications and established invitation attribution remain intact.');

  // Both tabs can reach OTP, but only the first successful registration may persist.
  ({c,p}=await context());const other=await c.newPage();other.on('pageerror',e=>errors.push(e.message));await p.goto(base+invite+'#/register');await other.goto(base+invite+'#/register');await signup(p);await signup(other);await otp(p);await p.waitForSelector('.v2-form');await otp(other);await other.waitForSelector('#modal[open]');assert.match(await other.locator('#modal-title').innerText(),/已註冊/);assert.equal((await read(other,REG)).length,1);assert.equal(await other.locator('.v2-form').count(),0);await c.close();
  checks.push('The verification step rechecks fresh browser records, preventing a second tab from registering the same merchant after the first tab succeeds.');

  ({c,p}=await context());await p.goto(base+invite+'#/register');await signup(p,'儲存測試有限公司','storage.qa@example.com');await p.evaluate(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Quota exceeded','QuotaExceededError');return set.call(this,k,v);};},REG);await otp(p);await p.waitForSelector('#modal[open]');assert.match(await p.locator('#modal-title').innerText(),/暫時未能完成/);assert.deepEqual(await read(p,REG),[]);assert.equal(await p.locator('.v2-form').count(),0);await click(p,'close');await p.locator('a[href="#/login"]').first().click();await click(p,'to-register');assert.equal(await p.locator('#registerCompany').inputValue(),'儲存測試有限公司');await c.close();
  checks.push('Storage failure leaves registration incomplete and preserves the entered values for retry.');

  ({c,p}=await context({[REG]:registered}));await p.goto(base+invite+'#/register');await signup(p,'INVITATION QA LIMITED','other-country.qa@example.com','英國');await otp(p);await p.waitForSelector('.v2-form');assert.equal((await read(p,REG)).length,2);await c.close();
  ({c,p}=await context());await p.goto(base+'#/login');await p.waitForSelector('[data-action="to-register"]');assert.equal(await p.locator('h2').first().innerText(),'商戶申請');await login(p,'normal.qa@example.com');await p.waitForSelector('.cards');await c.close();
  checks.push('Distinct explicit registration countries do not collide on company name alone; ordinary non-invitation login retains the My Applications entry.');
  assert.deepEqual(errors,[]);fs.writeFileSync('qa-external-registration-report.json',JSON.stringify({passed:true,date:new Date().toISOString(),url:base,checks,errors},null,2));console.log('PASS External registration invitation:',checks.join('\n'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
