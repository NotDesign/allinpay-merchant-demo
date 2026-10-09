const {completeOTP,completeKTC}=require('./test-azure-helpers.cjs');
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=(process.env.DEMO_URL||'http://127.0.0.1:4321').replace(/\/(?:backoffice|external|index)\.html.*$/,'').replace(/\/$/,'');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});const errors=[],checks=[];try{
 for(const target of ['backoffice','external']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(target+': '+e.stack));
  const click=async(a)=>page.locator(`[data-action="${a}"]`).first().click();
  await page.goto(base+'/'+target+'.html#/login');
  if(target==='backoffice'){await click('pick-role');await click('bo-login');await completeOTP(page);await page.evaluate(()=>location.hash='/application/1');}
  else{await page.locator('#authEmail').fill('feedback@example.com');await click('login');await page.locator('[data-otp="0"]').fill('1');for(let i=1;i<6;i++)await page.locator(`[data-otp="${i}"]`).fill(String(i+1));await click('verify');await completeOTP(page);await page.locator('[data-action="new"]').first().click();}
  await page.waitForSelector('.v2-form');await click('next');await page.waitForSelector('.ktc-panel');await completeKTC(page);await page.locator('.ktc-panel [data-action="ktc-next"]').click();await page.waitForSelector('[data-v2-field="parentMerchant"]');
  assert.equal(await page.locator('[data-field="dbaNo"]').count(),0);
  await page.locator('[data-field="parentMerchant"]').fill('PARENT-001');await page.locator('[data-field="inspectionDate"]').fill('2026-09-29');
  await page.evaluate(t=>location.hash=t==='external'?'/form/4':'/application/4',target);
  const code=page.locator('[data-v2-field="cardBankCode"]'),bank=page.locator('[data-v2-field="cardBankName"]');await code.fill('016');await code.blur();assert.equal(await bank.inputValue(),'星展銀行（香港）');await code.fill('999');await code.blur();assert.equal(await bank.inputValue(),'');assert.equal(await bank.isEditable(),true);
  await page.evaluate(t=>location.hash=t==='external'?'/form/1':'/application/1',target);await page.waitForSelector('[data-document-drop]');
  assert.equal(await page.locator('.upload-row .required').count(),0);
  await click('v2-ocr');await page.waitForSelector('#document-batch-files',{state:'attached'});await page.locator('#document-batch-files').setInputFiles([{name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('NOT A PDF')}]);await click('document-recognize');await page.waitForSelector('.batch-candidates');assert.match(await page.locator('#modal').innerText(),/真正的 PDF|沒有可帶入/);await page.locator('#modal [data-action="close"]').first().click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'qa-document-feedback-'+target+'-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),target+' mobile overflow');
  if(target==='external'){
   await page.setViewportSize({width:1440,height:1000});await click('sample');await click('confirm-sample');
   await page.evaluate(()=>location.hash='/form/2');await page.locator('[data-v2-field="parentMerchant"]').fill('DEMO-PARENT');await click('save');await page.locator('#modal [data-action="home"]').click();await click('open');
   assert.equal(await page.locator('[data-v2-field="parentMerchant"]').inputValue(),'DEMO-PARENT');
   await page.evaluate(()=>location.hash='/form/6');await page.waitForSelector('#signature');
   await completeKTC(page);await click('submit');assert.equal(await page.locator('#modal-title').innerText(),'請完成簽署');await page.locator('#modal [data-action="close"]').first().click();
   await click('demo-signature');await page.locator('[data-check="613:4956"]').check();await page.locator('#simulate-failure').check();await completeKTC(page);await click('submit');assert.equal(await page.locator('#modal-title').innerText(),'申請提交失敗');await page.locator('#modal [data-action="close"]').first().click();await page.locator('#simulate-failure').uncheck();
   await completeKTC(page);await click('submit');await page.locator('#modal [data-action="confirm-submit"]').click();assert.equal(await page.locator('#modal-title').innerText(),'申請提交成功');await page.locator('#modal [data-action="home"]').click();await click('open');await page.waitForSelector('.external-readonly');assert.equal(await page.locator('.external-readonly input:enabled').count(),0);
   checks.push('External draft restore, signature required, simulated failure/retry, submission, readonly review');
  }
  checks.push(target+': optional uploads, added fields, removed DBA, bank sync, invalid OCR file, mobile layout');await page.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
